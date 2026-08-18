# Declaration-PDF Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `oed-admin` a manually triggered background sweep that finds every estate with a submitted declaration and calls the `oed` app's declaration-PDF migration endpoint for each, reporting live progress to an admin page.

**Architecture:** A channel-triggered `BackgroundService` reads a trigger written by a `POST` endpoint, enumerates estate ids from the `oed` database once, then calls the `oed` endpoint at concurrency 4 through a new Maskinporten-scoped typed HTTP client. A singleton state object holds counters and the failure list; a Server-Sent Events endpoint streams snapshots of it to a React page, which reads the stream with `fetchWithMsal` because `EventSource` cannot send a bearer token.

**Tech Stack:** ASP.NET Core 10 minimal APIs, EF Core (`OedDbContext`), `System.Threading.Channels`, `Altinn.ApiClients.Maskinporten`, `TypedResults.ServerSentEvents`, React 19 + TypeScript, Digdir Designsystemet.

**Spec:** `docs/superpowers/specs/2026-08-18-declaration-pdf-migration-design.md`

## Global Constraints

- **No EF Core migrations.** This repo attaches to databases owned by other services. Never add a migration; never change the schema.
- **Every new endpoint must be registered in `oed-admin.Server/Features/Endpoints.cs`.** A feature folder does nothing until it is.
- All three new endpoints live under the existing `/api/maintenance` group, which already carries `AuthorizationPolicies.RequireAdminRole`. Do not add a per-route policy.
- **Maskinporten scope: `digdir:dd:systemadmin`** — exactly this string, on the new client only. The existing `digdir:dd:probatedeclarations` does **not** authorize the endpoint.
- **Target endpoint path:** `POST {AppsUrl}/digdir/oed/api/admin/declaration-pdf`, body `{ "estateId": <guid>, "overwrite": <bool> }`.
- **Branch on `reason`, never on the status code.** Two reasons share `404`, three share `409`.
- `AlreadyMigrated` is a **success**, not an error.
- The failure list is **uncapped** — every failure must reach the UI.
- User-facing SPA text is **Norwegian**. Server logs and code are English.
- **No test project.** There is no unit test framework in this repo and none is being added (spec §10). Server tasks are verified with `dotnet build` plus application startup; behavioural verification happens end to end in Task 7.
- `dotnet build` does **not** build the SPA. Type errors surface only under `npm run build`.

## Before you start

The current branch is `main`. Create a feature branch first:

```bash
git checkout -b feat/declaration-pdf-migration
```

All commands below are run from the repo root unless the task says otherwise.

## File structure

| File | Responsibility |
|---|---|
| `oed-admin.Server/Infrastructure/Altinn/OedSystemAdminClient.cs` | *(new)* Typed client for the `oed` admin API, plus its request/response/result records. Returns failures as data instead of throwing. |
| `oed-admin.Server/Infrastructure/Altinn/ServiceCollectionExtensions.cs` | *(modify)* Register the client with the `digdir:dd:systemadmin` scope. |
| `oed-admin.Server/Infrastructure/DeclarationPdfMigration/DeclarationPdfMigrationTrigger.cs` | *(new)* The trigger record. |
| `oed-admin.Server/Infrastructure/DeclarationPdfMigration/DeclarationPdfMigrationState.cs` | *(new)* Run status enum, failure record, snapshot record, and the singleton holding all run state. |
| `oed-admin.Server/Infrastructure/DeclarationPdfMigration/DeclarationPdfMigrationService.cs` | *(new)* The `BackgroundService`: enumerate, classify, retry, record. |
| `oed-admin.Server/Infrastructure/DeclarationPdfMigration/ServiceCollectionExtensions.cs` | *(new)* `AddDeclarationPdfMigration()`. |
| `oed-admin.Server/Program.cs` | *(modify)* Call `AddDeclarationPdfMigration()`. |
| `oed-admin.Server/Features/Maintenance/DeclarationPdfMigration/StartMigration/Endpoint.cs` | *(new)* `POST` — validate, guard, enqueue. |
| `oed-admin.Server/Features/Maintenance/DeclarationPdfMigration/CancelMigration/Endpoint.cs` | *(new)* `DELETE` — cancel the active run. |
| `oed-admin.Server/Features/Maintenance/DeclarationPdfMigration/GetProgress/Endpoint.cs` | *(new)* `GET` — SSE snapshot stream. |
| `oed-admin.Server/Features/Endpoints.cs` | *(modify)* Register the three routes. |
| `oed-admin.Server/Infrastructure/Auditing/AuditingLoggingMiddleware.cs` | *(modify)* Guard an empty response body before deserialising. |
| `oed-admin.client/src/utils/sseReader.ts` | *(new)* Generic `fetch`-based SSE frame reader. |
| `oed-admin.client/src/components/declarationPdfMigration/useMigrationProgress.ts` | *(new)* Hook: opens the stream, accumulates failures, exposes snapshot state. |
| `oed-admin.client/src/components/declarationPdfMigration/index.tsx` | *(new)* The page. |
| `oed-admin.client/src/App.tsx` | *(modify)* Route + admin-only dropdown menu link. |

---

### Task 1: Outbound client for the oed admin API

**Files:**
- Create: `oed-admin.Server/Infrastructure/Altinn/OedSystemAdminClient.cs`
- Modify: `oed-admin.Server/Infrastructure/Altinn/ServiceCollectionExtensions.cs`

**Interfaces:**
- Consumes: `AltinnSettings.AppsUrl`, `MaskinportenSettings`, `AppIds.Oed` (all existing).
- Produces:
  - `IOedSystemAdminClient.MigrateDeclarationPdf(Guid estateId, bool overwrite, CancellationToken cancellationToken) → Task<MigrateDeclarationPdfResult>`
  - `record MigrateDeclarationPdfResult(int HttpStatus, string? Outcome, string? Reason, string? Detail)` — `HttpStatus` is `0` for a transport failure or client timeout, in which case `Reason` is `"StorageError"`.

