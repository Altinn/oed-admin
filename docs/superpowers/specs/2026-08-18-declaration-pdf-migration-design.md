# Declaration-PDF migration sweep — design

**Date:** 2026-08-18
**Repo:** `oed-admin`
**Status:** approved design, not yet implemented

## 1. Purpose

The skifteerklæring PDF is generated on each estate's **oed-declaration** instance as a
`ref-data-as-pdf` data element. The **oed** instance has no copy. The `oed` app exposes a
synchronous, one-estate-per-call endpoint that copies it across, and it is `oed-admin`'s job to
drive the sweep: find the estates that need it, call the endpoint for each, and report progress.

This is a **one-time backfill**. It is manually triggered by an admin, runs to completion, and is
expected to be run a handful of times. No scheduling, and no persistence of progress beyond the
process lifetime.

The consumer contract is documented in the `oed` repo at
`docs/migrate-declaration-pdf-consumer-guide.md`. That document is the source of truth for the
request shape, the outcome taxonomy and the retry semantics summarised below.

## 2. Prerequisites (outside this repo)

Neither can be worked around here; both block end-to-end testing.

1. **Maskinporten scope `digdir:dd:systemadmin`** must be registered and provisioned for
   `oed-admin`'s Maskinporten client in each target environment. It is a new scope;
   `digdir:dd:probatedeclarations` (used by the existing `IOedClient`) does **not** authorize this
   endpoint.
2. **The `oed` endpoint must be deployed** to the target environment. Check with an
   unauthenticated `POST` to `{appsUrl}/digdir/oed/api/admin/declaration-pdf`: `401` means it is
   there, `404` means the build predates the feature.

## 3. Scope of the sweep

Estates are selected from the `oed` database:

```csharp
Where(e => e.DeclarationInstanceId != null && e.DeclarationSubmitted != null)
```

Only **submitted** declarations. The `ref-data-as-pdf` element only exists once a declaration has
been submitted, so unsubmitted ones would return `NoPdfOnDeclaration` and waste a call. The
accepted risk: an estate whose `DeclarationSubmitted` was never populated is silently skipped.

## 4. Architecture

### 4.1 Components

A channel-triggered `BackgroundService` with a separate state singleton — the same shape as
`Infrastructure/DataMigration/InstanceToDbDataMigration`, with two deliberate differences: it is
actually registered in `Program.cs`, and the channel is bounded to capacity 1 behind an
"already running" guard so a double-click cannot queue a second sweep.

`Infrastructure/DeclarationPdfMigration/`

| File | Responsibility |
|---|---|
| `DeclarationPdfMigrationTrigger.cs` | `record DeclarationPdfMigrationTrigger(DateTimeOffset Timestamp, int? Limit, bool Overwrite, bool DryRun)` |
| `DeclarationPdfMigrationState.cs` | Singleton holding the current run: parameters, timestamps, `Total`, `Processed`, per-outcome counters, uncapped failure list, the run's `CancellationTokenSource`. Owns `TryBeginRun` / `EndRun`. |
| `DeclarationPdfMigrationService.cs` | The `BackgroundService`: reads the channel, enumerates estates, drives the calls, writes to state and `ILogger`. |
| `ServiceCollectionExtensions.cs` | `AddDeclarationPdfMigration()`: bounded channel (capacity 1), state singleton, hosted service. **Called from `Program.cs`.** |

`AddDataMigrationService()` remains unregistered and untouched — out of scope.

`Infrastructure/Altinn/` gains one typed client (§4.3), registered alongside the existing four.

`Features/Maintenance/DeclarationPdfMigration/` holds three operation folders — `StartMigration`,
`CancelMigration`, `GetProgress` — each a static `Endpoint` class plus its `Request`/`Response`
records, following the vertical-slice convention. This nests one level deeper than
`Features/<Area>/<Operation>/`; `DeclarationPdfMigration` acts as a sub-area.

### 4.2 Routes

Registered in `MapMaintenanceEndpoints` in `Features/Endpoints.cs`; the group already carries
`RequireAdminRole`.

| Route | Behaviour |
|---|---|
| `POST /api/maintenance/declarationpdfmigration` | Start a run. `202` accepted, `409` if a run is active, `400` if `limit <= 0`. Body: `{ limit?: int, overwrite: bool, dryRun: bool }`. |
| `DELETE /api/maintenance/declarationpdfmigration` | Cancel the active run. `202`, or `404` if no run is active. |
| `GET /api/maintenance/declarationpdfmigration/progress` | SSE stream of progress snapshots (§6). |

### 4.3 Outbound client

`IOedSystemAdminClient` / `OedSystemAdminClient`, registered in
`Infrastructure/Altinn/ServiceCollectionExtensions.cs` via `AddMaskinportenHttpClient` with
`Scope = "digdir:dd:systemadmin"`, `ExhangeToAltinnToken = false`, base address
`AltinnSettings.AppsUrl`, and an explicit `Timeout` of 60 seconds (each call blocks on two or
three Altinn Storage round-trips).

