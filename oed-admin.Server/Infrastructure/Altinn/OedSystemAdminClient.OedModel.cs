using System.Net.Http.Json;
using System.Text.Json;

namespace oed_admin.Server.Infrastructure.Altinn;

// The OED_M migration endpoints in oed's admin group (Altinn/oed#1904, driven from here by Altinn/oed#1923).
// Like MigrateDeclarationPdf: no EnsureSuccessStatusCode and no retry. The answer, whatever its status, is the result,
// and a state-changing call is never repeated behind the person's back.
public partial interface IOedSystemAdminClient
{
    Task<OedModelPhaseResult> GetOedModelPhase(CancellationToken cancellationToken);

    /// <param name="reason">Sent as is. The caller adds who asked for the change.</param>
    Task<OedModelPhaseResult> SetOedModelPhase(string phase, string reason, CancellationToken cancellationToken);

    Task<OedModelCopyResult> CopyOedModel(int partyId, Guid instanceGuid, CancellationToken cancellationToken);
}

/// <param name="Phase"><c>Storage</c>, <c>Migrating</c> or <c>Database</c>.</param>
/// <param name="ChangedBy">The <c>client_id</c> of the token that changed it, never a person.</param>
/// <param name="CachedOnThisPod">The phase the oed pod that answered last read; it can lag by about 5 s.</param>
public record OedModelPhaseState(
    string Phase,
    string Reason,
    DateTimeOffset Changed,
    string ChangedBy,
    string? CachedOnThisPod);

/// <summary>A ProblemDetails from oed. <c>Detail</c> on a 409 is the reason for the refusal, to be shown as is.</summary>
public record OedAdminProblem(string? Title, string? Detail, IReadOnlyDictionary<string, string[]>? Errors);

/// <param name="HttpStatus">oed's status, or 0 when the call never produced a response.</param>
/// <param name="Phase">The stored phase on 200, otherwise null.</param>
public record OedModelPhaseResult(int HttpStatus, OedModelPhaseState? Phase, OedAdminProblem? Problem);

/// <param name="Outcome"><c>Copied</c>, <c>AlreadyMigrated</c>, <c>InstanceNotFound</c>, <c>NoOedElement</c>,
/// <c>NotAllowed</c> or <c>Failed</c>.</param>
/// <param name="Failure">With <c>Failed</c>: <c>RoundTrip</c>, <c>NoDeceasedInfo</c>, <c>NulCharacter</c>,
/// <c>NoCreated</c> or <c>StorageError</c>.</param>
public record OedModelCopy(
    string Outcome,
    string? Failure,
    string? FailureReason,
    IReadOnlyList<string> DroppedElements,
    DateTimeOffset? StorageLastChanged,
    DateTimeOffset? Created);

/// <param name="HttpStatus">oed's status, or 0 when the call never produced a response.</param>
/// <param name="Copy">The copy's result. oed sends it for 200, 404, 409 and 502.</param>
/// <param name="Problem">A ProblemDetails, as for 503, or the transport failure for status 0.</param>
/// <param name="RetryAfterSeconds">The <c>Retry-After</c> of a 503: when the person may try again.</param>
public record OedModelCopyResult(int HttpStatus, OedModelCopy? Copy, OedAdminProblem? Problem, int? RetryAfterSeconds);

public partial class OedSystemAdminClient
{
    private const string OedModelPath = $"/{AppIds.Oed}/api/admin/oed-model";

    public async Task<OedModelPhaseResult> GetOedModelPhase(CancellationToken cancellationToken) =>
        await SendPhase(() => httpClient.GetAsync($"{OedModelPath}/phase", cancellationToken), cancellationToken);

    public async Task<OedModelPhaseResult> SetOedModelPhase(string phase, string reason, CancellationToken cancellationToken) =>
        await SendPhase(
            () => httpClient.PutAsJsonAsync($"{OedModelPath}/phase", new { phase, reason }, cancellationToken),
            cancellationToken);