- [ ] **Step 1: Create the client file**

Create `oed-admin.Server/Infrastructure/Altinn/OedSystemAdminClient.cs`:

```csharp
using System.Net.Http.Json;
using System.Text.Json;

namespace oed_admin.Server.Infrastructure.Altinn;

/// <summary>
/// Client for the oed app's admin API (Maskinporten scope digdir:dd:systemadmin).
/// See the consumer guide in the oed repo: docs/migrate-declaration-pdf-consumer-guide.md
/// </summary>
public interface IOedSystemAdminClient
{
    Task<MigrateDeclarationPdfResult> MigrateDeclarationPdf(
        Guid estateId,
        bool overwrite,
        CancellationToken cancellationToken);
}

/// <param name="HttpStatus">The HTTP status, or 0 when the call never produced a response.</param>
/// <param name="Outcome">"Copied" or "Overwritten" on 200, otherwise null.</param>
/// <param name="Reason">The ProblemDetails "reason" extension member, or "StorageError" for a transport failure.</param>
public record MigrateDeclarationPdfResult(int HttpStatus, string? Outcome, string? Reason, string? Detail);

public class OedSystemAdminClient(HttpClient httpClient, ILogger<OedSystemAdminClient> logger) : IOedSystemAdminClient
{
    private const string MigrateDeclarationPdfPath = $"/{AppIds.Oed}/api/admin/declaration-pdf";

    public async Task<MigrateDeclarationPdfResult> MigrateDeclarationPdf(
        Guid estateId,
        bool overwrite,
        CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            // Deliberately no EnsureSuccessStatusCode: the failure bodies are the contract.
            response = await httpClient.PostAsJsonAsync(
                MigrateDeclarationPdfPath,
                new { estateId, overwrite },
                cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            // A client-side timeout surfaces as TaskCanceledException with our own token uncancelled.
            // The consumer guide says to treat it like StorageError.
            return new MigrateDeclarationPdfResult(0, null, "StorageError", ex.Message);
        }

        using (response)
        {
            if (response.IsSuccessStatusCode)
            {
                var success = await ReadOrNull<MigrateDeclarationPdfSuccessBody>(response, cancellationToken);
                return new MigrateDeclarationPdfResult((int)response.StatusCode, success?.Outcome, null, null);
            }

            var problem = await ReadOrNull<MigrateDeclarationPdfProblemBody>(response, cancellationToken);
            return new MigrateDeclarationPdfResult(
                (int)response.StatusCode,
                null,
                problem?.Reason,
                problem?.Detail ?? problem?.Title);
        }
    }

    private async Task<T?> ReadOrNull<T>(HttpResponseMessage response, CancellationToken cancellationToken)
        where T : class
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<T>(cancellationToken);
        }
        catch (Exception ex) when (ex is JsonException or NotSupportedException)
        {
            // 401/403 have no body of our shape, and an unexpected body must not take the run down.
            logger.LogDebug(ex, "Unable to parse a {StatusCode} response from the oed admin API", (int)response.StatusCode);
            return null;
        }
    }

    // Parsed tolerantly: new fields may be added to either shape.
    private sealed record MigrateDeclarationPdfSuccessBody
    {
        public string? Outcome { get; init; }
        public string? OedInstanceId { get; init; }
        public string? DeclarationInstanceId { get; init; }
        public string? DataElementId { get; init; }
    }

    private sealed record MigrateDeclarationPdfProblemBody
    {
        public string? Title { get; init; }
        public int? Status { get; init; }
        public string? Detail { get; init; }
        public string? Reason { get; init; }
    }
}
```

- [ ] **Step 2: Register the client**

In `oed-admin.Server/Infrastructure/Altinn/ServiceCollectionExtensions.cs`, inside `AddAltinnClients`, immediately after the `IOedEventsClient` registration block and before the final `return services;`, add:

```csharp
        services
            .AddMaskinportenHttpClient<SettingsJwkClientDefinition, IOedSystemAdminClient, OedSystemAdminClient>(
                maskinportenSettings with
                {
                    Scope = "digdir:dd:systemadmin"
                },
                clientDefinition =>
                {
                    clientDefinition.ClientSettings.ExhangeToAltinnToken = false;
                    clientDefinition.ClientSettings.EnableDebugLogging = true;
                })
            .ConfigureHttpClient((provider, client) =>
            {
                var settings = provider.GetRequiredService<IOptionsMonitor<AltinnSettings>>();
                client.BaseAddress = new Uri(settings.CurrentValue.AppsUrl);
                // Each call blocks on two or three Altinn Storage round-trips.
                client.Timeout = TimeSpan.FromSeconds(60);
            });
```

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: build succeeds with no new warnings.

- [ ] **Step 4: Commit**

```bash
git add oed-admin.Server/Infrastructure/Altinn/OedSystemAdminClient.cs oed-admin.Server/Infrastructure/Altinn/ServiceCollectionExtensions.cs
git commit -m "feat: add oed admin API client for declaration-pdf migration"
```

---

### Task 2: Run state singleton