```csharp
Task<MigrateDeclarationPdfResult> MigrateDeclarationPdf(
    Guid estateId, bool overwrite, CancellationToken cancellationToken);
```

It posts `{ estateId, overwrite }` to `/{AppIds.Oed}/api/admin/declaration-pdf`.

Unlike the other clients in that file it must **not** call `EnsureSuccessStatusCode()` — the
failure bodies *are* the contract. It parses the `200` body, or the RFC 7807 body's `reason` and
`detail` on failure, and returns a result record rather than throwing. `outcome` and `reason` stay
`string` on the wire and parsing tolerates unknown fields, so a future addition to the taxonomy
cannot break deserialisation.

### 4.4 Outcome classification

The service branches on `reason`, never on the status code — two reasons share `404` and three
share `409`.

| Wire result | Disposition |
|---|---|
| `200` `Copied` / `Overwritten` | Done |
| `409` `AlreadyMigrated` | Done — counted separately, never reported as an error |
| `409` `NoPdfOnDeclaration` | Skipped — the declaration has no PDF yet |
| `404` `EstateNotFound`, `404` `NoDeclarationInstance`, `409` `InvalidEstateData` | Permanent failure — recorded with `detail` for the operator |
| unknown `reason`, or `400` | Permanent failure — surfaced, never retried |
| `502` `StorageError`, network error, client timeout | Retryable |
| `401` / `403` | **Abort the run** — the scope is not provisioned, so every remaining call would fail identically |

Retryable results are retried in place: 3 attempts, exponential backoff with jitter
(~2s / 6s / 18s). If all attempts fail, the estate is recorded as a failure and the sweep
continues.

## 5. Run lifecycle

1. **Start.** The endpoint validates the request, calls `state.TryBeginRun(trigger)` — the single
   atomic guard — and on success writes the trigger to the channel and returns `202`. A `false`
   return means a run is already active: `409`, and nothing is written to the channel. State is
   marked active *before* the response, so a client that connects to the SSE stream immediately
   sees `Running` rather than `Idle`.

2. **Enumerate once, up front.** The worker takes a scope and, with `.AsNoTracking()`, reads the
   filtered estate ids ordered by `Created`, applying `Take(limit)` when a limit was given, into a
   `List<Guid>`. Ids only — the endpoint needs no other field. Benefits: `Total` is known from the
   start, the database connection is released before the hours-long HTTP phase, and the memory
   cost stays trivial. The scope is disposed here; nothing later in the run touches the database.

3. **Dry run** stops here. It publishes `Total` with `Processed = 0`, logs the count, and ends the
   run as `Completed`. No HTTP call is made.

4. **Sweep.** `Parallel.ForEachAsync` over the id list with `MaxDegreeOfParallelism = 4`, using a
   token from `CancellationTokenSource.CreateLinkedTokenSource(stoppingToken)` stored in state —
   so operator cancellation and application shutdown travel the same path. Distinct ids guarantee
   no estate is ever called twice concurrently, which the consumer guide explicitly warns against;
   the single-run guard covers the same hazard across runs.

5. **Per estate:** call → classify → `Interlocked` increment of `Processed` and the matching
   outcome counter → on a failure disposition, append `{ estateId, reason, detail, status }` to
   the failure list (a `ConcurrentQueue`, appended under no lock). The list is **uncapped**: every
   failure must be visible in the UI. `NoDeclarationInstance` is expected in real volume, so a
   full run may accumulate tens of thousands of entries; at roughly 150 bytes each that is a few
   megabytes of process memory, which is acceptable — but it does shape how the list is
   transported (§6.1). A `401`/`403` cancels the run token and marks the run `Aborted`.

6. **End.** `state.EndRun(status)` with `Completed`, `Cancelled`, `Aborted` or `Faulted`, plus a
   summary log line. The finished state remains readable until the next run starts.

Re-running the whole sweep is safe and cheap: everything already done returns `AlreadyMigrated`
without touching Storage.

## 6. Progress transport

### 6.1 Snapshot

```
Status      : Idle | Running | Completed | Cancelled | Aborted | Faulted
StartedAt, EndedAt
DryRun, Overwrite, Limit
Total, Processed
Outcomes    : { Copied, Overwritten, AlreadyMigrated, NoPdfOnDeclaration,
                NoDeclarationInstance, EstateNotFound, InvalidEstateData,
                StorageError, Unknown }
FailureCount: int
Failures    : [ { EstateId, Reason, Detail, Status } ]   -- see below
```

Because the failure list is uncapped, a snapshot does **not** carry the whole list every second —
on a bad run that would mean re-sending megabytes per tick. Instead:

- the **first** snapshot on a connection carries every failure recorded so far, so a client that
  loads the page or reconnects mid-run gets complete state;
