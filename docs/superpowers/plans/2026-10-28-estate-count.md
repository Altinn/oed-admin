# Telling av dødsbo (Estate count) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only maintenance page that counts the estates matching created-date, case-status and heir-role filters, as a global background job modelled on the declaration-PDF migration, and lists the matching case numbers.

**Architecture:** A singleton `EstateCountState` plus a `BackgroundService` fed by a bounded channel (exact copy of the `DeclarationPdfMigration` shape). The service reads matching estates from `oed` in keyset chunks of 500; only when heir roles are selected does it fetch each estate's OED_M instance form data from Altinn Storage (4 in parallel, retries with backoff) and match `HeirV2.Role`. Four endpoints under `/api/maintenance/estatecount` (options, start, cancel, SSE progress); a React page at `/maintenance/estatecount` consumes the SSE stream.

**Tech Stack:** ASP.NET Core 10 minimal APIs, EF Core 10 + Npgsql 10, `IAltinnClient`, `TypedResults.ServerSentEvents`; React 19, TanStack Query, `@digdir/designsystemet-react` 1.x, `readSseStream` + `fetchWithMsal`.

**Spec:** `docs/superpowers/specs/2026-10-28-estate-count-design.md`

## Global Constraints

- There is **no unit test project** (spec, "Verification"). Every task verifies with `dotnet build`, `npm run build` / `npm run lint`, and the manual checks written into the task. Do not add a test project.
- Never add an EF Core migration. The `oed` schema is owned by another repo.
- Authorization: the routes go in `MapMaintenanceEndpoints`, which already has `RequireAdminRole`. Do not add any other policy.
- Audit decision 10: only the start POST (the filters) is audited. Matched estate ids are deliberately not audited. Do not "fix" this.
- One global run. A second start answers `409`.
- `BatchSize = 500` and `MaxConcurrency = 4` are `const`s.
- Valid case statuses: `MOTTATT`, `FERDIGBEHANDLET`, `FEILFORT`, `OVERFORT_ANNEN_DOMSTOL`, plus `NONE` = "Ingen status" (`CaseStatus IS NULL`).
- Valid heir roles: the 41 `urn:digitaltdodsbo:arving:*` values in the spec appendix, with the labels exactly as written there.
- Created-date filter: dates only, both ends inclusive, Europe/Oslo.
- Failure reasons: `InvalidInstanceId`, `NoOedInstance`, `NoDataElement`, `InvalidData`, `StorageError`.
- Grouping (decision 20): with heir roles selected, the result is grouped per selected role. An estate appears in every group it matches; the headline total counts distinct estates; every selected role is shown, 0 hits included. No grouping without a role filter.
- All user-facing text is Norwegian. Data fetching goes through `fetchWithMsal`.
- Match comments and naming to the surrounding code (the `DeclarationPdfMigration` files are the model).

## Review Focus

1. **Storage refuses our token (401/403).** Expect the run to stop at once as `Faulted` with a clear message, instead of producing 20 000 identical failures. Task 2 aborts on 401/403. Task 5's manual check is a dev run with a wrong Maskinporten scope, if one can be arranged; otherwise review it by reading the code.
2. **An instance whose form data has no heirs, a `HeirInfo` with neither `Heir` nor `HeirV2`, or a heir with a null `Role`.** Expect "no match", never a crash or a faulted run. Task 2 uses `(heirInfo.HeirV2 ?? heirInfo.Heir)?.Role` instead of `GetHeir()`, which throws.
3. **Reconnecting to the progress stream mid-run or after it has finished.** For example, opening the page in a second tab should show the full match list once, not doubled and not empty. Task 4's hook replaces the lists on the first snapshot of a connection and resyncs once on a count mismatch. Task 5 has a manual check.
4. **Out-of-range dates (`createdFrom` year 0001, `from > to`, a missing date).** Expect `400` before any job starts. `DateOnly.MinValue` minus the Oslo offset would throw inside the service. Task 3 bounds the years to 2000–9998.
5. **20 000 matches.** Expect the page to stay responsive. Task 5 renders the hit list in pages of 100 with "Vis flere"; "Kopier alle" still copies everything.

---

## File Structure

**Server, new: `oed-admin.Server/Infrastructure/EstateCount/`**
- `EstateCountOptions.cs`: valid case statuses and heir roles with labels; validation helpers.
- `EstateCountFilters.cs`: the filter record, plus the conversion of Oslo dates to a UTC range.
- `EstateCountTrigger.cs`: the channel message.
- `EstateCountState.cs`: in-memory run state, run guard and snapshots.
- `EstateCountService.cs`: the `BackgroundService` (DB chunks, Storage lookups, matching).
- `ServiceCollectionExtensions.cs`: `AddEstateCount()`.

**Server, new: `oed-admin.Server/Features/Maintenance/EstateCount/`**
- `GetOptions/Endpoint.cs`
- `StartCount/Endpoint.cs`
- `CancelCount/Endpoint.cs`
- `GetProgress/Endpoint.cs`

**Server, modified**
- `oed-admin.Server/Program.cs`: `AddEstateCount()`.
- `oed-admin.Server/Features/Endpoints.cs`: four routes in `MapMaintenanceEndpoints`.

**Client, new**
- `oed-admin.client/src/queries/estateCountQueries.ts`: types and the options query.
- `oed-admin.client/src/components/estateCount/useEstateCountProgress.ts`: the SSE hook.
- `oed-admin.client/src/components/estateCount/index.tsx`: the page.

**Client, modified**
- `oed-admin.client/src/App.tsx`: route and menu item.

---

### Task 1: Options, filters and run state

**Files:**
- Create: `oed-admin.Server/Infrastructure/EstateCount/EstateCountOptions.cs`
- Create: `oed-admin.Server/Infrastructure/EstateCount/EstateCountFilters.cs`
- Create: `oed-admin.Server/Infrastructure/EstateCount/EstateCountTrigger.cs`
- Create: `oed-admin.Server/Infrastructure/EstateCount/EstateCountState.cs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `record OptionValue(string Value, string Label)`
  - `static class EstateCountOptions { const string NoStatus = "NONE"; IReadOnlyList<OptionValue> CaseStatuses; IReadOnlyList<OptionValue> HeirRoles; bool IsValidCaseStatus(string); bool IsValidHeirRole(string); }`
  - `record EstateCountFilters(DateOnly CreatedFrom, DateOnly CreatedTo, IReadOnlyList<string> CaseStatuses, IReadOnlyList<string> HeirRoles)` with `(DateTimeOffset From, DateTimeOffset ToExclusive) CreatedRangeUtc()`
  - `record EstateCountTrigger(DateTimeOffset Timestamp, EstateCountFilters Filters, string StartedBy)`
  - `enum EstateCountStatus { Idle, Running, Completed, Cancelled, Faulted }`
  - `record EstateMatch(Guid EstateId, string? CaseNumber, IReadOnlyList<string> HeirRoles)`: `HeirRoles` holds the selected roles the estate has, and is empty without a role filter
  - `record EstateCountFailure(Guid EstateId, string Reason, string? Detail)`
  - `record EstateCountSnapshot(...)` (fields below, including `IReadOnlyDictionary<string, int> HeirRoleCounts`)
  - `class EstateCountState` with `TryBeginRun`, `SetCancellationSource`, `TryCancel`, `SetTotal`, `RecordMatch`, `RecordNoMatch`, `RecordFailure`, `EndRun`, `GetSnapshot(int fromMatchIndex, int fromFailureIndex)`, and properties `Processed`, `MatchCount`, `FailureCount`

- [ ] **Step 1: Create `EstateCountOptions.cs`**

```csharp
namespace oed_admin.Server.Infrastructure.EstateCount;