**Files:**
- Create: `oed-admin.Server/Infrastructure/DeclarationPdfMigration/DeclarationPdfMigrationTrigger.cs`
- Create: `oed-admin.Server/Infrastructure/DeclarationPdfMigration/DeclarationPdfMigrationState.cs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, all in namespace `oed_admin.Server.Infrastructure.DeclarationPdfMigration`:
  - `record DeclarationPdfMigrationTrigger(DateTimeOffset Timestamp, int? Limit, bool Overwrite, bool DryRun)`
  - `enum RunStatus { Idle, Running, Completed, Cancelled, Aborted, Faulted }`
  - `record MigrationFailure(Guid EstateId, string Reason, string? Detail, int Status)`
  - `record ProgressSnapshot(string Status, DateTimeOffset? StartedAt, DateTimeOffset? EndedAt, bool DryRun, bool Overwrite, int? Limit, int Total, int Processed, IReadOnlyDictionary<string, int> Outcomes, int FailureCount, IReadOnlyList<MigrationFailure> Failures)`
  - `class DeclarationPdfMigrationState` with `bool TryBeginRun(DeclarationPdfMigrationTrigger)`, `void SetCancellationSource(CancellationTokenSource?)`, `bool TryCancel()`, `void RequestAbort()`, `bool AbortRequested`, `void SetTotal(int)`, `int RecordOutcome(string)`, `void RecordFailure(MigrationFailure)`, `void EndRun(RunStatus)`, `ProgressSnapshot GetSnapshot(int fromFailureIndex)`, `int Processed`, `int FailureCount`

- [ ] **Step 1: Create the trigger record**

Create `oed-admin.Server/Infrastructure/DeclarationPdfMigration/DeclarationPdfMigrationTrigger.cs`:

```csharp
namespace oed_admin.Server.Infrastructure.DeclarationPdfMigration;

/// <param name="Limit">Maximum number of estates to process, or null for all of them.</param>
/// <param name="DryRun">Enumerate and report the count without calling the oed endpoint.</param>
public record DeclarationPdfMigrationTrigger(
    DateTimeOffset Timestamp,
    int? Limit,
    bool Overwrite,
    bool DryRun);
```

- [ ] **Step 2: Create the state singleton**

Create `oed-admin.Server/Infrastructure/DeclarationPdfMigration/DeclarationPdfMigrationState.cs`:

```csharp
using System.Collections.Concurrent;

namespace oed_admin.Server.Infrastructure.DeclarationPdfMigration;

public enum RunStatus { Idle, Running, Completed, Cancelled, Aborted, Faulted }

public record MigrationFailure(Guid EstateId, string Reason, string? Detail, int Status);

public record ProgressSnapshot(
    string Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? EndedAt,
    bool DryRun,
    bool Overwrite,
    int? Limit,
    int Total,
    int Processed,
    IReadOnlyDictionary<string, int> Outcomes,
    int FailureCount,
    IReadOnlyList<MigrationFailure> Failures);

/// <summary>
/// All state for the current (or most recently finished) declaration-pdf migration run.
/// Registered as a singleton; written by the background service, read by the SSE endpoint.
/// State is deliberately not persisted - a restart means starting the sweep again, which is
/// cheap because migrated estates return AlreadyMigrated.
/// </summary>
public class DeclarationPdfMigrationState
{
    /// <summary>Every counter key the UI can be shown. Anything else is folded into "Unknown".</summary>
    public static readonly IReadOnlyList<string> OutcomeKeys =
    [
        "Copied",
        "Overwritten",
        "AlreadyMigrated",
        "NoPdfOnDeclaration",
        "NoDeclarationInstance",
        "EstateNotFound",
        "InvalidEstateData",
        "StorageError",
        "Unknown"
    ];

    private readonly Lock _gate = new();
    private readonly List<MigrationFailure> _failures = [];
    private readonly ConcurrentDictionary<string, int> _outcomes = new();

    private RunStatus _status = RunStatus.Idle;
    private DeclarationPdfMigrationTrigger? _trigger;
    private DateTimeOffset? _startedAt;
    private DateTimeOffset? _endedAt;
    private CancellationTokenSource? _cancellationTokenSource;
    private int _total;
    private int _processed;
    private volatile bool _abortRequested;

    public int Processed => Volatile.Read(ref _processed);

    public bool AbortRequested => _abortRequested;

    public int FailureCount
    {
        get
        {
            lock (_gate) return _failures.Count;
        }
    }

    /// <summary>
    /// The single guard against two overlapping runs. Resets all state on success.
    /// </summary>
    public bool TryBeginRun(DeclarationPdfMigrationTrigger trigger)
    {
        lock (_gate)
        {
            if (_status == RunStatus.Running)
                return false;

            _status = RunStatus.Running;
            _trigger = trigger;
            _startedAt = trigger.Timestamp;
            _endedAt = null;
            _total = 0;
            _processed = 0;
            _abortRequested = false;
            _failures.Clear();
            _outcomes.Clear();
            return true;
        }
    }

    public void SetCancellationSource(CancellationTokenSource? cancellationTokenSource)
    {
        lock (_gate) _cancellationTokenSource = cancellationTokenSource;
    }

    /// <summary>Cancels the active run. Returns false when there is nothing to cancel.</summary>
    public bool TryCancel()
    {
        lock (_gate)
        {
            if (_status != RunStatus.Running || _cancellationTokenSource is null)
                return false;

            _cancellationTokenSource.Cancel();
            return true;
        }
    }

    /// <summary>Marks the run as aborting because the oed endpoint refused our token.</summary>
    public void RequestAbort() => _abortRequested = true;

    public void SetTotal(int total)
    {
        lock (_gate) _total = total;
    }

    /// <summary>Increments the counter for one outcome. Returns the new processed count.</summary>
    public int RecordOutcome(string outcomeKey)
    {
        _outcomes.AddOrUpdate(outcomeKey, 1, (_, count) => count + 1);
        return Interlocked.Increment(ref _processed);
    }

    public void RecordFailure(MigrationFailure failure)
    {
        lock (_gate) _failures.Add(failure);
    }

    public void EndRun(RunStatus status)
    {
        lock (_gate)
        {
            _status = status;
            _endedAt = DateTimeOffset.UtcNow;
            _cancellationTokenSource = null;
        }
    }