- **subsequent** snapshots carry only the failures appended since that connection's previous
  snapshot, and the client appends them to what it already holds;
- `FailureCount` always carries the authoritative total, so the client can detect a mismatch
  against its own list and reconnect to resynchronise.

Each connection tracks its own position in the failure list, so two operators watching the same
run each get a correct stream.

### 6.2 Server

`TypedResults.ServerSentEvents` (built into .NET 10) over an `IAsyncEnumerable`: a full snapshot
on connect, then one snapshot per second while the run is `Running`, then a final snapshot, after
which the stream completes.

`AuditingLoggingMiddleware` only buffers response bodies for `POST` requests with a body, so a
`GET` SSE stream passes through untouched. Its audit record for the stream is written when the
stream closes rather than when it opens — acceptable, and noted here so it is not mistaken for a
bug.

### 6.3 Client

The browser's native `EventSource` cannot send an `Authorization` header, so it cannot reach an
endpoint behind `RequireAdminRole`, and passing a token in the query string would leak it into the
audit log's `QueryString` field. The client therefore uses a **fetch-based SSE reader**:
`fetchWithMsal` returns the streaming response and a small hook parses `data:` frames off the
`ReadableStream`, exposing the latest counters as React state and accumulating the incremental
failure batches into one list. Roughly 30 lines of frame parsing, in exchange for keeping the
token in a header and the server side conventional.

## 7. Audit logging

The audit record for the `POST` that starts the run — operator identity, roles and request
parameters — is the compliance record. The background sweep runs outside the request pipeline and
writes no per-estate audit records: it copies a PDF that the estate's own heirs already have
access to, rather than performing a personal-data lookup on behalf of a named user. Per-estate
detail lives in the application logs.

## 8. Logging

`ILogger` / Application Insights is the durable record of a run, since no progress is persisted.

- `Debug` per estate for a done or skipped outcome
- `Warning` per failure, with estate id, `reason` and `detail`
- `Information` heartbeat every 250 estates processed
- `Information` on run start (parameters and `Total`) and on run end (the full tally)
- `Error` when a run aborts on `401`/`403`, or faults

## 9. Client UI

New component `src/components/declarationPdfMigration/`, routed at
`/maintenance/declarationpdfmigration` inside the admin route tree in `App.tsx`. Norwegian
user-facing text, Digdir Designsystemet components, modelled on the existing `dataMigration` page.

Contents:

- A form: antall estater (limit), overwrite switch, tørrkjøring (dry run) switch, start button
- A cancel button, shown while a run is active
- A progress bar (`Processed` / `Total`) and one counter card per outcome
- A failure table — estate id (linking to `/estate/:id`), reason, detail — holding every failure
  in the run, accumulated from the SSE stream as described in §6.1. It is filterable by reason,
  since `NoDeclarationInstance` is expected to dominate and would otherwise bury the defects worth
  chasing. Rendering is virtualised or paged so a run with tens of thousands of failures does not
  wedge the browser.

A link to the page is added to the avatar `Dropdown` menu in `App.tsx`'s `Layout`. `Layout` is
shared by the admin and reader route trees, so the item must be wrapped in an `isAdmin` guard
(already in scope in that component). The existing `/maintenance/datamigration` route is not
linked from anywhere; this page deliberately differs.

## 10. Verification

There is no unit test project in this repo and none is being added; the pieces are verified by
running them.

1. Confirm the two prerequisites in §2.
2. **Dry run** — check the estate count against expectations before any call is made.
3. **Limited run** (`limit: 10`) against test/TT02 — check that the counters move, the failure
   table populates with real `detail` text, the SSE stream updates live, and cancel stops the run.
4. **Full run** — expect a visible volume of `NoDeclarationInstance`; dangling declaration
   instance ids are known to exist in production data.
5. **Second full run** — `AlreadyMigrated` should account for nearly everything, proving
   idempotence.

## 11. Out of scope

- Displaying the migrated PDF anywhere. The `declaration-pdf` data type has
  `enablePdfCreation: false` and nothing in `oed` reads it; surfacing it is separate work in that
  repo.
- Any scheduled or recurring sweep. This is a one-time backfill.
- Persisting progress across restarts, and run history. A restart mid-run means starting the sweep
  again, which is cheap.
- Fixing the unregistered `AddDataMigrationService()`.
- **Multi-instance App Service.** The channel, the state singleton and the background service are
  all in-process, so the `409` single-run guard, the `DELETE` cancel and the SSE `GET` are only
  correct against the instance actually running the sweep. If the App Service ever scales to more
  than one instance, `POST` could land on an idle instance and start a second concurrent sweep, or
  `DELETE`/`GET` could land on an instance that isn't running it and see `Idle`/`404`. The
  pre-existing `InstanceToDbDataMigration` makes the same single-instance assumption. Any
  deployment (including of an unrelated change) also kills an in-flight run, since App Service
  restarts the process.
