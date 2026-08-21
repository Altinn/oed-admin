using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Infrastructure.DeclarationPdfMigration;

/// <summary>
/// Drives the one-time backfill that copies the skifteerklæring PDF from each estate's
/// oed-declaration instance onto its oed instance, by calling the oed app once per estate.
/// </summary>
public class DeclarationPdfMigrationService(
    IServiceScopeFactory scopeFactory,
    Channel<DeclarationPdfMigrationTrigger> channel,
    DeclarationPdfMigrationState state,
    ILogger<DeclarationPdfMigrationService> logger)
    : BackgroundService
{
    private const int MaxConcurrency = 4;
    private const int MaxAttempts = 3;
    private const int HeartbeatEvery = 250;

    private const string AbortedError =
        "Aborted: the oed endpoint refused the access token (401/403). Is the digdir:dd:systemadmin scope provisioned for oed-admin?";

    private enum Disposition { Done, Skipped, PermanentFailure, Retryable, Abort }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var trigger = await channel.Reader.ReadAsync(stoppingToken);
                await RunMigration(trigger, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An exception occured while reading declaration pdf migration triggers");
                state.EndRun(RunStatus.Faulted);
            }
        }
    }

    private async Task RunMigration(DeclarationPdfMigrationTrigger trigger, CancellationToken stoppingToken)
    {
        // Linked so that both operator cancellation and application shutdown travel one path.
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        state.SetCancellationSource(cts);

        logger.LogInformation(
            "Declaration pdf migration started at {Timestamp}. Limit: {Limit}, Overwrite: {Overwrite}, DryRun: {DryRun}",
            trigger.Timestamp, trigger.Limit, trigger.Overwrite, trigger.DryRun);

        var finalStatus = RunStatus.Completed;
        string? error = null;
        try
        {
            var estateIds = await GetEstateIds(trigger.Limit, cts.Token);
            state.SetTotal(estateIds.Count);
            logger.LogInformation("Declaration pdf migration selected {Total} estates", estateIds.Count);

            if (trigger.DryRun)
            {
                logger.LogInformation("Dry run - no calls were made to the oed endpoint");
            }
            else
            {
                using var runScope = scopeFactory.CreateScope();
                // Resolved once for the whole run: a sweep is hours long, and the alternative
                // is a scope per estate for no practical gain against a single stable host.
                var client = runScope.ServiceProvider.GetRequiredService<IOedSystemAdminClient>();

                await Parallel.ForEachAsync(
                    estateIds,
                    new ParallelOptions
                    {
                        MaxDegreeOfParallelism = MaxConcurrency,
                        CancellationToken = cts.Token
                    },
                    async (estateId, cancellationToken) =>
                        await ProcessEstate(client, estateId, trigger.Overwrite, cts, cancellationToken));
            }
        }
        catch (OperationCanceledException)
        {
            finalStatus = state.AbortRequested ? RunStatus.Aborted : RunStatus.Cancelled;
            if (state.AbortRequested)
                error = AbortedError;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An exception occured during the declaration pdf migration");
            finalStatus = state.AbortRequested ? RunStatus.Aborted : RunStatus.Faulted;
            error = $"{ex.GetType().Name}: {ex.Message}";
        }
        finally
        {
            if (finalStatus == RunStatus.Completed && state.AbortRequested)
            {
                finalStatus = RunStatus.Aborted;
                error ??= AbortedError;
            }

            state.SetCancellationSource(null);
            state.EndRun(finalStatus, error);

            // Index 0: the summary wants the whole run, not an increment.
            var snapshot = state.GetSnapshot(0);
            logger.LogInformation(
                "Declaration pdf migration {Status}. Processed {Processed} of {Total}. Failures: {FailureCount}. Outcomes: {Outcomes}",
                finalStatus, snapshot.Processed, snapshot.Total, snapshot.FailureCount,
                string.Join(", ", snapshot.Outcomes.Where(pair => pair.Value > 0).Select(pair => $"{pair.Key}={pair.Value}")));
        }
    }

    private async Task<List<Guid>> GetEstateIds(int? limit, CancellationToken cancellationToken)
    {
        // A scope of its own: the connection is released before the hours-long HTTP phase,
        // and nothing after this point touches the database.
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<OedDbContext>();

        // Only submitted declarations: the ref-data-as-pdf element only exists once a
        // declaration has been submitted.
        var query = dbContext.Estate
            .AsNoTracking()
            .Where(estate => estate.DeclarationInstanceId != null && estate.DeclarationSubmitted != null)
            .OrderBy(estate => estate.Created)
            .Select(estate => estate.Id);

        if (limit is > 0)
            query = query.Take(limit.Value);

        return await query.ToListAsync(cancellationToken);
    }

    private async Task ProcessEstate(
        IOedSystemAdminClient client,
        Guid estateId,
        bool overwrite,
        CancellationTokenSource cts,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            var result = await client.MigrateDeclarationPdf(estateId, overwrite, cancellationToken);
            var disposition = Classify(result);

            if (disposition == Disposition.Retryable && attempt < MaxAttempts)
            {
                var delay = RetryDelay(attempt);
                logger.LogWarning(
                    "Estate {EstateId} failed with [{Status}] {Reason} on attempt {Attempt} - retrying in {Delay}",
                    estateId, result.HttpStatus, result.Reason, attempt, delay);
                await Task.Delay(delay, cancellationToken);
                continue;
            }

            Record(estateId, result, disposition);

            if (disposition == Disposition.Abort)
            {
                logger.LogError(
                    "Aborting the declaration pdf migration: the oed endpoint answered [{Status}] for estate {EstateId}. Is the digdir:dd:systemadmin scope provisioned for oed-admin?",
                    result.HttpStatus, estateId);
                state.RequestAbort();
                await cts.CancelAsync();
            }

            return;
        }
    }

    /// <summary>
    /// Branches on reason rather than status: two reasons share 404 and three share 409.
    /// An unknown reason is a permanent failure, so a future addition to the taxonomy
    /// cannot become an infinite retry loop.
    /// </summary>
    private static Disposition Classify(MigrateDeclarationPdfResult result)
    {
        if (result.HttpStatus is >= 200 and < 300)
            return Disposition.Done;

        if (result.HttpStatus is 401 or 403)
            return Disposition.Abort;

        return result.Reason switch
        {
            "AlreadyMigrated" => Disposition.Done,
            "NoPdfOnDeclaration" => Disposition.Skipped,
            "StorageError" => Disposition.Retryable,
            _ => Disposition.PermanentFailure
        };
    }

    private void Record(Guid estateId, MigrateDeclarationPdfResult result, Disposition disposition)
    {
        var isSuccess = result.HttpStatus is >= 200 and < 300;

        // The real reason/outcome string from the oed endpoint, kept intact for logging and for
        // the failure list - unlike the folded key below, it must not lose an unrecognised value
        // to "Unknown", since a new failure mode is exactly what needs to stay diagnosable.
        var reason = (isSuccess ? result.Outcome : result.Reason) ?? "Unknown";

        // Folded to the bounded set RecordOutcome's fixed counters understand.
        var key = reason;
        if (!DeclarationPdfMigrationState.OutcomeKeys.Contains(key))
            key = "Unknown";

        var processed = state.RecordOutcome(key);

        if (disposition is Disposition.Done or Disposition.Skipped)
        {
            logger.LogDebug("Estate {EstateId}: {Outcome}", estateId, reason);
        }
        else
        {
            logger.LogWarning("Estate {EstateId} failed: [{Status}] {Reason} - {Detail}",
                estateId, result.HttpStatus, reason, result.Detail);
            state.RecordFailure(new MigrationFailure(estateId, reason, result.Detail, result.HttpStatus));
        }

        if (processed % HeartbeatEvery == 0)
            logger.LogInformation("Declaration pdf migration progress: {Processed} estates processed", processed);
    }

    // 2s, 6s plus jitter (MaxAttempts is 3, so only the first two delays are ever used), so
    // four workers backing off together do not resynchronise.
    private static TimeSpan RetryDelay(int attempt) =>
        TimeSpan.FromSeconds(2 * Math.Pow(3, attempt - 1)) + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 1000));
}