    /// <summary>
    /// A snapshot carrying only the failures from <paramref name="fromFailureIndex"/> onwards.
    /// The list is uncapped, so a stream sends everything once and then only what is new.
    /// </summary>
    public ProgressSnapshot GetSnapshot(int fromFailureIndex)
    {
        lock (_gate)
        {
            var from = Math.Clamp(fromFailureIndex, 0, _failures.Count);
            var newFailures = _failures.GetRange(from, _failures.Count - from);

            return new ProgressSnapshot(
                _status.ToString(),
                _startedAt,
                _endedAt,
                _trigger?.DryRun ?? false,
                _trigger?.Overwrite ?? false,
                _trigger?.Limit,
                _total,
                Volatile.Read(ref _processed),
                OutcomeKeys.ToDictionary(key => key, key => _outcomes.GetValueOrDefault(key, 0)),
                _failures.Count,
                newFailures);
        }
    }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: build succeeds. If the `Lock` type is unavailable, replace `private readonly Lock _gate = new();` with `private readonly object _gate = new();` — everything else is unchanged.

- [ ] **Step 4: Commit**

```bash
git add oed-admin.Server/Infrastructure/DeclarationPdfMigration/
git commit -m "feat: add declaration-pdf migration run state"
```

---

### Task 3: The background service

**Files:**
- Create: `oed-admin.Server/Infrastructure/DeclarationPdfMigration/DeclarationPdfMigrationService.cs`
- Create: `oed-admin.Server/Infrastructure/DeclarationPdfMigration/ServiceCollectionExtensions.cs`
- Modify: `oed-admin.Server/Program.cs`

**Interfaces:**
- Consumes: `IOedSystemAdminClient.MigrateDeclarationPdf` and `MigrateDeclarationPdfResult` (Task 1); `DeclarationPdfMigrationTrigger`, `DeclarationPdfMigrationState`, `RunStatus`, `MigrationFailure` (Task 2); `OedDbContext.Estate` (existing).
- Produces: `IServiceCollection.AddDeclarationPdfMigration()`, and a registered `Channel<DeclarationPdfMigrationTrigger>` singleton that Task 4's endpoint writes to.

- [ ] **Step 1: Create the background service**

Create `oed-admin.Server/Infrastructure/DeclarationPdfMigration/DeclarationPdfMigrationService.cs`:

```csharp
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
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An exception occured during the declaration pdf migration");
            finalStatus = RunStatus.Faulted;
        }
        finally
        {
            if (finalStatus == RunStatus.Completed && state.AbortRequested)
                finalStatus = RunStatus.Aborted;

            state.SetCancellationSource(null);
            state.EndRun(finalStatus);

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
        var key = (result.HttpStatus is >= 200 and < 300 ? result.Outcome : result.Reason) ?? "Unknown";
        if (!DeclarationPdfMigrationState.OutcomeKeys.Contains(key))
            key = "Unknown";

        var processed = state.RecordOutcome(key);

        if (disposition is Disposition.Done or Disposition.Skipped)
        {
            logger.LogDebug("Estate {EstateId}: {Outcome}", estateId, key);
        }
        else
        {
            logger.LogWarning("Estate {EstateId} failed: [{Status}] {Reason} - {Detail}",
                estateId, result.HttpStatus, key, result.Detail);
            state.RecordFailure(new MigrationFailure(estateId, key, result.Detail, result.HttpStatus));
        }

        if (processed % HeartbeatEvery == 0)
            logger.LogInformation("Declaration pdf migration progress: {Processed} estates processed", processed);
    }

    // 2s, 6s, 18s plus jitter, so four workers backing off together do not resynchronise.
    private static TimeSpan RetryDelay(int attempt) =>
        TimeSpan.FromSeconds(2 * Math.Pow(3, attempt - 1)) + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 1000));
}
```

- [ ] **Step 2: Create the DI extension**

Create `oed-admin.Server/Infrastructure/DeclarationPdfMigration/ServiceCollectionExtensions.cs`:

```csharp
using System.Threading.Channels;

namespace oed_admin.Server.Infrastructure.DeclarationPdfMigration;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddDeclarationPdfMigration(this IServiceCollection services)
    {
        // Capacity 1 and DropWrite: the run guard in DeclarationPdfMigrationState is the real
        // gate, and a queued second sweep is never something anyone wants.
        var channel = Channel.CreateBounded<DeclarationPdfMigrationTrigger>(
            new BoundedChannelOptions(1)
            {
                SingleReader = true,
                FullMode = BoundedChannelFullMode.DropWrite
            });

        services.AddSingleton(channel);
        services.AddSingleton<DeclarationPdfMigrationState>();
        services.AddHostedService<DeclarationPdfMigrationService>();

        return services;
    }
}
```

- [ ] **Step 3: Register it in Program.cs**

In `oed-admin.Server/Program.cs`, add the using with the others:

```csharp
using oed_admin.Server.Infrastructure.DeclarationPdfMigration;
```

and add this line immediately after `builder.Services.AddOedFeedPollerClient(builder.Configuration);`:

```csharp
builder.Services.AddDeclarationPdfMigration();
```

- [ ] **Step 4: Build and start**

Run: `dotnet build`
Expected: build succeeds.

Run: `dotnet run --project oed-admin.Server`
Expected: the app starts and stays up. The hosted service is idle, so nothing is logged by it. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add oed-admin.Server/Infrastructure/DeclarationPdfMigration/ oed-admin.Server/Program.cs
git commit -m "feat: add declaration-pdf migration background service"
```

---

### Task 4: The three endpoints

**Files:**
- Create: `oed-admin.Server/Features/Maintenance/DeclarationPdfMigration/StartMigration/Endpoint.cs`
- Create: `oed-admin.Server/Features/Maintenance/DeclarationPdfMigration/CancelMigration/Endpoint.cs`
- Create: `oed-admin.Server/Features/Maintenance/DeclarationPdfMigration/GetProgress/Endpoint.cs`
- Modify: `oed-admin.Server/Features/Endpoints.cs`
- Modify: `oed-admin.Server/Infrastructure/Auditing/AuditingLoggingMiddleware.cs`

**Interfaces:**
- Consumes: `DeclarationPdfMigrationState`, `DeclarationPdfMigrationTrigger`, `RunStatus`, `ProgressSnapshot` (Task 2); the registered `Channel<DeclarationPdfMigrationTrigger>` (Task 3).
- Produces: the three HTTP routes the SPA calls in Tasks 5 and 6.

- [ ] **Step 1: Create the start endpoint**

Create `oed-admin.Server/Features/Maintenance/DeclarationPdfMigration/StartMigration/Endpoint.cs`:

```csharp
using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.DeclarationPdfMigration;

namespace oed_admin.Server.Features.Maintenance.DeclarationPdfMigration.StartMigration;

/// <param name="Limit">Maximum number of estates to process, or null for all of them.</param>
public record Request(int? Limit, bool Overwrite, bool DryRun)
{
    public bool IsValid() => Limit is null or > 0;
}

public record Response(string Status);

public static class Endpoint
{
    public static IResult Post(
        [FromBody] Request request,
        [FromServices] DeclarationPdfMigrationState state,
        [FromServices] Channel<DeclarationPdfMigrationTrigger> channel)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var trigger = new DeclarationPdfMigrationTrigger(
            DateTimeOffset.UtcNow,
            request.Limit,
            request.Overwrite,
            request.DryRun);

