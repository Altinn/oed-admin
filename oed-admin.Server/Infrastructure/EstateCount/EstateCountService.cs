using System.Diagnostics;
using System.Net;
using System.Threading.Channels;
using Altinn.ApiClients.Maskinporten.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.OedModel;

namespace oed_admin.Server.Infrastructure.EstateCount;

/// <summary>
/// Counts the estates matching a set of filters. Created date and case status are answered by
/// the oed database; heir roles only exist in OED_M, so the model is only read when the count is
/// grouped by heir role. It is read through <see cref="IOedModelSource"/>: from the estate's
/// oed.estate_model row when it has one, from Storage otherwise.
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

    internal sealed record EstateRow(Guid Id, string? CaseNumber, string InstanceId, DateTimeOffset Created);

    /// <param name="HeirRoles">The estate's heir roles (empty when not grouped); null when it could not be checked.</param>
    internal readonly record struct CheckResult(
        IReadOnlyList<string>? HeirRoles,
        string? FailureReason,
        string? Detail)
    {
        public static readonly CheckResult MatchWithoutRoles = new([], null, null);
        public static CheckResult Match(IReadOnlyList<string> heirRoles) => new(heirRoles, null, null);
        public static CheckResult Failure(string reason, string? detail) => new(null, reason, detail);
    }

    public sealed class StorageAccessDeniedException(Exception inner)
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
                        {
                            // A scope per estate: the source reads through a DbContext, which isn't thread-safe,
                            // and the contexts are pooled.
                            await using var scope = scopeFactory.CreateAsyncScope();
                            var source = scope.ServiceProvider.GetRequiredService<IOedModelSource>();
                            Record(row, await CheckEstateWithRetry(source, row, cancellationToken));
                        });
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
        IOedModelSource source,
        EstateRow row,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                return await CheckEstate(source, row, cancellationToken);
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
            // else (a non-transient database error included) is unexpected and faults the run.
            catch (Exception ex) when (ex is HttpRequestException || IsTransient(ex, cancellationToken))
            {
                return ExhaustedFailure(ex);
            }
        }

        // The last attempt always returns or throws above.
        throw new UnreachableException();
    }

    internal static async Task<CheckResult> CheckEstate(
        IOedModelSource source,
        EstateRow row,
        CancellationToken cancellationToken)
    {
        var parts = row.InstanceId.Split('/');
        if (parts.Length != 2 ||
            !int.TryParse(parts[0], out var instanceOwnerPartyId) ||
            !Guid.TryParse(parts[1], out var instanceGuid))
        {
            return CheckResult.Failure("InvalidInstanceId", row.InstanceId);
        }

        OedModelResult result;
        try
        {
            result = await source.Get(instanceOwnerPartyId, instanceGuid, cancellationToken);
        }
        catch (OedModelUnreadableException ex)
        {
            // The row's JSON or the Storage XML. A row is still the estate's only truth, so no Storage fallback.
            return CheckResult.Failure("InvalidData", ex.Message);
        }

        return result switch
        {
            { Model: { } model } => CheckResult.Match(ReadHeirRoles(model)),
            { Missing: OedModelMissing.NoDataElement } => CheckResult.Failure("NoDataElement", null),
            { Missing: OedModelMissing.PartyMismatch } => CheckResult.Failure("NoOedInstance", "PartyMismatch"),
            _ => CheckResult.Failure("NoOedInstance", null),
        };
    }

    /// <summary>
    /// Every distinct role held by at least one heir - the estate's groups in the result. Not
    /// HeirInfo.GetHeir(), which throws when neither Heir nor HeirV2 is set; such an entry, like a
    /// heir without a role, simply contributes nothing.
    /// </summary>
    private static List<string> ReadHeirRoles(OedInstanceData data) =>
        (data.Heirs ?? [])
            .Select(heirInfo => (heirInfo?.HeirV2 ?? heirInfo?.Heir)?.Role)
            .OfType<string>()
            .Where(role => role.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

    // The HTTP clients get no cancellation token, so a TaskCanceledException that is not ours is
    // an HttpClient timeout. A run outlives several Maskinporten tokens, so a failed token
    // refresh is retried like any other blip rather than faulting the whole run.
    // Every estate is now also a database lookup (its oed.estate_model row), so a database blip is
    // retried the same way instead of faulting a run of thousands of estates.
    internal static bool IsTransient(Exception ex, CancellationToken cancellationToken) => ex switch
    {
        TokenRequestException => true,
        NpgsqlException { IsTransient: true } => true,
        HttpRequestException { StatusCode: null } => true,
        HttpRequestException { StatusCode: HttpStatusCode.TooManyRequests } => true,
        HttpRequestException { StatusCode: { } status } => (int)status >= 500,
        TaskCanceledException => !cancellationToken.IsCancellationRequested,
        _ => false
    };

    /// <summary>An estate whose retries ran out, or that failed with a non-transient HTTP error.</summary>
    internal static CheckResult ExhaustedFailure(Exception ex)
    {
        if (ex is NpgsqlException)
            return CheckResult.Failure("DatabaseError", ex.Message);

        var status = (ex as HttpRequestException)?.StatusCode;
        return CheckResult.Failure("StorageError", status is null ? ex.Message : $"HTTP {(int)status}: {ex.Message}");
    }

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
