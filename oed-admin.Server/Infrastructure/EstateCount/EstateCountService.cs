using System.Net;
using System.Threading.Channels;
using Altinn.ApiClients.Maskinporten.Models;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Infrastructure.EstateCount;

/// <summary>
/// Counts the estates matching a set of filters. Created date and case status are answered by
/// the oed database; heir roles only exist in the OED_M instance form data, so Storage is only
/// called when the count is grouped by heir role.
/// </summary>
public class EstateCountService(
    IServiceScopeFactory scopeFactory,
    Channel<EstateCountTrigger> channel,
    EstateCountState state,
    ILogger<EstateCountService> logger)
    : BackgroundService
{
    private const int BatchSize = 500;
    private const int MaxConcurrency = 4;
    private const int MaxAttempts = 3;
    private const int HeartbeatEvery = 1000;

    private const string AccessDeniedError =
        "Avbrutt: Altinn Storage avviste tilgangstokenet (401/403).";

    private sealed record EstateRow(Guid Id, string? CaseNumber, string InstanceId, DateTimeOffset Created);

    /// <param name="HeirRoles">The estate's heir roles (empty when not grouped); null when it could not be checked.</param>
    private readonly record struct CheckResult(
        IReadOnlyList<string>? HeirRoles,
        string? FailureReason,
        string? Detail)
    {
        public static readonly CheckResult MatchWithoutRoles = new([], null, null);
        public static CheckResult Match(IReadOnlyList<string> heirRoles) => new(heirRoles, null, null);
        public static CheckResult Failure(string reason, string? detail) => new(null, reason, detail);
    }

    private sealed class StorageAccessDeniedException(Exception inner)
        : Exception(AccessDeniedError, inner);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var trigger = await channel.Reader.ReadAsync(stoppingToken);
                await RunCount(trigger, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An exception occured while reading estate count triggers");
                state.EndRun(EstateCountStatus.Faulted);
            }
        }
    }

    private async Task RunCount(EstateCountTrigger trigger, CancellationToken stoppingToken)
    {
        // Linked so that both operator cancellation and application shutdown travel one path.
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        state.SetCancellationSource(cts);

        var filters = trigger.Filters;
        logger.LogInformation(
            "Estate count started at {Timestamp} by {StartedBy}. Created {From}..{To}, CaseStatuses: [{CaseStatuses}], GroupByHeirRoles: {GroupByHeirRoles}",
            trigger.Timestamp, trigger.StartedBy, filters.CreatedFrom, filters.CreatedTo,
            string.Join(", ", filters.CaseStatuses), filters.GroupByHeirRoles);

        var finalStatus = EstateCountStatus.Completed;
        string? error = null;
        try
        {
            var total = await CountEstates(filters, cts.Token);
            state.SetTotal(total);
            logger.LogInformation("Estate count selected {Total} estates", total);

            using var runScope = scopeFactory.CreateScope();
            // Resolved once for the whole run, as in DeclarationPdfMigrationService.
            var client = runScope.ServiceProvider.GetRequiredService<IAltinnClient>();

            (DateTimeOffset Created, Guid Id)? cursor = null;
            while (true)
            {
                cts.Token.ThrowIfCancellationRequested();

                var chunk = await ReadChunk(filters, cursor, cts.Token);
                if (chunk.Count == 0)
                    break;

                if (!filters.GroupByHeirRoles)
                {
                    foreach (var row in chunk)
                        Record(row, CheckResult.MatchWithoutRoles);
                }
                else
                {
                    await Parallel.ForEachAsync(
                        chunk,
                        new ParallelOptions
                        {
                            MaxDegreeOfParallelism = MaxConcurrency,
                            CancellationToken = cts.Token
                        },
                        async (row, cancellationToken) =>
                            Record(row, await CheckEstateWithRetry(client, row, cancellationToken)));
                }

                var last = chunk[^1];
                cursor = (last.Created, last.Id);

                if (chunk.Count < BatchSize)
                    break;
            }
        }
        catch (OperationCanceledException)
        {
            finalStatus = EstateCountStatus.Cancelled;
        }
        catch (StorageAccessDeniedException ex)
        {
            logger.LogError(ex, "Aborting the estate count: Storage refused the access token");
            finalStatus = EstateCountStatus.Faulted;
            error = AccessDeniedError;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An exception occured during the estate count");
            finalStatus = EstateCountStatus.Faulted;
            error = $"{ex.GetType().Name}: {ex.Message}";
        }
        finally
        {
            state.SetCancellationSource(null);
            state.EndRun(finalStatus, error);

            logger.LogInformation(
                "Estate count {Status}. Processed {Processed}. Matches: {MatchCount}. Failures: {FailureCount}",
                finalStatus, state.Processed, state.MatchCount, state.FailureCount);
        }
    }

    private static IQueryable<Database.Oed.Model.Estate> ApplyFilters(
        IQueryable<Database.Oed.Model.Estate> query,
        EstateCountFilters filters)
    {
        var (from, toExclusive) = filters.CreatedRangeUtc();
        query = query.Where(estate => estate.Created >= from && estate.Created < toExclusive);

        if (filters.CaseStatuses.Count > 0)
        {
            var includeNoStatus = filters.CaseStatuses.Contains(EstateCountOptions.NoStatus);
            var statuses = filters.CaseStatuses.Where(status => status != EstateCountOptions.NoStatus).ToList();

            query = query.Where(estate =>
                (estate.CaseStatus != null && statuses.Contains(estate.CaseStatus)) ||
                (includeNoStatus && estate.CaseStatus == null));
        }

        return query;
    }

    private async Task<int> CountEstates(EstateCountFilters filters, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<OedDbContext>();

        return await ApplyFilters(dbContext.Estate.AsNoTracking(), filters).CountAsync(cancellationToken);
    }

    /// <summary>
    /// One keyset page on (Created, Id). A scope per chunk, so no connection is held while the
    /// chunk's Storage lookups run. Estates created during the run may or may not be included.
    /// </summary>
    private async Task<List<EstateRow>> ReadChunk(
        EstateCountFilters filters,
        (DateTimeOffset Created, Guid Id)? cursor,
        CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<OedDbContext>();

        var query = ApplyFilters(dbContext.Estate.AsNoTracking(), filters);

        if (cursor is { } after)
        {
            // Row-value comparison, (created, id) > (@created, @id) - Npgsql translates this.
            query = query.Where(estate => EF.Functions.GreaterThan(
                ValueTuple.Create(estate.Created, estate.Id),
                ValueTuple.Create(after.Created, after.Id)));
        }

        return await query
            .OrderBy(estate => estate.Created)
            .ThenBy(estate => estate.Id)
            .Take(BatchSize)
            .Select(estate => new EstateRow(estate.Id, estate.CaseNumber, estate.InstanceId, estate.Created))
            .ToListAsync(cancellationToken);
    }

    private async Task<CheckResult> CheckEstateWithRetry(
        IAltinnClient client,
        EstateRow row,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await CheckEstate(client, row);
            }
            catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            {
                // Every other estate would fail the same way - stop the run rather than record
                // thousands of identical failures.
                throw new StorageAccessDeniedException(ex);
            }
            catch (Exception ex) when (IsTransient(ex, cancellationToken) && attempt < MaxAttempts)
            {
                var delay = RetryDelay(attempt);
                logger.LogWarning(
                    ex,
                    "Estate {EstateId}: {Error} on attempt {Attempt} - retrying in {Delay}",
                    row.Id, ex.Message, attempt, delay);
                await Task.Delay(delay, cancellationToken);
            }
            // Exhausted retries and non-transient HTTP errors are this estate's failure; anything
            // else is unexpected and faults the run.
            catch (Exception ex) when (ex is HttpRequestException || IsTransient(ex, cancellationToken))
            {
                var status = (ex as HttpRequestException)?.StatusCode;
                return CheckResult.Failure("StorageError", status is null ? ex.Message : $"HTTP {(int)status}: {ex.Message}");
            }
        }
    }

    private static async Task<CheckResult> CheckEstate(IAltinnClient client, EstateRow row)
    {
        var parts = row.InstanceId.Split('/');
        if (parts.Length != 2 ||
            !int.TryParse(parts[0], out var instanceOwnerPartyId) ||
            !Guid.TryParse(parts[1], out var instanceGuid))
        {
            return CheckResult.Failure("InvalidInstanceId", row.InstanceId);
        }

        var instance = await client.GetInstance(instanceOwnerPartyId, instanceGuid);
        if (instance is null)
            return CheckResult.Failure("NoOedInstance", null);

        // Same data element rule as InstanceToDbDataMigration.
        var dataElement = instance.Data?.Find(element =>
            element.DataType == "oed" &&
            element.ContentType == "application/xml");

        if (dataElement is null || !Guid.TryParse(dataElement.Id, out var dataGuid))
            return CheckResult.Failure("NoDataElement", null);

        OedInstanceData data;
        try
        {
            data = await client.GetInstanceData<OedInstanceData>(instanceOwnerPartyId, instanceGuid, dataGuid);
        }
        catch (InvalidOperationException ex)
        {
            // XmlSerializer wraps every parse error in an InvalidOperationException.
            return CheckResult.Failure("InvalidData", ex.InnerException?.Message ?? ex.Message);
        }

        return CheckResult.Match(HeirRoles(data));
    }

    /// <summary>
    /// Every distinct role held by at least one heir - the estate's groups in the result. Not
    /// HeirInfo.GetHeir(), which throws when neither Heir nor HeirV2 is set; such an entry, like a
    /// heir without a role, simply contributes nothing.
    /// </summary>
    private static List<string> HeirRoles(OedInstanceData data) =>
        (data.Heirs ?? [])
            .Select(heirInfo => (heirInfo?.HeirV2 ?? heirInfo?.Heir)?.Role)
            .OfType<string>()
            .Where(role => role.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

    // The HTTP clients get no cancellation token, so a TaskCanceledException that is not ours is
    // an HttpClient timeout. A run outlives several Maskinporten tokens, so a failed token
    // refresh is retried like any other blip rather than faulting the whole run.
    private static bool IsTransient(Exception ex, CancellationToken cancellationToken) => ex switch
    {
        TokenRequestException => true,
        HttpRequestException { StatusCode: null } => true,
        HttpRequestException { StatusCode: HttpStatusCode.TooManyRequests } => true,
        HttpRequestException { StatusCode: { } status } => (int)status >= 500,
        TaskCanceledException => !cancellationToken.IsCancellationRequested,
        _ => false
    };

    private void Record(EstateRow row, CheckResult result)
    {
        int processed;
        if (result.FailureReason is { } reason)
        {
            logger.LogWarning("Estate {EstateId} could not be checked: {Reason} - {Detail}", row.Id, reason, result.Detail);
            processed = state.RecordFailure(new EstateCountFailure(row.Id, reason, result.Detail));
        }
        else
        {
            processed = state.RecordMatch(new EstateMatch(row.Id, row.CaseNumber, result.HeirRoles ?? []));
        }

        if (processed % HeartbeatEvery == 0)
            logger.LogInformation("Estate count progress: {Processed} estates processed", processed);
    }

    // 2s, 6s plus jitter, as in DeclarationPdfMigrationService.
    private static TimeSpan RetryDelay(int attempt) =>
        TimeSpan.FromSeconds(2 * Math.Pow(3, attempt - 1)) + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 1000));
}