        // The state guard, not the channel, is what prevents two overlapping runs. Marking the
        // run active before responding means a client that connects to the progress stream
        // immediately sees Running rather than Idle.
        if (!state.TryBeginRun(trigger))
            return TypedResults.Conflict();

        if (!channel.Writer.TryWrite(trigger))
        {
            state.EndRun(RunStatus.Faulted);
            return TypedResults.Conflict();
        }

        // A JSON body, not an empty one: AuditingLoggingMiddleware buffers and parses the
        // response of any POST that has a request body.
        return TypedResults.Accepted(string.Empty, new Response("Started"));
    }
}
```

- [ ] **Step 2: Create the cancel endpoint**

Create `oed-admin.Server/Features/Maintenance/DeclarationPdfMigration/CancelMigration/Endpoint.cs`:

```csharp
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.DeclarationPdfMigration;

namespace oed_admin.Server.Features.Maintenance.DeclarationPdfMigration.CancelMigration;

public static class Endpoint
{
    public static IResult Delete([FromServices] DeclarationPdfMigrationState state) =>
        state.TryCancel()
            ? TypedResults.Accepted(string.Empty)
            : TypedResults.NotFound();
}
```

- [ ] **Step 3: Create the progress (SSE) endpoint**

Create `oed-admin.Server/Features/Maintenance/DeclarationPdfMigration/GetProgress/Endpoint.cs`:

```csharp
using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.DeclarationPdfMigration;

namespace oed_admin.Server.Features.Maintenance.DeclarationPdfMigration.GetProgress;

public static class Endpoint
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(1);

    public static IResult Get(
        HttpContext httpContext,
        [FromServices] DeclarationPdfMigrationState state,
        CancellationToken cancellationToken)
    {
        httpContext.Response.Headers.CacheControl = "no-store";
        // Belt and braces for reverse proxies that would otherwise buffer the stream.
        httpContext.Response.Headers["X-Accel-Buffering"] = "no";

        return TypedResults.ServerSentEvents(StreamSnapshots(state, cancellationToken));
    }

    /// <summary>
    /// The first snapshot on a connection carries every failure so far; later snapshots carry
    /// only what was appended since this connection's previous tick, because the failure list
    /// is uncapped and re-sending it every second would be megabytes on a bad run.
    /// </summary>
    private static async IAsyncEnumerable<ProgressSnapshot> StreamSnapshots(
        DeclarationPdfMigrationState state,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var sentFailures = 0;

        while (!cancellationToken.IsCancellationRequested)
        {
            var snapshot = state.GetSnapshot(sentFailures);
            sentFailures = snapshot.FailureCount;

            yield return snapshot;

            // A finished or not-yet-started run has nothing more to say; the client reopens
            // the stream after starting a run.
            if (snapshot.Status != nameof(RunStatus.Running))
                yield break;

            try
            {
                await Task.Delay(TickInterval, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                yield break;
            }
        }
    }
}
```

If `TypedResults.ServerSentEvents` does not exist in the installed SDK, do not invent an alternative silently — stop and report it. The fallback is to write the frames by hand: set `httpContext.Response.ContentType = "text/event-stream"` and, for each snapshot, `await httpContext.Response.WriteAsync($"data: {JsonSerializer.Serialize(snapshot, JsonSerializerOptions.Web)}\n\n", cancellationToken)` followed by `await httpContext.Response.Body.FlushAsync(cancellationToken)`, returning `TypedResults.Empty` at the end.

- [ ] **Step 4: Register the routes**

In `oed-admin.Server/Features/Endpoints.cs`, inside `MapMaintenanceEndpoints`, add the three routes after the existing `datamigration` line:

```csharp
            group.MapPost("/declarationpdfmigration", Maintenance.DeclarationPdfMigration.StartMigration.Endpoint.Post);
            group.MapDelete("/declarationpdfmigration", Maintenance.DeclarationPdfMigration.CancelMigration.Endpoint.Delete);
            group.MapGet("/declarationpdfmigration/progress", Maintenance.DeclarationPdfMigration.GetProgress.Endpoint.Get);