public record OptionValue(string Value, string Label);

/// <summary>
/// The only source of truth for which case statuses and heir roles a count can filter on. The
/// client renders these and StartCount validates against them.
/// </summary>
public static class EstateCountOptions
{
    /// <summary>Selects estates whose CaseStatus is null - DA has not sent a case yet.</summary>
    public const string NoStatus = "NONE";

    private const string HeirRolePrefix = "urn:digitaltdodsbo:arving:";

    // The statuses DA sends, from the status enum in oed-events' Domstol.Hendelser external_api.yaml.
    public static readonly IReadOnlyList<OptionValue> CaseStatuses =
    [
        new("MOTTATT", "Mottatt"),
        new("FERDIGBEHANDLET", "Ferdigbehandlet"),
        new("FEILFORT", "Feilført"),
        new("OVERFORT_ANNEN_DOMSTOL", "Overført annen domstol"),
        new(NoStatus, "Ingen status")
    ];

    // Mirrors CloudEventMapper.MapRelation in digdir/oed-events, which writes HeirV2.Role on the
    // OED_M instance. Keep in step with it; ukjentRelasjon is its fallback.
    public static readonly IReadOnlyList<OptionValue> HeirRoles =
    [
        HeirRole("partAnnen", "Part, annen"),
        HeirRole("gjenlevEktefellePartner", "Gjenlevende ektefelle/partner"),
        HeirRole("gjenlevPartner", "Gjenlevende partner"),
        HeirRole("gjenlevSamboer", "Gjenlevende samboer"),
        HeirRole("gjenlevEktefelle", "Gjenlevende ektefelle"),
        HeirRole("barn", "Barn"),
        HeirRole("barnebarn", "Barnebarn"),
        HeirRole("barnebarnsBarn", "Barnebarns barn"),
        HeirRole("saerkullsbarn", "Særkullsbarn"),
        HeirRole("saerkullsbarnBarn", "Særkullsbarns barn"),
        HeirRole("far", "Far"),
        HeirRole("mor", "Mor"),
        HeirRole("soesken", "Søsken"),
        HeirRole("soeskensBarn", "Søskens barn"),
        HeirRole("soeskensBarnebarn", "Søskens barnebarn"),
        HeirRole("soeskensBarnebarnsBarn", "Søskens barnebarns barn"),
        HeirRole("halvSoesken", "Halvsøsken"),
        HeirRole("halvSoeskensBarn", "Halvsøskens barn"),
        HeirRole("halvSoeskensBarnebarn", "Halvsøskens barnebarn"),
        HeirRole("farfar", "Farfar"),
        HeirRole("farmor", "Farmor"),
        HeirRole("morfar", "Morfar"),
        HeirRole("mormor", "Mormor"),
        HeirRole("onkel", "Onkel"),
        HeirRole("tante", "Tante"),
        HeirRole("fetter", "Fetter"),
        HeirRole("kusine", "Kusine"),
        HeirRole("staten", "Staten"),
        HeirRole("avdoede", "Avdøde"),
        HeirRole("avdoedeEktefellePartner", "Avdødes ektefelle/partner"),
        HeirRole("fordringshaver", "Fordringshaver"),
        HeirRole("verge", "Verge"),
        HeirRole("foreldrevergeAktoer", "Foreldreverge"),
        HeirRole("midlertidigvergeAktoer", "Midlertidig verge"),
        HeirRole("fullmektig", "Fullmektig"),
        HeirRole("prosfull", "Prosessfullmektig"),
        HeirRole("fremtidsfullmektig", "Fremtidsfullmektig"),
        HeirRole("mottakerFullmaktDoedsboLitenVerdi", "Mottaker av fullmakt (dødsbo av liten verdi)"),
        HeirRole("testArvingFull", "Testamentarving (full)"),
        HeirRole("testArvingBegr", "Testamentarving (begrenset)"),
        HeirRole("ukjentRelasjon", "Ukjent relasjon")
    ];

    private static readonly HashSet<string> CaseStatusValues =
        CaseStatuses.Select(option => option.Value).ToHashSet(StringComparer.Ordinal);

    private static readonly HashSet<string> HeirRoleValues =
        HeirRoles.Select(option => option.Value).ToHashSet(StringComparer.Ordinal);

    public static bool IsValidCaseStatus(string value) => CaseStatusValues.Contains(value);

    public static bool IsValidHeirRole(string value) => HeirRoleValues.Contains(value);

    private static OptionValue HeirRole(string suffix, string label) => new($"{HeirRolePrefix}{suffix}", label);
}
```

The `HashSet` fields must stay below the lists. Static initializers run in textual order.

- [ ] **Step 2: Create `EstateCountFilters.cs`**

```csharp
namespace oed_admin.Server.Infrastructure.EstateCount;

/// <summary>
/// Empty lists mean "no filter". Dates are whole days in Norwegian time, both ends inclusive.
/// </summary>
public record EstateCountFilters(
    DateOnly CreatedFrom,
    DateOnly CreatedTo,
    IReadOnlyList<string> CaseStatuses,
    IReadOnlyList<string> HeirRoles)
{
    // Windows hosts without ICU only know the Windows id.
    private static readonly TimeZoneInfo Oslo =
        TimeZoneInfo.TryFindSystemTimeZoneById("Europe/Oslo", out var timeZone)
            ? timeZone
            : TimeZoneInfo.FindSystemTimeZoneById("W. Europe Standard Time");

    /// <summary>
    /// [CreatedFrom 00:00, CreatedTo + 1 day 00:00) in Oslo, as UTC instants - Npgsql only accepts
    /// offset 0 for timestamptz parameters.
    /// </summary>
    public (DateTimeOffset From, DateTimeOffset ToExclusive) CreatedRangeUtc() =>
        (StartOfDayUtc(CreatedFrom), StartOfDayUtc(CreatedTo.AddDays(1)));

    // Midnight is never inside a DST gap or overlap in Oslo (the switches are at 02:00 and 03:00),
    // so GetUtcOffset is unambiguous here.
    private static DateTimeOffset StartOfDayUtc(DateOnly date)
    {
        var localMidnight = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(localMidnight, Oslo.GetUtcOffset(localMidnight)).ToUniversalTime();
    }
}
```

- [ ] **Step 3: Create `EstateCountTrigger.cs`**

```csharp
namespace oed_admin.Server.Infrastructure.EstateCount;

/// <param name="StartedBy">Display name of the admin who started the count, shown to everyone.</param>
public record EstateCountTrigger(
    DateTimeOffset Timestamp,
    EstateCountFilters Filters,
    string StartedBy);
```

- [ ] **Step 4: Create `EstateCountState.cs`**

```csharp
namespace oed_admin.Server.Infrastructure.EstateCount;

public enum EstateCountStatus { Idle, Running, Completed, Cancelled, Faulted }

/// <param name="HeirRoles">
/// The selected heir roles this estate has - it belongs to each of those groups. Empty when the
/// count has no heir-role filter.
/// </param>
public record EstateMatch(Guid EstateId, string? CaseNumber, IReadOnlyList<string> HeirRoles);

public record EstateCountFailure(Guid EstateId, string Reason, string? Detail);

