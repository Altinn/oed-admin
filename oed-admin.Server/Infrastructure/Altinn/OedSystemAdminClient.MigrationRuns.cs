using System.Net.Http.Json;
using System.Text.Json;

namespace oed_admin.Server.Infrastructure.Altinn;

// The OED_M sweep and verify runs in oed's admin group (Altinn/oed#1902), driven from here by Altinn/oed#1923 §4.3.
// As for phase and copy: no EnsureSuccessStatusCode, no retry, and status 0 when oed never answered.
public partial interface IOedSystemAdminClient
{
    Task<OedModelMigrationRunResult> StartMigrationRun(OedModelMigrationRunStart start, CancellationToken cancellationToken);

    Task<OedModelMigrationRunResult> GetMigrationRun(Guid runId, CancellationToken cancellationToken);

    /// <summary>The queued or running run; 404 when there is none. After an abandon, the continuation has a new id
    /// that only this reveals.</summary>
    Task<OedModelMigrationRunResult> GetActiveMigrationRun(CancellationToken cancellationToken);

    /// <summary>The latest finished verify run; 404 when none has finished.</summary>
    Task<OedModelMigrationRunResult> GetLatestVerifyRun(CancellationToken cancellationToken);

    Task<OedModelMigrationRunResult> CancelMigrationRun(Guid runId, CancellationToken cancellationToken);

    Task<OedModelMigrationRunItemsResult> GetMigrationRunItems(
        Guid runId, string? outcome, int page, int pageSize, CancellationToken cancellationToken);
}

/// <param name="Mode"><c>sweep</c> or <c>verify</c>.</param>
/// <param name="Limit">Sweep only: stop after this many copies. Null for no limit.</param>
/// <param name="SampleSize">Verify only.</param>
/// <remarks>Null leaves oed's default: rate 2/s, parallelism 2, sample 200.</remarks>
public record OedModelMigrationRunStart(string Mode, int? Limit, double? RatePerSecond, int? MaxParallelism, int? SampleSize);

public record OedModelMigrationRunParameters(int? Limit, double RatePerSecond, int MaxParallelism, int? SampleSize);

public record OedModelMigrationRunProgress(int Listed, int Processed, int ToProcess);

public record OedModelMigrationRunReport(
    IReadOnlyDictionary<string, int> Outcomes,
    IReadOnlyDictionary<string, int> FailuresByReason,
    int DuplicateOwnerCount,
    IReadOnlyList<int> DuplicateOwnerPartyIds,
    int DatabaseCreatedRows,
    int Sampled,
    bool? Ready);

/// <param name="Mode"><c>Sweep</c> or <c>Verify</c>.</param>
/// <param name="Status"><c>Queued</c>, <c>Running</c>, <c>Completed</c>, <c>Cancelled</c>, <c>Failed</c> or
/// <c>Abandoned</c>.</param>
/// <param name="RequestedBy">oed-admin's client_id, or <c>worker</c> for a continuation; never a person.</param>
/// <param name="Ready">A verify's verdict: true only for a Completed run.</param>
/// <param name="Report">Null until the run ends, and for a Failed run.</param>
public record OedModelMigrationRun(
    Guid Id,
    string Mode,
    string Status,
    string RequestedBy,
    string? CancelRequestedBy,
    Guid? ContinuesRunId,
    DateTimeOffset Created,
    DateTimeOffset? Started,
    DateTimeOffset? Finished,
    DateTimeOffset? Heartbeat,
    OedModelMigrationRunParameters Parameters,
    OedModelMigrationRunProgress Progress,
    string? FailureReason,
    bool? Ready,
    OedModelMigrationRunReport? Report);

/// <param name="Outcome">Null while the item waits.</param>
/// <param name="Reason">A failure's reason, a SampleMismatch's first differing XPath, or a Busy item's text.</param>
public record OedModelMigrationRunItem(
    Guid InstanceGuid,
    int InstanceOwnerPartyId,
    string? Outcome,
    string? Failure,
    string? Reason,
    IReadOnlyList<string> DroppedElements,
    DateTimeOffset? StorageLastChanged,
    int Attempts,
    DateTimeOffset Updated);

public record OedModelMigrationRunItems(IReadOnlyList<OedModelMigrationRunItem> Items, int Page, int PageSize, int Total);

/// <param name="HttpStatus">oed's status, or 0 when the call never produced a response.</param>
/// <param name="ActiveRunId">With a 409 from start: the run that is already active.</param>
public record OedModelMigrationRunResult(int HttpStatus, OedModelMigrationRun? Run, OedAdminProblem? Problem, Guid? ActiveRunId);

/// <param name="HttpStatus">oed's status, or 0 when the call never produced a response.</param>
public record OedModelMigrationRunItemsResult(int HttpStatus, OedModelMigrationRunItems? Items, OedAdminProblem? Problem);