    public async Task<OedModelCopyResult> CopyOedModel(int partyId, Guid instanceGuid, CancellationToken cancellationToken)
    {
        var response = await SendOrNull(
            () => httpClient.PostAsync($"{OedModelPath}/estates/{partyId}/{instanceGuid}/copy", null, cancellationToken),
            cancellationToken);
        if (response.Failure is { } failure)
            return new OedModelCopyResult(0, null, failure, null);

        using var message = response.Message!;
        // One shape for every status: the copy result for 200/404/409/502, a ProblemDetails for 503 and the rest.
        var body = await ReadOrNull<CopyBody>(message, cancellationToken);
        var copy = body?.Outcome is { } outcome
            ? new OedModelCopy(
                outcome,
                body.Failure,
                body.FailureReason,
                body.DroppedElements ?? [],
                body.StorageLastChanged,
                body.Created)
            : null;

        return new OedModelCopyResult(
            (int)message.StatusCode,
            copy,
            ProblemOrNull(body?.Title, body?.Detail, body?.Errors),
            RetryAfterSeconds(message));
    }

    private async Task<OedModelPhaseResult> SendPhase(Func<Task<HttpResponseMessage>> send, CancellationToken cancellationToken)
    {
        var response = await SendOrNull(send, cancellationToken);
        if (response.Failure is { } failure)
            return new OedModelPhaseResult(0, null, failure);

        using var message = response.Message!;
        var body = await ReadOrNull<PhaseBody>(message, cancellationToken);
        var phase = message.IsSuccessStatusCode && body is { Phase: { } name, Reason: { } reason, Changed: { } changed, ChangedBy: { } changedBy }
            ? new OedModelPhaseState(name, reason, changed, changedBy, body.CachedOnThisPod)
            : null;

        return new OedModelPhaseResult(
            (int)message.StatusCode,
            phase,
            message.IsSuccessStatusCode ? null : ProblemOrNull(body?.Title, body?.Detail, body?.Errors));
    }

    private static async Task<(HttpResponseMessage? Message, OedAdminProblem? Failure)> SendOrNull(
        Func<Task<HttpResponseMessage>> send,
        CancellationToken cancellationToken)
    {
        try
        {
            return (await send(), null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            // A client-side timeout surfaces as TaskCanceledException with our own token uncancelled.
            return (null, new OedAdminProblem("No answer from oed", ex.Message, null));
        }
    }

    private static OedAdminProblem? ProblemOrNull(string? title, string? detail, IReadOnlyDictionary<string, string[]>? errors) =>
        title is null && detail is null && errors is null ? null : new OedAdminProblem(title, detail, errors);

    private static int? RetryAfterSeconds(HttpResponseMessage message) =>
        message.Headers.RetryAfter switch
        {
            { Delta: { } delta } => (int)Math.Ceiling(delta.TotalSeconds),
            { Date: { } date } => Math.Max(0, (int)Math.Ceiling((date - DateTimeOffset.UtcNow).TotalSeconds)),
            _ => null,
        };

    // Parsed tolerantly: oed may add fields, and an error status may carry a ProblemDetails instead.
#pragma warning disable S1144, S3459
    private sealed record PhaseBody
    {
        public string? Phase { get; init; }
        public string? Reason { get; init; }
        public DateTimeOffset? Changed { get; init; }
        public string? ChangedBy { get; init; }
        public string? CachedOnThisPod { get; init; }
        public string? Title { get; init; }
        public string? Detail { get; init; }
        public Dictionary<string, string[]>? Errors { get; init; }
    }

    private sealed record CopyBody
    {
        public string? Outcome { get; init; }
        public string? Failure { get; init; }
        public string? FailureReason { get; init; }
        public List<string>? DroppedElements { get; init; }
        public DateTimeOffset? StorageLastChanged { get; init; }
        public DateTimeOffset? Created { get; init; }
        public string? Title { get; init; }
        public string? Detail { get; init; }
        public Dictionary<string, string[]>? Errors { get; init; }
    }
#pragma warning restore S1144, S3459
}