/// <param name="HeirRoleCounts">
/// Hits per selected heir role, with every selected role present (0 included). An estate counts
/// towards every role it has, so these do not add up to MatchCount, which counts distinct estates.
/// </param>
public record EstateCountSnapshot(
    string Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? EndedAt,
    string? StartedBy,
    EstateCountFilters? Filters,
    int Total,
    int Processed,
    int MatchCount,
    int FailureCount,
    IReadOnlyDictionary<string, int> HeirRoleCounts,
    IReadOnlyList<EstateMatch> Matches,
    IReadOnlyList<EstateCountFailure> Failures,
    string? Error);

/// <summary>
/// All state for the current (or most recently finished) estate count. Registered as a
/// singleton; written by EstateCountService, read by the SSE endpoint. There is one count for
/// the whole app and everyone sees its result. Deliberately not persisted - a restart means
/// starting the count again.
/// </summary>
public class EstateCountState
{
    private readonly Lock _gate = new();
    private readonly List<EstateMatch> _matches = [];
    private readonly List<EstateCountFailure> _failures = [];
    private readonly Dictionary<string, int> _heirRoleCounts = new(StringComparer.Ordinal);

    private EstateCountStatus _status = EstateCountStatus.Idle;
    private EstateCountTrigger? _trigger;
    private DateTimeOffset? _endedAt;
    private CancellationTokenSource? _cancellationTokenSource;
    private int _total;
    private int _processed;
    private string? _error;

    public int Processed
    {
        get
        {
            lock (_gate) return _processed;
        }
    }

    public int MatchCount
    {
        get
        {
            lock (_gate) return _matches.Count;
        }
    }

    public int FailureCount
    {
        get
        {
            lock (_gate) return _failures.Count;
        }
    }

    /// <summary>
    /// The single guard against two overlapping counts. Resets all state on success.
    /// </summary>
    public bool TryBeginRun(EstateCountTrigger trigger)
    {
        lock (_gate)
        {
            if (_status == EstateCountStatus.Running)
                return false;

            _status = EstateCountStatus.Running;
            _trigger = trigger;
            _endedAt = null;
            _total = 0;
            _processed = 0;
            _error = null;
            _matches.Clear();
            _failures.Clear();
            _heirRoleCounts.Clear();
            // Seeded so that a selected role with no hits is reported as 0, not left out.
            foreach (var heirRole in trigger.Filters.HeirRoles)
                _heirRoleCounts[heirRole] = 0;
            return true;
        }
    }

    public void SetCancellationSource(CancellationTokenSource? cancellationTokenSource)
    {
        lock (_gate) _cancellationTokenSource = cancellationTokenSource;
    }

    /// <summary>Cancels the active count. Returns false when there is nothing to cancel.</summary>
    public bool TryCancel()
    {
        lock (_gate)
        {
            if (_status != EstateCountStatus.Running || _cancellationTokenSource is null)
                return false;

            _cancellationTokenSource.Cancel();
            return true;
        }
    }

    public void SetTotal(int total)
    {
        lock (_gate) _total = total;
    }

    /// <summary>
    /// Records a matching estate and counts it towards each of its heir roles. Returns the new
    /// processed count.
    /// </summary>
    public int RecordMatch(EstateMatch match)
    {
        lock (_gate)
        {
            _matches.Add(match);
            foreach (var heirRole in match.HeirRoles)
            {
                _heirRoleCounts.TryGetValue(heirRole, out var count);
                _heirRoleCounts[heirRole] = count + 1;
            }
            return ++_processed;
        }
    }

    /// <summary>Records an estate that was checked and did not match. Returns the new processed count.</summary>
    public int RecordNoMatch()
    {
        lock (_gate) return ++_processed;
    }

    /// <summary>Records an estate that could not be checked. Returns the new processed count.</summary>
    public int RecordFailure(EstateCountFailure failure)
    {
        lock (_gate)
        {
            _failures.Add(failure);
            return ++_processed;
        }
    }

    public void EndRun(EstateCountStatus status, string? error = null)
    {
        lock (_gate)
        {
            _status = status;
            _endedAt = DateTimeOffset.UtcNow;
            _cancellationTokenSource = null;
            _error = error;
        }
    }

    /// <summary>
    /// A snapshot carrying only the matches and failures from the given indexes onwards. A full
    /// count can match 20 000 estates, so a stream sends everything once and then only what is new.
    /// </summary>
    public EstateCountSnapshot GetSnapshot(int fromMatchIndex, int fromFailureIndex)
    {
        lock (_gate)
        {
            var fromMatch = Math.Clamp(fromMatchIndex, 0, _matches.Count);
            var fromFailure = Math.Clamp(fromFailureIndex, 0, _failures.Count);

            return new EstateCountSnapshot(
                _status.ToString(),
                _trigger?.Timestamp,
                _endedAt,
                _trigger?.StartedBy,
                _trigger?.Filters,
                _total,
                _processed,
                _matches.Count,
                _failures.Count,
                // A copy: the live dictionary keeps changing after the lock is released.
                new Dictionary<string, int>(_heirRoleCounts),
                _matches.GetRange(fromMatch, _matches.Count - fromMatch),
                _failures.GetRange(fromFailure, _failures.Count - fromFailure),
                _error);
        }
    }
}
```

- [ ] **Step 5: Build**

Run: `dotnet build` (repo root)
Expected: `Build succeeded`, with no new warnings in `Infrastructure/EstateCount/`.

- [ ] **Step 6: Commit**

```bash
git add oed-admin.Server/Infrastructure/EstateCount
git commit -m "Add estate count options, filters and run state"
```

---

### Task 2: The background service

**Files:**
- Create: `oed-admin.Server/Infrastructure/EstateCount/EstateCountService.cs`
- Create: `oed-admin.Server/Infrastructure/EstateCount/ServiceCollectionExtensions.cs`
- Modify: `oed-admin.Server/Program.cs`: add `using oed_admin.Server.Infrastructure.EstateCount;` and call `builder.Services.AddEstateCount();` directly after `builder.Services.AddDeclarationPdfMigration();`

**Interfaces:**
- Consumes (Task 1): `EstateCountTrigger`, `EstateCountFilters.CreatedRangeUtc()`, `EstateCountOptions.NoStatus`, `EstateCountState` (`SetCancellationSource`, `SetTotal`, `RecordMatch`, `RecordNoMatch`, `RecordFailure`, `EndRun`, `Processed`, `MatchCount`, `FailureCount`), `EstateMatch`, `EstateCountFailure`, `EstateCountStatus`.
- Consumes (existing): `IAltinnClient.GetInstance(int, Guid)`, which returns `null` on 404 and throws `HttpRequestException` otherwise; `IAltinnClient.GetInstanceData<OedInstanceData>(int, Guid, Guid)`, which throws `HttpRequestException` on non-2xx and `InvalidOperationException` from `XmlSerializer` on bad XML; `OedDbContext.Estate`.
- Produces: `IServiceCollection.AddEstateCount()`, which registers `Channel<EstateCountTrigger>` and `EstateCountState` as singletons plus the hosted `EstateCountService`.

- [ ] **Step 1: Create `ServiceCollectionExtensions.cs`**

```csharp
using System.Threading.Channels;

namespace oed_admin.Server.Infrastructure.EstateCount;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddEstateCount(this IServiceCollection services)
    {
        // Capacity 1 and Wait, for the same reason as AddDeclarationPdfMigration: the run guard
        // in EstateCountState is the real gate, and Wait makes TryWrite return false rather than
        // silently dropping a trigger.
        var channel = Channel.CreateBounded<EstateCountTrigger>(
            new BoundedChannelOptions(1)
            {
                SingleReader = true,
                FullMode = BoundedChannelFullMode.Wait
            });

        services.AddSingleton(channel);
        services.AddSingleton<EstateCountState>();
        services.AddHostedService<EstateCountService>();

        return services;
    }
}
```

- [ ] **Step 2: Create `EstateCountService.cs`**

```csharp
using System.Net;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Infrastructure.EstateCount;