public partial class OedSystemAdminClient
{
    private const string MigrationRunsPath = $"{OedModelPath}/migration-runs";

    private static readonly JsonSerializerOptions WebJson = new(JsonSerializerDefaults.Web);

    public Task<OedModelMigrationRunResult> StartMigrationRun(OedModelMigrationRunStart start, CancellationToken cancellationToken) =>
        SendRun(
            () => httpClient.PostAsJsonAsync(
                MigrationRunsPath,
                new { mode = start.Mode, limit = start.Limit, ratePerSecond = start.RatePerSecond, maxParallelism = start.MaxParallelism, sampleSize = start.SampleSize },
                cancellationToken),
            cancellationToken);

    public Task<OedModelMigrationRunResult> GetMigrationRun(Guid runId, CancellationToken cancellationToken) =>
        SendRun(() => httpClient.GetAsync($"{MigrationRunsPath}/{runId}", cancellationToken), cancellationToken);

    public Task<OedModelMigrationRunResult> GetActiveMigrationRun(CancellationToken cancellationToken) =>
        SendRun(() => httpClient.GetAsync($"{MigrationRunsPath}/active", cancellationToken), cancellationToken);

    public Task<OedModelMigrationRunResult> GetLatestVerifyRun(CancellationToken cancellationToken) =>
        SendRun(() => httpClient.GetAsync($"{MigrationRunsPath}/latest-verify", cancellationToken), cancellationToken);

    public Task<OedModelMigrationRunResult> CancelMigrationRun(Guid runId, CancellationToken cancellationToken) =>
        SendRun(() => httpClient.PostAsync($"{MigrationRunsPath}/{runId}/cancel", null, cancellationToken), cancellationToken);

    public async Task<OedModelMigrationRunItemsResult> GetMigrationRunItems(
        Guid runId, string? outcome, int page, int pageSize, CancellationToken cancellationToken)
    {
        // Leave outcome out rather than send it empty: oed refuses `outcome=`.
        var query = $"page={page}&pageSize={pageSize}"
            + (string.IsNullOrEmpty(outcome) ? "" : $"&outcome={Uri.EscapeDataString(outcome)}");
        var response = await SendOrNull(
            () => httpClient.GetAsync($"{MigrationRunsPath}/{runId}/items?{query}", cancellationToken),
            cancellationToken);
        if (response.Failure is { } failure)
            return new OedModelMigrationRunItemsResult(0, null, failure);

        using var message = response.Message!;
        var body = await ReadStringOrEmpty(message, cancellationToken);
        return message.IsSuccessStatusCode
            ? new OedModelMigrationRunItemsResult((int)message.StatusCode, DeserializeOrNull<OedModelMigrationRunItems>(body), null)
            : new OedModelMigrationRunItemsResult((int)message.StatusCode, null, ProblemFrom(DeserializeOrNull<RunProblemBody>(body)));
    }

    private async Task<OedModelMigrationRunResult> SendRun(Func<Task<HttpResponseMessage>> send, CancellationToken cancellationToken)
    {
        var response = await SendOrNull(send, cancellationToken);
        if (response.Failure is { } failure)
            return new OedModelMigrationRunResult(0, null, failure, null);

        using var message = response.Message!;
        var body = await ReadStringOrEmpty(message, cancellationToken);
        if (message.IsSuccessStatusCode)
            return new OedModelMigrationRunResult((int)message.StatusCode, DeserializeOrNull<OedModelMigrationRun>(body), null, null);

        var problem = DeserializeOrNull<RunProblemBody>(body);
        return new OedModelMigrationRunResult((int)message.StatusCode, null, ProblemFrom(problem), problem?.ActiveRunId);
    }

    private static async Task<string> ReadStringOrEmpty(HttpResponseMessage message, CancellationToken cancellationToken) =>
        message.Content is null ? "" : await message.Content.ReadAsStringAsync(cancellationToken);

    private T? DeserializeOrNull<T>(string body) where T : class
    {
        if (string.IsNullOrWhiteSpace(body))
            return null;
        try
        {
            return JsonSerializer.Deserialize<T>(body, WebJson);
        }
        catch (JsonException ex)
        {
            // An answer of an unexpected shape must not take the page down; the status still says what happened.
            logger.LogDebug(ex, "Unable to parse an oed admin answer as {Type}", typeof(T).Name);
            return null;
        }
    }

    private static OedAdminProblem? ProblemFrom(RunProblemBody? body) =>
        body is null ? null : ProblemOrNull(body.Title, body.Detail, body.Errors);

#pragma warning disable S1144, S3459
    private sealed record RunProblemBody
    {
        public string? Title { get; init; }
        public string? Detail { get; init; }
        public Dictionary<string, string[]>? Errors { get; init; }
        public Guid? ActiveRunId { get; init; }
    }
#pragma warning restore S1144, S3459
}