```

The group already carries `RequireAdminRole` from `MapFeatureEndpoints`; do not add a policy here.

- [ ] **Step 5: Guard the audit middleware against an empty response body**

In `oed-admin.Server/Infrastructure/Auditing/AuditingLoggingMiddleware.cs`, in `CallNextAndTryGetEstatesFromResponse`, replace:

```csharp
        if (context.Response is { StatusCode: >= 200 and < 300 })
        {
            var response = await GetResponseBody(context.Response);
            var partialSearchResponse = JsonSerializer.Deserialize<PartialSearchResponse>(
```

with:

```csharp
        if (context.Response is { StatusCode: >= 200 and < 300 })
        {
            var response = await GetResponseBody(context.Response);
            // GetResponseBody returns "" for a body that is absent or not JSON, and
            // Deserialize throws on "". A POST that legitimately returns no content must not
            // become a 500 in the audit middleware.
            var partialSearchResponse = string.IsNullOrWhiteSpace(response)
                ? null
                : JsonSerializer.Deserialize<PartialSearchResponse>(
```

then close the ternary correctly — the resulting statement is:

```csharp
            var partialSearchResponse = string.IsNullOrWhiteSpace(response)
                ? null
                : JsonSerializer.Deserialize<PartialSearchResponse>(
                    response,
                    JsonSerializerOptions.Web);
```

- [ ] **Step 6: Build**

Run: `dotnet build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add oed-admin.Server/Features/ oed-admin.Server/Infrastructure/Auditing/AuditingLoggingMiddleware.cs
git commit -m "feat: add declaration-pdf migration endpoints"
```

---

### Task 5: SSE reader for the SPA

**Files:**
- Create: `oed-admin.client/src/utils/sseReader.ts`
- Create: `oed-admin.client/src/components/declarationPdfMigration/useMigrationProgress.ts`

**Interfaces:**
- Consumes: `fetchWithMsal` from `src/utils/msalUtils.ts`; the `GET /api/maintenance/declarationpdfmigration/progress` stream (Task 4), whose payload is the `ProgressSnapshot` shape from Task 2.
- Produces:
  - `readSseStream<T>(response: Response, onMessage: (payload: T) => void, signal: AbortSignal): Promise<void>`
  - `useMigrationProgress()` returning `{ snapshot: ProgressSnapshot | null, failures: MigrationFailure[], error: string | null, connect: () => void }`
  - Types `ProgressSnapshot`, `MigrationFailure`, `RunStatus`

- [ ] **Step 1: Create the frame reader**

Create `oed-admin.client/src/utils/sseReader.ts`:

```ts
/**
 * Reads an SSE stream off a fetch Response.
 *
 * The browser's own EventSource cannot send an Authorization header, so it cannot reach an
 * endpoint behind RequireAdminRole - and a token in the query string would land in the audit
 * log. Hence fetchWithMsal plus this reader.
 *
 * Resolves when the server closes the stream or the signal aborts.
 */
export async function readSseStream<T>(
  response: Response,
  onMessage: (payload: T) => void,
  signal: AbortSignal,
): Promise<void> {
  if (!response.body) {
    throw new Error("Svaret inneholder ingen strøm");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const cancel = () => { void reader.cancel(); };
  signal.addEventListener("abort", cancel);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);

        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trim())
          .join("");

        if (data.length > 0) {
          onMessage(JSON.parse(data) as T);
        }

        separator = buffer.indexOf("\n\n");
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
```

- [ ] **Step 2: Create the progress hook**

Create `oed-admin.client/src/components/declarationPdfMigration/useMigrationProgress.ts`:

```ts
import React from "react";
import { fetchWithMsal } from "../../utils/msalUtils";
import { readSseStream } from "../../utils/sseReader";

export type RunStatus =
  | "Idle"
  | "Running"
  | "Completed"
  | "Cancelled"
  | "Aborted"
  | "Faulted";

export type MigrationFailure = {
  estateId: string;
  reason: string;
  detail: string | null;
  status: number;
};

export type ProgressSnapshot = {
  status: RunStatus;
  startedAt: string | null;
  endedAt: string | null;
  dryRun: boolean;
  overwrite: boolean;
  limit: number | null;
  total: number;
  processed: number;
  outcomes: Record<string, number>;
  failureCount: number;
  failures: MigrationFailure[];
};

const progressUrl = "/api/maintenance/declarationpdfmigration/progress";

/**
 * Holds the latest snapshot and the accumulated failure list.
 *
 * The server sends every failure it has on the first snapshot of a connection and only the new
 * ones afterwards, so failures are appended rather than replaced. failureCount is the
 * authoritative total: a mismatch means frames were missed, and reconnecting resynchronises.
 */
export function useMigrationProgress() {
  const [snapshot, setSnapshot] = React.useState<ProgressSnapshot | null>(null);
  const [failures, setFailures] = React.useState<MigrationFailure[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [generation, setGeneration] = React.useState(0);

  // Bumping the generation tears down the current stream and opens a new one. Needed after
  // starting a run, because the server closes the stream as soon as the run is not Running.
  const connect = React.useCallback(() => setGeneration((value) => value + 1), []);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetchWithMsal(progressUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Kunne ikke hente status (${response.status})`);
        }

        setError(null);
        setFailures([]);

        await readSseStream<ProgressSnapshot>(
          response,
          (payload) => {
            if (cancelled) {
              return;
            }
            setSnapshot(payload);
            if (payload.failures.length > 0) {
              setFailures((current) => [...current, ...payload.failures]);
            }
          },
          controller.signal,
        );
      } catch (streamError) {
        if (!cancelled && !controller.signal.aborted) {
          setError(streamError instanceof Error ? streamError.message : String(streamError));
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [generation]);

  return { snapshot, failures, error, connect };
}
```

- [ ] **Step 3: Lint and type-check**

Run from `oed-admin.client/`: `npm run lint`
Expected: no errors in the two new files.

Run from `oed-admin.client/`: `npm run build`
Expected: `tsc -b` passes. If it reports errors in files you did not touch, run `npm ci` first — a stale `node_modules` diverges from the lockfile silently in this repo.

- [ ] **Step 4: Commit**

```bash
git add oed-admin.client/src/utils/sseReader.ts oed-admin.client/src/components/declarationPdfMigration/useMigrationProgress.ts
git commit -m "feat: add SSE reader and migration progress hook"
```

---

### Task 6: The admin page, route and menu link

**Files:**
- Create: `oed-admin.client/src/components/declarationPdfMigration/index.tsx`
- Modify: `oed-admin.client/src/App.tsx`

**Interfaces:**
- Consumes: `useMigrationProgress`, `ProgressSnapshot`, `MigrationFailure` (Task 5); `fetchWithMsal` (existing); the start and cancel routes (Task 4).
- Produces: the route `/maintenance/declarationpdfmigration` and a dropdown entry pointing at it.

- [ ] **Step 1: Create the page**

Create `oed-admin.client/src/components/declarationPdfMigration/index.tsx`:

```tsx
import React from "react";
import {
  Breadcrumbs,
  Button,
  Field,
  Fieldset,
  Heading,
  Input,
  Label,
  Paragraph,
  Switch,
  Table,
  Tag,
} from "@digdir/designsystemet-react";
import { Link } from "react-router-dom";
import { fetchWithMsal } from "../../utils/msalUtils";
import { useMigrationProgress, type MigrationFailure } from "./useMigrationProgress";

const migrationUrl = "/api/maintenance/declarationpdfmigration";
const failurePageSize = 100;

export default function DeclarationPdfMigration() {
  const { snapshot, failures, error, connect } = useMigrationProgress();
  const [statusText, setStatusText] = React.useState<string>("");
  const [reasonFilter, setReasonFilter] = React.useState<string>("");
  const [visibleFailures, setVisibleFailures] = React.useState<number>(failurePageSize);

  const isRunning = snapshot?.status === "Running";

  const handleStart = async (formData: FormData) => {
    const rawLimit = formData.get("limit")?.toString().trim();
    const postData = {
      limit: rawLimit ? Number(rawLimit) : null,
      overwrite: formData.get("overwrite") ? true : false,
      dryRun: formData.get("dryRun") ? true : false,
    };

    setStatusText("Starter...");
    const response = await fetchWithMsal(migrationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postData),
    });

    if (response.status === 202) {
      setStatusText(`Migrering startet: ${JSON.stringify(postData)}`);
      setVisibleFailures(failurePageSize);
      // The stream closes whenever the run is not Running, so reopen it now that one is.
      connect();
    } else if (response.status === 409) {
      setStatusText("En migrering kjører allerede.");
    } else {
      setStatusText(`Kunne ikke starte migrering (${response.status}).`);
    }
  };

  const handleCancel = async () => {
    setStatusText("Avbryter...");
    const response = await fetchWithMsal(migrationUrl, { method: "DELETE" });
    setStatusText(
      response.status === 202 ? "Avbrudd forespurt." : "Fant ingen kjørende migrering.",
    );
  };

  const reasons = Array.from(new Set(failures.map((failure) => failure.reason))).sort();
  const filtered: MigrationFailure[] = reasonFilter
    ? failures.filter((failure) => failure.reason === reasonFilter)
    : failures;

  return (
    <>
      <Breadcrumbs>
        <Breadcrumbs.Link href="#" asChild>
          <Link to="/" aria-label="Tilbake til forsiden">
            Tilbake til oversikt
          </Link>
        </Breadcrumbs.Link>
      </Breadcrumbs>

      <Heading level={1} data-size="xl">
        Migrering av skifteerklæring (PDF)
      </Heading>
      <Paragraph>
        Kopierer skifteerklæringen (PDF) fra oed-declaration-instansen til oed-instansen for alle
        dødsbo med innsendt skifteerklæring. Kjøringen er trygg å gjenta: bo som allerede er
        migrert rapporteres som <code>AlreadyMigrated</code> uten at noe skrives på nytt.
      </Paragraph>

      <form action={handleStart}>
        <Fieldset>
          <Fieldset.Legend>Start en kjøring</Fieldset.Legend>
          <Field>
            <Label htmlFor="limit">Maks antall dødsbo (tomt = alle)</Label>
            <Input id="limit" name="limit" type="number" min={1} />
          </Field>
          <Switch
            label="Tørrkjøring"
            description="Tell opp hvor mange dødsbo som velges, uten å kalle oed-tjenesten."
            defaultChecked={false}
            value="dryRun"
            name="dryRun"
          />
          <Switch
            label="Overskriv"
            description="Erstatt PDF-en på oed-instansen dersom den allerede finnes. Brukes kun for å reparere en feilaktig kopi."
            defaultChecked={false}
            value="overwrite"
            name="overwrite"
          />
          <Button type="submit" disabled={isRunning}>
            Start migrering
          </Button>
        </Fieldset>
      </form>

      {isRunning && (
        <Button variant="secondary" data-color="danger" onClick={handleCancel}>
          Avbryt kjøringen
        </Button>
      )}

      <Paragraph>{statusText}</Paragraph>
      {error && <Paragraph data-color="danger">Statusstrøm: {error}</Paragraph>}

      {snapshot && (
        <>
          <Heading level={2} data-size="md">
            Status: <Tag data-color={isRunning ? "info" : "neutral"}>{snapshot.status}</Tag>
          </Heading>
          <Paragraph>
            {snapshot.processed} av {snapshot.total} behandlet
            {snapshot.dryRun ? " (tørrkjøring)" : ""}
          </Paragraph>
          <progress value={snapshot.processed} max={Math.max(snapshot.total, 1)} />

          <Table data-size="sm">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Utfall</Table.HeaderCell>
                <Table.HeaderCell>Antall</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {Object.entries(snapshot.outcomes).map(([key, count]) => (
                <Table.Row key={key}>
                  <Table.Cell>{key}</Table.Cell>
                  <Table.Cell>{count}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </>
      )}

      {failures.length > 0 && (
        <>
          <Heading level={2} data-size="md">
            Feil ({failures.length})
          </Heading>
          <Field>
            <Label htmlFor="reasonFilter">Filtrer på årsak</Label>
            <select
              id="reasonFilter"
              value={reasonFilter}
              onChange={(event) => {
                setReasonFilter(event.target.value);
                setVisibleFailures(failurePageSize);
              }}
            >
              <option value="">Alle</option>
              {reasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </Field>

          <Table data-size="sm">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Dødsbo</Table.HeaderCell>
                <Table.HeaderCell>Årsak</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Detaljer</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {filtered.slice(0, visibleFailures).map((failure) => (
                <Table.Row key={`${failure.estateId}-${failure.reason}`}>
                  <Table.Cell>
                    <Link to={`/estate/${failure.estateId}`}>{failure.estateId}</Link>
                  </Table.Cell>
                  <Table.Cell>{failure.reason}</Table.Cell>
                  <Table.Cell>{failure.status}</Table.Cell>
                  <Table.Cell>{failure.detail}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {filtered.length > visibleFailures && (
            <Button
              variant="tertiary"
              onClick={() => setVisibleFailures((value) => value + failurePageSize)}
            >
              Vis flere ({filtered.length - visibleFailures} igjen)
            </Button>
          )}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add the route**

In `oed-admin.client/src/App.tsx`, add the import next to the other component imports:

```tsx
import DeclarationPdfMigration from "./components/declarationPdfMigration";
```

and add this route inside the **admin** `<Routes>` tree, immediately after the existing `/maintenance/datamigration` route:

```tsx
            <Route
              path="/maintenance/declarationpdfmigration"
              element={<DeclarationPdfMigration />}
            />
```

- [ ] **Step 3: Add the dropdown menu link**

`Layout` is shared by the admin and reader route trees, so the item must be gated on `isAdmin`, which is already in scope in `App`.

Add `useNavigate` to the existing `react-router-dom` import:

```tsx
import { Routes, Route, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
```

Add the hook next to the existing `useLocation` call in `App`:

```tsx
  const navigate = useNavigate();
```

Then, in `Layout`'s `<Dropdown.List>`, add this item **before** the existing logout item:

```tsx
                {isAdmin && (
                  <Dropdown.Item>
                    <Dropdown.Button
                      onClick={() => navigate("/maintenance/declarationpdfmigration")}
                    >
                      Migrering av skifteerklæring
                    </Dropdown.Button>
                  </Dropdown.Item>
                )}
```

- [ ] **Step 4: Lint and type-check**

Run from `oed-admin.client/`: `npm run lint`
Expected: no errors.

Run from `oed-admin.client/`: `npm run build`
Expected: `tsc -b` passes. If `Tag` or `Table` is not exported by the installed `@digdir/designsystemet-react`, check the version's exports and substitute the equivalent component rather than guessing.

- [ ] **Step 5: Verify the page renders**

Run: `dotnet run --project oed-admin.Server`, then open the Vite URL it launches (not the backend URL) and sign in as an admin.

Expected: the avatar dropdown shows "Migrering av skifteerklæring"; clicking it opens the page; the page shows the form, and either no status block or one showing `Idle`. The browser devtools Network tab shows the `progress` request as an `text/event-stream` response.

- [ ] **Step 6: Commit**

```bash
git add oed-admin.client/src/components/declarationPdfMigration/ oed-admin.client/src/App.tsx
git commit -m "feat: add declaration-pdf migration admin page"
```

---

### Task 7: End-to-end verification

**Files:** none — this task runs the software.

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: a verified backfill, and a record of which estates failed permanently.

**Blocked on the two prerequisites in spec §2.** Neither can be worked around in this repo. Do not mark this task done by skipping them.

- [ ] **Step 1: Confirm the oed endpoint is deployed**

Run against the target environment (TT02 shown):

```bash
curl -i -X POST https://digdir.apps.tt02.altinn.no/digdir/oed/api/admin/declaration-pdf \
  -H "Content-Type: application/json" \
  -d '{"estateId":"00000000-0000-0000-0000-000000000000","overwrite":false}'
```

Expected: `401`. A `404` means the deployed build predates the feature — stop and report it.

- [ ] **Step 2: Confirm the Maskinporten scope**

Confirm with whoever administers Maskinporten that `digdir:dd:systemadmin` is registered and provisioned for `oed-admin`'s client in this environment. Without it every call returns `403` and the first estate aborts the run — which is the designed behaviour, and is what you will see if this step was skipped.

- [ ] **Step 3: Dry run**

On the admin page, tick "Tørrkjøring", leave the limit empty, and start.

Expected: status goes `Running` then `Completed`, `total` shows the number of estates with a submitted declaration, `processed` stays 0, and no failures appear. Sanity-check the total against expectations before going further.

- [ ] **Step 4: Limited run**

Untick "Tørrkjøring", set the limit to 10, and start.

Expected: `processed` climbs to 10, outcome counters move (a first run should be mostly `Copied`, with some `NoPdfOnDeclaration` or `NoDeclarationInstance`), and any failure rows carry a real `detail` text. Check the application log for the matching `Warning` lines.

Also confirm the SSE stream actually streams through Azure App Service rather than being buffered: watch the counters move live, tick by tick, during this run rather than all arriving at once when it finishes. `X-Accel-Buffering` is an nginx header and does nothing on App Service, and .NET's `ServerSentEvents` flushes per event, so this is expected to pass — but it has not been confirmed against App Service specifically, only locally, so check it here.

- [ ] **Step 5: Cancel**

Start a run with the limit empty, wait a few seconds, then press "Avbryt kjøringen".

Expected: status becomes `Cancelled` within a second or two, `processed` stops climbing, and the start button becomes available again.

- [ ] **Step 6: Full run**

Start with the limit empty and leave the page open.

Expected: it runs to `Completed`. A substantial `NoDeclarationInstance` count is normal — declaration instances get hard-deleted elsewhere in `oed` while `Estate.DeclarationInstanceId` is never cleared. Export or note the `InvalidEstateData` rows; those are permanent data defects needing manual repair.

- [ ] **Step 7: Prove idempotence**

Start a second full run.

Expected: nearly every estate returns `AlreadyMigrated`, and it finishes far faster than the first because nothing is written to Storage.

- [ ] **Step 8: Open the pull request**

```bash
git push -u origin feat/declaration-pdf-migration
gh pr create --title "Declaration-PDF migration sweep" --body "Implements docs/superpowers/specs/2026-08-18-declaration-pdf-migration-design.md"
```