/// <summary>
/// Counts the estates matching a set of filters. Created date and case status are answered by
/// the oed database; heir roles only exist in the OED_M instance form data, so Storage is only
/// called when heir roles are part of the filter.
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

    private record EstateRow(Guid Id, string? CaseNumber, string InstanceId, DateTimeOffset Created);

    /// <param name="MatchedHeirRoles">Null unless the estate matched; then the selected roles it has (empty without a role filter).</param>
    private readonly record struct CheckResult(
        IReadOnlyList<string>? MatchedHeirRoles,
        string? FailureReason,
        string? Detail)
    {
        public static readonly CheckResult MatchWithoutRoles = new([], null, null);
        public static readonly CheckResult NoMatch = new(null, null, null);
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
            "Estate count started at {Timestamp} by {StartedBy}. Created {From}..{To}, CaseStatuses: [{CaseStatuses}], HeirRoles: [{HeirRoles}]",
            trigger.Timestamp, trigger.StartedBy, filters.CreatedFrom, filters.CreatedTo,
            string.Join(", ", filters.CaseStatuses), string.Join(", ", filters.HeirRoles));

        var finalStatus = EstateCountStatus.Completed;
        string? error = null;
        try
        {
            var total = await CountEstates(filters, cts.Token);
            state.SetTotal(total);
            logger.LogInformation("Estate count selected {Total} estates", total);

            var heirRoles = filters.HeirRoles.ToHashSet(StringComparer.Ordinal);

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

                if (heirRoles.Count == 0)
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
                            Record(row, await CheckEstateWithRetry(client, row, heirRoles, cancellationToken)));
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
        IReadOnlySet<string> heirRoles,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await CheckEstate(client, row, heirRoles);
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
                    "Estate {EstateId}: {Error} on attempt {Attempt} - retrying in {Delay}",
                    row.Id, ex.Message, attempt, delay);
                await Task.Delay(delay, cancellationToken);
            }
            catch (Exception ex) when (ex is HttpRequestException || IsTransient(ex, cancellationToken))
            {
                var status = (ex as HttpRequestException)?.StatusCode;
                return CheckResult.Failure("StorageError", status is null ? ex.Message : $"HTTP {(int)status}: {ex.Message}");
            }
        }
    }

    private static async Task<CheckResult> CheckEstate(
        IAltinnClient client,
        EstateRow row,
        IReadOnlySet<string> heirRoles)
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
        var dataElement = instance.Data?.FirstOrDefault(element =>
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

        var matchedHeirRoles = MatchedHeirRoles(data, heirRoles);
        return matchedHeirRoles.Count > 0 ? CheckResult.Match(matchedHeirRoles) : CheckResult.NoMatch;
    }

    /// <summary>
    /// The selected roles held by at least one heir - the estate's groups in the result. Not
    /// HeirInfo.GetHeir(), which throws when neither Heir nor HeirV2 is set; such an entry, like a
    /// heir without a role, simply contributes nothing.
    /// </summary>
    private static List<string> MatchedHeirRoles(OedInstanceData data, IReadOnlySet<string> heirRoles) =>
        (data.Heirs ?? [])
            .Select(heirInfo => (heirInfo?.HeirV2 ?? heirInfo?.Heir)?.Role)
            .OfType<string>()
            .Where(heirRoles.Contains)
            .Distinct(StringComparer.Ordinal)
            .ToList();

    // The HTTP clients get no cancellation token, so a TaskCanceledException that is not ours is
    // an HttpClient timeout.
    private static bool IsTransient(Exception ex, CancellationToken cancellationToken) => ex switch
    {
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
        else if (result.MatchedHeirRoles is { } matchedHeirRoles)
        {
            processed = state.RecordMatch(new EstateMatch(row.Id, row.CaseNumber, matchedHeirRoles));
        }
        else
        {
            processed = state.RecordNoMatch();
        }

        if (processed % HeartbeatEvery == 0)
            logger.LogInformation("Estate count progress: {Processed} estates processed", processed);
    }

    // 2s, 6s plus jitter, as in DeclarationPdfMigrationService.
    private static TimeSpan RetryDelay(int attempt) =>
        TimeSpan.FromSeconds(2 * Math.Pow(3, attempt - 1)) + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 1000));
}
```

If `Estate` resolves ambiguously, keep the `Database.Oed.Model.Estate` qualification shown above. The `Features.Estate` namespace exists, and that is why it is spelled out.

- [ ] **Step 3: Register in `Program.cs`**

Add `using oed_admin.Server.Infrastructure.EstateCount;` to the usings. Directly after `builder.Services.AddDeclarationPdfMigration();`, add:

```csharp
builder.Services.AddEstateCount();
```

- [ ] **Step 4: Build**

Run: `dotnet build` (repo root)
Expected: `Build succeeded`.

If `EF.Functions.GreaterThan(ValueTuple, ValueTuple)` doesn't compile, check that `using Microsoft.EntityFrameworkCore;` is present; the extension lives in `NpgsqlDbFunctionsExtensions` in that namespace. Do not switch to `Skip`/`Take`, because the spec requires keyset paging.

- [ ] **Step 5: Smoke-run**

Run: `dotnet run --project oed-admin.Server`
Expected: the app starts with no DI errors (`Unable to resolve service ... EstateCount`). Stop it with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add oed-admin.Server/Infrastructure/EstateCount oed-admin.Server/Program.cs
git commit -m "Add the estate count background service"
```

---

### Task 3: Endpoints

**Files:**
- Create: `oed-admin.Server/Features/Maintenance/EstateCount/GetOptions/Endpoint.cs`
- Create: `oed-admin.Server/Features/Maintenance/EstateCount/StartCount/Endpoint.cs`
- Create: `oed-admin.Server/Features/Maintenance/EstateCount/CancelCount/Endpoint.cs`
- Create: `oed-admin.Server/Features/Maintenance/EstateCount/GetProgress/Endpoint.cs`
- Modify: `oed-admin.Server/Features/Endpoints.cs`, inside `MapMaintenanceEndpoints()` after the three `declarationpdfmigration` lines

**Interfaces:**
- Consumes (Task 1): `EstateCountOptions`, `EstateCountFilters`, `EstateCountTrigger`, `EstateCountState` (`TryBeginRun`, `EndRun`, `TryCancel`, `GetSnapshot`), `EstateCountSnapshot`, `EstateCountStatus`. Consumes (Task 2): the registered `Channel<EstateCountTrigger>`. Consumes (existing): `ClaimsPrincipal.GetName()` in `oed_admin.Server.Infrastructure.Auditing`.
- Produces HTTP (camelCase JSON):
  - `GET /api/maintenance/estatecount/options` → `{ caseStatuses: [{ value, label }], heirRoles: [{ value, label }] }`
  - `POST /api/maintenance/estatecount` body `{ createdFrom: "yyyy-MM-dd", createdTo: "yyyy-MM-dd", caseStatuses: string[], heirRoles: string[] }` → `202 { status: "Started" }` | `400` | `409`
  - `DELETE /api/maintenance/estatecount` → `202` | `404`
  - `GET /api/maintenance/estatecount/progress` → SSE; each `data:` is an `EstateCountSnapshot` in camelCase: `status, startedAt, endedAt, startedBy, filters { createdFrom, createdTo, caseStatuses, heirRoles }, total, processed, matchCount, failureCount, heirRoleCounts { [role]: number }, matches [{ estateId, caseNumber, heirRoles }], failures [{ estateId, reason, detail }], error`. Keys in `heirRoleCounts` are the role URNs exactly as sent. URN dictionary keys are not camelCased, because the default policy only touches property names.

- [ ] **Step 1: Create `GetOptions/Endpoint.cs`**

```csharp
using oed_admin.Server.Infrastructure.EstateCount;

namespace oed_admin.Server.Features.Maintenance.EstateCount.GetOptions;

public record Response(IReadOnlyList<OptionValue> CaseStatuses, IReadOnlyList<OptionValue> HeirRoles);

public static class Endpoint
{
    public static IResult Get() =>
        TypedResults.Ok(new Response(EstateCountOptions.CaseStatuses, EstateCountOptions.HeirRoles));
}
```

- [ ] **Step 2: Create `StartCount/Endpoint.cs`**

```csharp
using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Auditing;
using oed_admin.Server.Infrastructure.EstateCount;

namespace oed_admin.Server.Features.Maintenance.EstateCount.StartCount;

/// <param name="CaseStatuses">Empty or null means no filter. "NONE" selects estates without a case status.</param>
/// <param name="HeirRoles">Empty or null means no filter, and no Storage lookups.</param>
public record Request(
    DateOnly? CreatedFrom,
    DateOnly? CreatedTo,
    List<string>? CaseStatuses,
    List<string>? HeirRoles)
{
    // The year bounds keep the Oslo-midnight conversion away from DateTimeOffset's limits.
    public bool IsValid() =>
        CreatedFrom is { Year: >= 2000 } from &&
        CreatedTo is { Year: <= 9998 } to &&
        from <= to &&
        (CaseStatuses ?? []).All(EstateCountOptions.IsValidCaseStatus) &&
        (HeirRoles ?? []).All(EstateCountOptions.IsValidHeirRole);

    public EstateCountFilters ToFilters() => new(
        CreatedFrom!.Value,
        CreatedTo!.Value,
        (CaseStatuses ?? []).Distinct().ToList(),
        (HeirRoles ?? []).Distinct().ToList());
}

public record Response(string Status);

public static class Endpoint
{
    public static IResult Post(
        [FromBody] Request request,
        HttpContext httpContext,
        [FromServices] EstateCountState state,
        [FromServices] Channel<EstateCountTrigger> channel)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var trigger = new EstateCountTrigger(
            DateTimeOffset.UtcNow,
            request.ToFilters(),
            httpContext.User.GetName());

        // The state guard, not the channel, is what prevents two overlapping counts. Marking the
        // run active before responding means a client that connects to the progress stream
        // immediately sees Running rather than Idle.
        if (!state.TryBeginRun(trigger))
            return TypedResults.Conflict();

        if (!channel.Writer.TryWrite(trigger))
        {
            state.EndRun(EstateCountStatus.Faulted, "Could not enqueue the estate count trigger.");
            return TypedResults.Conflict();
        }

        // A JSON body, not an empty one: AuditingLoggingMiddleware buffers and parses the
        // response of any POST that has a request body. The request body - the filters - is
        // what the audit log records for a count; see GetProgress for why that is all.
        return TypedResults.Accepted(string.Empty, new Response("Started"));
    }
}
```

- [ ] **Step 3: Create `CancelCount/Endpoint.cs`**

```csharp
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.EstateCount;

namespace oed_admin.Server.Features.Maintenance.EstateCount.CancelCount;

public static class Endpoint
{
    public static IResult Delete([FromServices] EstateCountState state) =>
        state.TryCancel()
            ? TypedResults.Accepted(string.Empty)
            : TypedResults.NotFound();
}
```

- [ ] **Step 4: Create `GetProgress/Endpoint.cs`**

```csharp
using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.EstateCount;

namespace oed_admin.Server.Features.Maintenance.EstateCount.GetProgress;

/// <remarks>
/// Audit: this stream returns matched estate ids and case numbers, but it is a GET without an
/// estateId route value, so AuditingLoggingMiddleware records no estates for it. That is a
/// deliberate product decision (spec 2026-10-28-estate-count-design.md, decision 10): the count
/// is treated as statistics, and only the filters - the StartCount request body - are audited.
/// </remarks>
public static class Endpoint
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(1);

    public static IResult Get(
        HttpContext httpContext,
        [FromServices] EstateCountState state,
        CancellationToken cancellationToken)
    {
        httpContext.Response.Headers.CacheControl = "no-store";
        // Belt and braces for reverse proxies that would otherwise buffer the stream.
        httpContext.Response.Headers["X-Accel-Buffering"] = "no";

        return TypedResults.ServerSentEvents(StreamSnapshots(state, cancellationToken));
    }

    /// <summary>
    /// The first snapshot on a connection carries every match and failure so far; later snapshots
    /// carry only what was appended since this connection's previous tick.
    /// </summary>
    private static async IAsyncEnumerable<EstateCountSnapshot> StreamSnapshots(
        EstateCountState state,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var sentMatches = 0;
        var sentFailures = 0;

        while (!cancellationToken.IsCancellationRequested)
        {
            var snapshot = state.GetSnapshot(sentMatches, sentFailures);
            sentMatches = snapshot.MatchCount;
            sentFailures = snapshot.FailureCount;

            yield return snapshot;

            // A finished or not-yet-started count has nothing more to say; the client reopens
            // the stream after starting a count.
            if (snapshot.Status != nameof(EstateCountStatus.Running))
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

- [ ] **Step 5: Register the routes in `Features/Endpoints.cs`**

Inside `MapMaintenanceEndpoints()`, after the `group.MapGet("/declarationpdfmigration/progress", ...)` line, add:

```csharp
            group.MapGet("/estatecount/options", Maintenance.EstateCount.GetOptions.Endpoint.Get);
            group.MapPost("/estatecount", Maintenance.EstateCount.StartCount.Endpoint.Post);
            group.MapDelete("/estatecount", Maintenance.EstateCount.CancelCount.Endpoint.Delete);
            group.MapGet("/estatecount/progress", Maintenance.EstateCount.GetProgress.Endpoint.Get);
```

The group already has `.RequireAuthorization(AuthorizationPolicies.RequireAdminRole)` in `MapFeatureEndpoints`, so nothing else is needed.

- [ ] **Step 6: Build**

Run: `dotnet build` (repo root)
Expected: `Build succeeded`. The `PostToolUse` hook that warns about unregistered `Features/**/Endpoint.cs` should be quiet once Step 5 is done.

- [ ] **Step 7: Commit**

```bash
git add oed-admin.Server/Features/Maintenance/EstateCount oed-admin.Server/Features/Endpoints.cs
git commit -m "Add estate count endpoints"
```

---

### Task 4: Client data layer — options query and progress hook

**Files:**
- Create: `oed-admin.client/src/queries/estateCountQueries.ts`
- Create: `oed-admin.client/src/components/estateCount/useEstateCountProgress.ts`

**Interfaces:**
- Consumes (Task 3): the HTTP contract above.
- Produces:
  - `estateCountQueries.ts`: `OptionValue`, `EstateCountOptions`, `estateCountKeys`, `useEstateCountOptionsQuery()`
  - `useEstateCountProgress.ts`: `RunStatus`, `EstateMatch`, `EstateCountFailure`, `EstateCountFilters`, `EstateCountSnapshot`, and `useEstateCountProgress(): { snapshot, matches, failures, error, connect }`

- [ ] **Step 1: Create `queries/estateCountQueries.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchWithMsal } from "../utils/msalUtils";

// Mirrors OptionValue from GET /api/maintenance/estatecount/options.
export interface OptionValue {
  value: string;
  label: string;
}

export interface EstateCountOptions {
  caseStatuses: OptionValue[];
  heirRoles: OptionValue[];
}

export const estateCountKeys = {
  all: ["estateCount"] as const,
  options: () => [...estateCountKeys.all, "options"] as const,
};

// The options are compiled into the server, so they never go stale within a session.
export const useEstateCountOptionsQuery = () => {
  return useQuery<EstateCountOptions>({
    queryKey: estateCountKeys.options(),
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetchWithMsal("/api/maintenance/estatecount/options");
      if (!response.ok) {
        throw new Error("Kunne ikke hente filtervalg for telling");
      }
      return response.json();
    },
  });
};
```

- [ ] **Step 2: Create `components/estateCount/useEstateCountProgress.ts`**

```ts
import React from "react";
import { fetchWithMsal } from "../../utils/msalUtils";
import { readSseStream } from "../../utils/sseReader";

export type RunStatus = "Idle" | "Running" | "Completed" | "Cancelled" | "Faulted";

export type EstateMatch = {
  estateId: string;
  caseNumber: string | null;
  // The selected heir roles this estate has - the groups it appears in. Empty without a role filter.
  heirRoles: string[];
};

export type EstateCountFailure = {
  estateId: string;
  reason: string;
  detail: string | null;
};

export type EstateCountFilters = {
  createdFrom: string;
  createdTo: string;
  caseStatuses: string[];
  heirRoles: string[];
};

export type EstateCountSnapshot = {
  status: RunStatus;
  startedAt: string | null;
  endedAt: string | null;
  startedBy: string | null;
  filters: EstateCountFilters | null;
  total: number;
  processed: number;
  matchCount: number;
  failureCount: number;
  // Every selected heir role, 0 included. Does not add up to matchCount: an estate counts
  // towards each of its roles, matchCount counts distinct estates.
  heirRoleCounts: Record<string, number>;
  matches: EstateMatch[];
  failures: EstateCountFailure[];
  error: string | null;
};

const progressUrl = "/api/maintenance/estatecount/progress";

/**
 * Holds the latest snapshot and the accumulated match and failure lists.
 *
 * Same protocol as useMigrationProgress: the server sends every match and failure on the first
 * snapshot of a connection and only the new ones afterwards, so both lists are appended - unless
 * snapshot.startedAt changes, which means a new count started on this still-open connection and
 * the previous count's lists must be dropped. matchCount and failureCount are authoritative: on
 * a mismatch the client reconnects once per connection to resynchronise.
 */
export function useEstateCountProgress() {
  const [snapshot, setSnapshot] = React.useState<EstateCountSnapshot | null>(null);
  const [matches, setMatches] = React.useState<EstateMatch[]>([]);
  const [failures, setFailures] = React.useState<EstateCountFailure[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [generation, setGeneration] = React.useState(0);

  // Bumping the generation tears down the current stream and opens a new one. Needed after
  // starting a count, because the server closes the stream as soon as the count is not Running.
  const connect = React.useCallback(() => setGeneration((value) => value + 1), []);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let isFirst = true;
    let previousStartedAt: string | null = null;
    let accumulatedMatches: EstateMatch[] = [];
    let accumulatedFailures: EstateCountFailure[] = [];
    // Guards the resync reconnect below so a persistent count mismatch cannot loop forever.
    let hasResynced = false;

    const run = async () => {
      try {
        const response = await fetchWithMsal(progressUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Kunne ikke hente status (${response.status})`);
        }

        if (cancelled) {
          return;
        }

        setError(null);

        await readSseStream<EstateCountSnapshot>(
          response,
          (payload) => {
            if (cancelled) {
              return;
            }
            setSnapshot(payload);

            if (isFirst || payload.startedAt !== previousStartedAt) {
              // First snapshot on this connection, or a new count started on it: the payload
              // carries the complete lists, so replace rather than append.
              isFirst = false;
              previousStartedAt = payload.startedAt;
              hasResynced = false;
              accumulatedMatches = payload.matches;
              accumulatedFailures = payload.failures;
            } else {
              if (payload.matches.length > 0) {
                accumulatedMatches = [...accumulatedMatches, ...payload.matches];
              }
              if (payload.failures.length > 0) {
                accumulatedFailures = [...accumulatedFailures, ...payload.failures];
              }
            }
            setMatches(accumulatedMatches);
            setFailures(accumulatedFailures);

            if (
              !hasResynced &&
              (accumulatedMatches.length !== payload.matchCount ||
                accumulatedFailures.length !== payload.failureCount)
            ) {
              hasResynced = true;
              connect();
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
  }, [generation, connect]);

  return { snapshot, matches, failures, error, connect };
}
```

Unlike `useMigrationProgress`, this hook doesn't clear the lists when a connection opens. It replaces them on the first snapshot of the connection instead. That way a reconnect never flashes an empty list, and never doubles the list (Review Focus 3).

- [ ] **Step 3: Type-check and lint**

Run (from `oed-admin.client/`): `npm ci` once if `node_modules` is stale, then `npm run build` and `npm run lint`.
Expected: both pass. These files aren't imported anywhere yet, but `tsc -b` still checks them.

- [ ] **Step 4: Commit**

```bash
git add oed-admin.client/src/queries/estateCountQueries.ts oed-admin.client/src/components/estateCount/useEstateCountProgress.ts
git commit -m "Add estate count options query and progress hook"
```

---

### Task 5: The page, route and menu item, plus the end-to-end check

**Files:**
- Create: `oed-admin.client/src/components/estateCount/index.tsx`
- Modify: `oed-admin.client/src/App.tsx`: import, a route next to `/maintenance/declarationpdfmigration`, and a `Dropdown.Item` under "Administrasjon"

**Interfaces:**
- Consumes (Task 4): `useEstateCountOptionsQuery`, `OptionValue`, `useEstateCountProgress`, `EstateMatch`, `RunStatus`, `EstateCountFilters`. Consumes (existing): `CopyToClipboard` (`components/copyToClipboard`, props `{ value, displayValue? }`), `fetchWithMsal`.
- Produces: the default export `EstateCount` page at `/maintenance/estatecount`.

- [ ] **Step 1: Create `components/estateCount/index.tsx`**

```tsx
import React from "react";
import {
  Breadcrumbs,
  Button,
  Checkbox,
  Details,
  Field,
  Fieldset,
  Heading,
  Input,
  Label,
  Paragraph,
  Table,
  Tag,
} from "@digdir/designsystemet-react";
import { Link } from "react-router-dom";
import { fetchWithMsal } from "../../utils/msalUtils";
import CopyToClipboard from "../copyToClipboard";
import { useEstateCountOptionsQuery, type OptionValue } from "../../queries/estateCountQueries";
import {
  useEstateCountProgress,
  type EstateCountFilters,
  type EstateMatch,
  type RunStatus,
} from "./useEstateCountProgress";

const countUrl = "/api/maintenance/estatecount";
const pageSize = 100;
const defaultCreatedFrom = "2024-01-01";

const statusLabels: Record<RunStatus, string> = {
  Idle: "Ikke startet",
  Running: "Kjører",
  Completed: "Fullført",
  Cancelled: "Avbrutt – delvis resultat",
  Faulted: "Feilet",
};

// Today's date in the browser's time zone, as yyyy-MM-dd for <input type="date">.
const today = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("nb-NO");
const formatTimestamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString("nb-NO") : "–");

// By case number, estates without one last (ordered by id) - spec decision 17.
const byCaseNumber = (a: EstateMatch, b: EstateMatch) => {
  if (a.caseNumber && b.caseNumber) {
    return a.caseNumber.localeCompare(b.caseNumber, "nb", { numeric: true });
  }
  if (a.caseNumber) return -1;
  if (b.caseNumber) return 1;
  return a.estateId.localeCompare(b.estateId);
};

const labelsFor = (values: string[], options: OptionValue[] | undefined) =>
  values.length === 0
    ? "Alle"
    : values.map((value) => options?.find((option) => option.value === value)?.label ?? value).join(", ");

// A sorted, linked list of hits with its own copy button and paging. Used once per heir-role
// group and once for all hits, so each keeps its own "Vis flere" position.
function HitList({ matches, copyLabel }: { matches: EstateMatch[]; copyLabel: string }) {
  const [visible, setVisible] = React.useState<number>(pageSize);
  const sorted = React.useMemo(() => [...matches].sort(byCaseNumber), [matches]);
  const copyValue = React.useMemo(
    () => sorted.map((match) => match.caseNumber ?? match.estateId).join("\n"),
    [sorted],
  );

  return (
    <>
      <CopyToClipboard value={copyValue} displayValue={`${copyLabel} (${sorted.length})`} />
      <ul>
        {sorted.slice(0, visible).map((match) => (
          <li key={match.estateId}>
            <Link to={`/estate/${match.estateId}`}>{match.caseNumber ?? match.estateId}</Link>
          </li>
        ))}
      </ul>
      {sorted.length > visible && (
        <Button variant="tertiary" onClick={() => setVisible((value) => value + pageSize)}>
          Vis flere ({sorted.length - visible} igjen)
        </Button>
      )}
    </>
  );
}

// One row per selected heir role (decision 20). An estate with several selected roles appears
// in each of their groups; counts come from the server so they are right even mid-resync.
function HeirRoleGroups({
  heirRoleCounts,
  matches,
  heirRoles,
}: {
  heirRoleCounts: Record<string, number>;
  matches: EstateMatch[];
  heirRoles: OptionValue[] | undefined;
}) {
  const groups = Object.entries(heirRoleCounts)
    .map(([role, count]) => ({
      role,
      count,
      label: heirRoles?.find((option) => option.value === role)?.label ?? role,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb"));

  return (
    <Table data-size="sm">
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Arvingrolle</Table.HeaderCell>
          <Table.HeaderCell>Treff</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {groups.map((group) => (
          <Table.Row key={group.role}>
            <Table.Cell>
              {group.count > 0 ? (
                <Details>
                  <Details.Summary>{group.label}</Details.Summary>
                  <Details.Content>
                    <HitList
                      matches={matches.filter((match) => match.heirRoles.includes(group.role))}
                      copyLabel="Kopier"
                    />
                  </Details.Content>
                </Details>
              ) : (
                group.label
              )}
            </Table.Cell>
            <Table.Cell>{group.count}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function FilterSummary({
  filters,
  caseStatuses,
  heirRoles,
}: {
  filters: EstateCountFilters;
  caseStatuses: OptionValue[] | undefined;
  heirRoles: OptionValue[] | undefined;
}) {
  return (
    <Table data-size="sm">
      <Table.Body>
        <Table.Row>
          <Table.HeaderCell>Opprettet</Table.HeaderCell>
          <Table.Cell>
            {formatDate(filters.createdFrom)} – {formatDate(filters.createdTo)}
          </Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell>Saksstatus</Table.HeaderCell>
          <Table.Cell>{labelsFor(filters.caseStatuses, caseStatuses)}</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell>Arvingroller</Table.HeaderCell>
          <Table.Cell>{labelsFor(filters.heirRoles, heirRoles)}</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  );
}

export default function EstateCount() {
  const optionsQuery = useEstateCountOptionsQuery();
  const { snapshot, matches, failures, error, connect } = useEstateCountProgress();
  const [statusText, setStatusText] = React.useState<string>("");
  const [visibleFailures, setVisibleFailures] = React.useState<number>(pageSize);

  const isRunning = snapshot?.status === "Running";
  const hasResult = snapshot !== null && snapshot.status !== "Idle";
  const isGrouped = (snapshot?.filters?.heirRoles.length ?? 0) > 0;

  const sortedHeirRoles = React.useMemo(
    () => [...(optionsQuery.data?.heirRoles ?? [])].sort((a, b) => a.label.localeCompare(b.label, "nb")),
    [optionsQuery.data],
  );

  const handleStart = async (formData: FormData) => {
    const postData = {
      createdFrom: formData.get("createdFrom")?.toString() ?? "",
      createdTo: formData.get("createdTo")?.toString() ?? "",
      caseStatuses: formData.getAll("caseStatuses").map(String),
      heirRoles: formData.getAll("heirRoles").map(String),
    };

    setStatusText("Starter...");
    const response = await fetchWithMsal(countUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postData),
    });

    if (response.status === 202) {
      setStatusText("Telling startet.");
      setVisibleFailures(pageSize);
      // The stream closes whenever the count is not Running, so reopen it now that one is.
      connect();
    } else if (response.status === 409) {
      setStatusText("En telling kjører allerede.");
    } else if (response.status === 400) {
      setStatusText("Ugyldige filtre. Sjekk at fra-dato ikke er etter til-dato.");
    } else {
      setStatusText(`Kunne ikke starte telling (${response.status}).`);
    }
  };

  const handleCancel = async () => {
    setStatusText("Avbryter...");
    const response = await fetchWithMsal(countUrl, { method: "DELETE" });
    setStatusText(response.status === 202 ? "Avbrudd forespurt." : "Fant ingen kjørende telling.");
  };

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
        Telling av dødsbo
      </Heading>
      <Paragraph>
        Teller dødsbo som matcher filtrene, og viser saksnumrene. Opprettet-dato og saksstatus
        hentes fra databasen. Velges arvingroller, hentes i tillegg skjemadataene til hvert dødsbo
        fra Altinn Storage, og da kan tellingen ta opptil en halvtime. Det kan bare kjøre én
        telling om gangen, og resultatet er synlig for alle administratorer.
      </Paragraph>

      {optionsQuery.isError && (
        <Paragraph data-color="danger">{(optionsQuery.error as Error).message}</Paragraph>
      )}

      <form action={handleStart}>
        <Fieldset>
          <Fieldset.Legend>Ny telling</Fieldset.Legend>
          <Fieldset.Description>Ingen valgt = alle</Fieldset.Description>

          <Field>
            <Label htmlFor="createdFrom">Opprettet fra</Label>
            <Input id="createdFrom" name="createdFrom" type="date" defaultValue={defaultCreatedFrom} required />
          </Field>
          <Field>
            <Label htmlFor="createdTo">Opprettet til</Label>
            <Input id="createdTo" name="createdTo" type="date" defaultValue={today()} required />
          </Field>

          <Fieldset>
            <Fieldset.Legend>Saksstatus</Fieldset.Legend>
            {optionsQuery.data?.caseStatuses.map((option) => (
              <Checkbox key={option.value} name="caseStatuses" value={option.value} label={option.label} />
            ))}
          </Fieldset>

          <Fieldset>
            <Fieldset.Legend>Arvingroller</Fieldset.Legend>
            {sortedHeirRoles.map((option) => (
              <Checkbox key={option.value} name="heirRoles" value={option.value} label={option.label} />
            ))}
          </Fieldset>

          <Button type="submit" disabled={isRunning || !optionsQuery.data}>
            Start telling
          </Button>
        </Fieldset>
      </form>

      {isRunning && (
        <Button variant="secondary" data-color="danger" onClick={handleCancel}>
          Avbryt
        </Button>
      )}

      <Paragraph>{statusText}</Paragraph>
      {error && (
        <>
          <Paragraph data-color="danger">Statusstrøm: {error}</Paragraph>
          <Button variant="secondary" onClick={connect}>
            Koble til på nytt
          </Button>
        </>
      )}

      {hasResult && snapshot && (
        <>
          <Heading level={2} data-size="md">
            Status:{" "}
            <Tag data-color={isRunning ? "info" : snapshot.status === "Faulted" ? "danger" : "neutral"}>
              {statusLabels[snapshot.status]}
            </Tag>
          </Heading>
          {snapshot.error && <Paragraph data-color="danger">Feil: {snapshot.error}</Paragraph>}

          <Paragraph>
            Startet av {snapshot.startedBy ?? "ukjent"} · {formatTimestamp(snapshot.startedAt)} –{" "}
            {formatTimestamp(snapshot.endedAt)}
          </Paragraph>
          {snapshot.filters && (
            <FilterSummary
              filters={snapshot.filters}
              caseStatuses={optionsQuery.data?.caseStatuses}
              heirRoles={optionsQuery.data?.heirRoles}
            />
          )}

          {isRunning && (
            <>
              <Paragraph>
                {snapshot.processed} av {snapshot.total} behandlet
              </Paragraph>
              <progress value={snapshot.processed} max={Math.max(snapshot.total, 1)} />
            </>
          )}

          <Heading level={2} data-size="lg">
            {snapshot.matchCount} treff
          </Heading>

          {isGrouped && (
            <HeirRoleGroups
              heirRoleCounts={snapshot.heirRoleCounts}
              matches={matches}
              heirRoles={optionsQuery.data?.heirRoles}
            />
          )}

          {matches.length > 0 && (
            <Details>
              <Details.Summary>
                {isGrouped ? `Alle treff (${snapshot.matchCount} unike)` : "Vis saksnummer"}
              </Details.Summary>
              <Details.Content>
                <HitList matches={matches} copyLabel="Kopier alle" />
              </Details.Content>
            </Details>
          )}

          {failures.length > 0 && (
            <Details>
              <Details.Summary>{snapshot.failureCount} kunne ikke sjekkes</Details.Summary>
              <Details.Content>
                <Table data-size="sm">
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Dødsbo</Table.HeaderCell>
                      <Table.HeaderCell>Årsak</Table.HeaderCell>
                      <Table.HeaderCell>Detaljer</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {failures.slice(0, visibleFailures).map((failure) => (
                      <Table.Row key={failure.estateId}>
                        <Table.Cell>
                          <Link to={`/estate/${failure.estateId}`}>{failure.estateId}</Link>
                        </Table.Cell>
                        <Table.Cell>{failure.reason}</Table.Cell>
                        <Table.Cell>{failure.detail}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
                {failures.length > visibleFailures && (
                  <Button variant="tertiary" onClick={() => setVisibleFailures((value) => value + pageSize)}>
                    Vis flere ({failures.length - visibleFailures} igjen)
                  </Button>
                )}
              </Details.Content>
            </Details>
          )}
        </>
      )}
    </>
  );
}
```

Each estate is processed at most once per count, so `estateId` is a safe React key in both lists.

- [ ] **Step 2: Wire the route and menu item into `App.tsx`**

Add the import next to `import DeclarationPdfMigration from "./components/declarationPdfMigration";`:

```tsx
import EstateCount from "./components/estateCount";
```

Inside the "Administrasjon" `Dropdown.List`, after the existing `Dropdown.Item` for "Migrering av skifteerklæring", add:

```tsx
                    <Dropdown.Item>
                      <Dropdown.Button onClick={() => navigate("/maintenance/estatecount")}>
                        Telling av dødsbo
                      </Dropdown.Button>
                    </Dropdown.Item>
```

In the admin route tree, after the `/maintenance/declarationpdfmigration` route, add:

```tsx
            <Route
              path="/maintenance/estatecount"
              element={<EstateCount />}
            />
```

- [ ] **Step 3: Type-check and lint**

Run (from `oed-admin.client/`): `npm run build`, then `npm run lint`.
Expected: both pass.

- [ ] **Step 4: End-to-end manual check**

Run: `dotnet run --project oed-admin.Server`, log in as an Admin in the Vite URL, and open "Telling av dødsbo" from the user menu. Check:

1. The page loads, the four statuses plus "Ingen status" and the 41 roles (alphabetical) render, and the dates default to 01.01.2024 and today.
2. **Database-only:** pick a short period and one status, then start. It completes in seconds with no Storage calls in the server log. Compare the count with:
   `select count(*) from estate where created >= '<from> 00:00 Europe/Oslo' and created < '<to+1> 00:00 Europe/Oslo' and case_status = '<STATUS>';`
   Check the column names against `OedDbContext` and its naming convention before running it.
3. **"Ingen status" only:** every row in the list shows an estate id, the rows sort last, and they link to the estate page.
4. **Heir roles:** pick a period of a few days and one role (e.g. Barn), then start. Progress moves and the server logs per-estate warnings only for failures. Spot-check two hits and one non-hit in the existing instance view on the estate page.
5. **Cancel** mid-run → "Avbrutt – delvis resultat", with the hits so far listed.
6. **409:** while a count with roles runs, start another in a second tab → "En telling kjører allerede."
7. **Reconnect (Review Focus 3):** while a count runs, open the page in a new tab. The hit count and the list length agree, and the list is not doubled.
8. **400 (Review Focus 4):** set "Opprettet fra" after "Opprettet til" → "Ugyldige filtre...".
9. "Kopier alle" puts every hit, one per line, on the clipboard (paste it into an editor and count the lines).
10. **Grouping (decision 20):** start with two roles over a few days, e.g. Barn and Gjenlevende ektefelle/partner, plus one rare role such as Fordringshaver.
    - The table shows all three roles, the rare one with 0 and not expandable.
    - An estate with both a child and a spouse appears in both groups.
    - The headline "N treff" equals the length of "Alle treff (N unike)", which is at most the sum of the group counts.
    - Each group's "Kopier" copies only that group.
    - A count without roles shows no table, and its list is titled "Vis saksnummer".

- [ ] **Step 5: Commit**

```bash
git add oed-admin.client/src/components/estateCount/index.tsx oed-admin.client/src/App.tsx
git commit -m "Add the estate count page"
```

---

### Task 6: Pre-PR review

**Files:** none (review only, unless the agents find something to fix).

- [ ] **Step 1: Sonar preflight**

Dispatch the `sonar-preflight` agent on the branch diff against `main`. Fix any findings it reports in the server C# code, then build again.

- [ ] **Step 2: Security review**

Dispatch the `security-reviewer` agent on the branch diff. Include in the prompt: "The estate count progress stream deliberately does not audit matched estate ids — that is decision 10 in docs/superpowers/specs/2026-10-28-estate-count-design.md. Review everything else." Fix any other findings.

- [ ] **Step 3: Final build**

Run: `dotnet build` (repo root), then from `oed-admin.client/`: `npm run build` and `npm run lint`.
Expected: all pass.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "Address review findings for estate count"
```

Skip this step if there was nothing to fix.
