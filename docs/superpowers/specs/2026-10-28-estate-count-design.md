# Telling av dødsbo (Estate count) — design

Date: 2026-10-28
Status: Approved in brainstorming, pending spec review

## Purpose

Admins need to count the estates that match a set of filters and see which case numbers they are. Two of the filters (created date, case status) are answered by the `oed` database. Heir roles only exist in the OED_M instance form data in Altinn Storage, so they are not a filter: a switch groups the result by heir role (decision 21), and Storage is only queried when that switch is on.

## Decisions (from brainstorming)

| # | Topic | Decision |
|---|---|---|
| 1 | Heir role source | `HeirV2.Role` in the OED_M instance form data (`(OedInstanceData.Heirs[].HeirV2 ?? .Heir).Role`), i.e. relation to the deceased |
| 2 | Valid heir roles | The values produced by `CloudEventMapper.MapRelation` in `digdir/oed-events` (41 URNs, see appendix) |
| 3 | Valid case statuses | `MOTTATT`, `FERDIGBEHANDLET`, `FEILFORT`, `OVERFORT_ANNEN_DOMSTOL` (DA spec `external_api.yaml`), plus an explicit "Ingen status" choice for `CaseStatus IS NULL` |
| 4 | Estates without case number | Listed by estate id; every row links to `/estate/{id}` |
| 5 | ~~Multiple roles selected~~ | Superseded by decision 21 — there is no heir-role filter |
| 6 | Volume / latency | ~20 000 estates since 2024-01-01; runs as a background job |
| 7 | Job model | Same as `DeclarationPdfMigration`: in-memory singleton state, `BackgroundService` + bounded channel, SSE progress, cancel. Not persisted; a restart loses the run |
| 8 | Concurrency of jobs | One global run. A second start gets `409`. Everyone sees the latest result |
| 9 | Storage failures | Retried when transient; final failures are listed as "kunne ikke sjekkes" and excluded from the hit count |
| 10 | Audit logging | **Deliberately** only the start request (filters) is audited. Matched estate ids are not written to the audit log. This was an explicit product decision — the result is treated as statistical |
| 11 | DB-only searches | Also run through the job (one code path) |
| 12 | Authorization | `RequireAdminRole` |
| 13 | Date filter | Dates only, both ends inclusive, interpreted in Europe/Oslo |
| 14 | Role labels | All 41 values shown, with Norwegian labels (appendix) |
| 15 | UI placement | Separate page `/maintenance/estatecount`, linked under "Administrasjon" in the user menu |
| 16 | Result metadata | Filters, who started it, start/end time, status |
| 17 | Hit list | Sorted by case number (estates without case number last, by id), linked rows, "Kopier alle" button |
| 18 | Storage access | Per estate: `GetInstance` + `GetInstanceData`, `MaxConcurrency = 4` as a `const` |
| 19 | Batching | DB phase reads estates in chunks of `BatchSize = 500` (`const`) with keyset pagination |
| 20 | Grouping by heir role | An estate appears in **every** group whose role it has; the headline total counts **distinct** estates. Each group has its own expandable case-number list and copy button; the combined distinct list stays below. (The "selected roles, 0 included" part is superseded by decision 21.) |
| 21 | Heir roles: switch, not filter | The heir-role filter is dropped — it never reduced Storage reads. A switch "Grupper etter arvingroller" (off by default) replaces it. Off: database only, no grouping. On: every estate in the date/status selection is read from Storage and the result is grouped by **every role that occurs**, sorted by label; roles with 0 hits are not shown; estates where no heir has a role get a row "Uten arvingrolle"; a role value outside the 41 known ones gets its own row under its raw URN |

## Backend

### Infrastructure — `oed-admin.Server/Infrastructure/EstateCount/`

- **`EstateCountTrigger`** — `record(DateTimeOffset Timestamp, EstateCountFilters Filters, string StartedBy)`.
- **`EstateCountFilters`** — `record(DateOnly CreatedFrom, DateOnly CreatedTo, IReadOnlyList<string> CaseStatuses, bool GroupByHeirRoles)`.
- **`EstateCountState`** — singleton, modelled on `DeclarationPdfMigrationState`:
  - `RunStatus { Idle, Running, Completed, Cancelled, Faulted }`
  - `TryBeginRun(trigger)` (the only guard against overlapping runs; resets all state), `SetCancellationSource`, `TryCancel`, `SetTotal`, `RecordMatch(EstateMatch)`, `RecordFailure(EstateCountFailure)`, `EndRun(status, error)`. Each `Record*` increments `Processed`; `RecordMatch` also increments the count of every role in `match.HeirRoles`.
  - `GetSnapshot(fromMatchIndex, fromFailureIndex)` returns only matches/failures from the given indexes onward.
  - `EstateMatch(Guid EstateId, string? CaseNumber, IReadOnlyList<string> HeirRoles)` — `HeirRoles` is every distinct role on this estate (empty when not grouped, or when no heir has a role); `EstateCountFailure(Guid EstateId, string Reason, string? Detail)`.
- **`EstateCountService`** — `BackgroundService` reading `Channel<EstateCountTrigger>`.
- **`EstateCountOptions`** — static source of truth for valid values:
  - `CaseStatuses` (the 4 DA statuses) and `NoStatus = "NONE"`
  - `HeirRoles`: ordered list of `(Urn, Label)` (appendix)
- **`ServiceCollectionExtensions.AddEstateCount()`** — bounded channel (capacity 1), singleton state, hosted service. Called from `Program.cs`.

### A run

1. Create a linked `CancellationTokenSource` (operator cancel + shutdown) and register it on the state.
2. Convert the dates: `from = CreatedFrom 00:00 Europe/Oslo → UTC`, `toExclusive = (CreatedTo + 1 day) 00:00 Europe/Oslo → UTC`. Filter is `Created >= from && Created < toExclusive`.
3. Case status filter, when any are selected: `CaseStatus IN (selected real statuses)`, plus `OR CaseStatus IS NULL` when `NONE` is selected.
4. `COUNT(*)` with these filters → `SetTotal`.
5. Read in chunks of `BatchSize = 500`, keyset on `(Created, Id)`, `ORDER BY Created, Id`, projecting `(Id, CaseNumber, InstanceId, Created)`. Each chunk uses its own short-lived scope and `OedDbContext` with `.AsNoTracking()`.
6. For each chunk:
   - **Not grouped:** every row → `RecordMatch` with empty `HeirRoles`.
   - **Grouped by heir role:** `Parallel.ForEachAsync` with `MaxConcurrency = 4` over the chunk:
     1. Parse `InstanceId` as `{partyId}/{instanceGuid}` → else failure `InvalidInstanceId`.
     2. `IAltinnClient.GetInstance` → `null` gives failure `NoOedInstance`.
     3. Pick the data element with `DataType == "oed" && ContentType == "application/xml"` (same rule as `InstanceToDbDataMigration`) → else `NoDataElement`.
     4. `GetInstanceData<OedInstanceData>` → deserialization failure gives `InvalidData`.
     5. Roles = the distinct non-empty `(heirInfo.HeirV2 ?? heirInfo.Heir)?.Role` over all heirs (not `GetHeir()`, which throws when both are null; such heirs and null roles contribute nothing). Every checked estate → `RecordMatch` with those roles, possibly none.
     6. Transient errors (HTTP 5xx, 429, timeouts, network-level `HttpRequestException`, Maskinporten `TokenRequestException`) are retried up to 3 attempts with 2 s, 6 s + jitter. After that, and for other non-2xx responses: `StorageError`.
     7. 401/403 from Storage aborts the whole run as `Faulted` with an explanatory error — every estate would fail the same way.
   - Check cancellation between chunks.
7. Ends with `Completed`, `Cancelled` (matches so far are kept) or `Faulted` (with error text). Log a summary.

Estates created during the run inside the period may or may not be included, depending on the cursor position. Acceptable; `Total` reflects the count at start.

### Endpoints — `oed-admin.Server/Features/Maintenance/EstateCount/`

Registered in `MapMaintenanceEndpoints` (the group already has `RequireAdminRole` applied in `MapFeatureEndpoints`).

| Method | Route | Folder | Result |
|---|---|---|---|
| GET | `/api/maintenance/estatecount/options` | `GetOptions/` | `{ caseStatuses: [{value,label}], heirRoles: [{value,label}] }` |
| POST | `/api/maintenance/estatecount` | `StartCount/` | `202 { status: "Started" }` / `409` / `400` |
| DELETE | `/api/maintenance/estatecount` | `CancelCount/` | `202` / `404` |
| GET | `/api/maintenance/estatecount/progress` | `GetProgress/` | SSE stream of snapshots |

**Request (POST):**

```json
{
  "createdFrom": "2024-01-01",
  "createdTo": "2026-10-28",
  "caseStatuses": ["MOTTATT", "NONE"],
  "groupByHeirRoles": true
}
```

`IsValid()`: both dates present, years within 2000–9998, `createdFrom <= createdTo`, every status in `CaseStatuses ∪ {NONE}`. An empty or `null` array = no filter. `heirRoles` in the options response is kept for group labels only.

`StartedBy` is taken from the `name` claim of the caller.

**Snapshot:**

```
status, startedAt, endedAt, startedBy,
filters { createdFrom, createdTo, caseStatuses, groupByHeirRoles },
total, processed, matchCount, failureCount,
heirRoleCounts: { [role]: number },          // every role that occurs; empty when not grouped
matches:  [{ estateId, caseNumber, heirRoles }], // incremental per connection
failures: [{ estateId, reason, detail }],    // incremental per connection
error
```

The first snapshot on a connection carries all matches and failures; later ones only what was appended since the previous tick on that connection. When status is not `Running` the stream sends one snapshot and closes. Tick interval 1 s, `Cache-Control: no-store`, `X-Accel-Buffering: no` (as in the migration).

### Audit

`AuditingLoggingMiddleware` logs the POST with its body (the filters). The SSE stream is a GET without an `estateId` route value, so the matched estate ids are **not** audited. This is decision 10 above. A comment in `GetProgress/Endpoint.cs` states this explicitly so that reviewers (and the `security-reviewer` agent) don't treat it as an oversight.

## Client — `oed-admin.client/src/components/estateCount/`

- `useEstateCountProgress.ts` — modelled on `declarationPdfMigration/useMigrationProgress.ts`: `readSseStream` via `fetchWithMsal`, accumulates `matches` and `failures`.
- `index.tsx` — the page.
- `src/queries/` — query key factory for the options call (TanStack Query).
- `App.tsx` — route `/maintenance/estatecount` in the admin route tree; menu item "Telling av dødsbo" under "Administrasjon".

**Page layout:**

1. `Fieldset` "Ny telling":
   - "Opprettet fra" and "Opprettet til", both defaulting to today, so the default count covers the current day only (changed from the original 01.01.2024 default after review)
   - Filterable multi-select (`EXPERIMENTAL_Suggestion multiple`) "Saksstatus": 4 statuses + "Ingen status", help text "Ingen valgt = alle"
   - Switch "Grupper etter arvingroller" (decision 21), off by default, with a note that it reads Storage and can take up to half an hour
   - "Start telling" — disabled while running
2. While running: progress bar (processed / total), running hit count, "Avbryt".
3. Result:
   - Metadata: filters, "Startet av", start/end, status (Fullført / Avbrutt — "Delvis resultat" / Feilet with error)
   - Large count: "N treff" (distinct estates)
   - **Only when grouped (decisions 20, 21):** a table with one row per role that occurs, sorted by label, plus "Uten arvingrolle" last when any: label and count (role counts from `heirRoleCounts`). Each row with hits expands (`Details`) to that role's case-number list — the matches whose `heirRoles` contain it — sorted and linked as below, with its own "Kopier" button
   - `Details` "Vis saksnummer" (labelled "Alle treff (N unike)" when grouped): sorted by case number, estates without case number last (estate id shown); each row links to `/estate/{id}`; "Kopier alle" copies the newline-separated list via `CopyToClipboard`
   - If `failureCount > 0`: `Details` "N kunne ikke sjekkes" with estate id (linked), reason, detail

All user-facing text is Norwegian.

## Verification

No unit test project exists. Verification is:

- `dotnet build`, and in `oed-admin.client/`: `npm ci`, `npm run build`, `npm run lint`
- Manual runs against TT02 / local:
  - DB-only search; compare the count with an equivalent SQL query
  - Grouped search over a short period; spot-check a few estates' groups against the existing instance view
  - An estate with both a child and a spouse appears in both groups; the total counts it once and equals the ungrouped count for the same filters (minus "kunne ikke sjekkes")
  - Cancel mid-run → `Cancelled` with partial result
  - Second start while running → `409`
- `sonar-preflight` and `security-reviewer` agents on the diff (inform the latter of decision 10)

## Out of scope (v1)

- Persistence across restarts
- Multiple concurrent searches / per-user searches
- Export beyond copy to clipboard
- Filters other than created date and case status (a heir-role filter was built and then dropped — decision 21)

## Appendix — heir roles and labels

Prefix `urn:digitaltdodsbo:arving:` omitted. Labels to be reviewed.

| Value | Label |
|---|---|
| `partAnnen` | Part, annen |
| `gjenlevEktefellePartner` | Gjenlevende ektefelle/partner |
| `gjenlevPartner` | Gjenlevende partner |
| `gjenlevSamboer` | Gjenlevende samboer |
| `gjenlevEktefelle` | Gjenlevende ektefelle |
| `barn` | Barn |
| `barnebarn` | Barnebarn |
| `barnebarnsBarn` | Barnebarns barn |
| `saerkullsbarn` | Særkullsbarn |
| `saerkullsbarnBarn` | Særkullsbarns barn |
| `far` | Far |
| `mor` | Mor |
| `soesken` | Søsken |
| `soeskensBarn` | Søskens barn |
| `soeskensBarnebarn` | Søskens barnebarn |
| `soeskensBarnebarnsBarn` | Søskens barnebarns barn |
| `halvSoesken` | Halvsøsken |
| `halvSoeskensBarn` | Halvsøskens barn |
| `halvSoeskensBarnebarn` | Halvsøskens barnebarn |
| `farfar` | Farfar |
| `farmor` | Farmor |
| `morfar` | Morfar |
| `mormor` | Mormor |
| `onkel` | Onkel |
| `tante` | Tante |
| `fetter` | Fetter |
| `kusine` | Kusine |
| `staten` | Staten |
| `avdoede` | Avdøde |
| `avdoedeEktefellePartner` | Avdødes ektefelle/partner |
| `fordringshaver` | Fordringshaver |
| `verge` | Verge |
| `foreldrevergeAktoer` | Foreldreverge |
| `midlertidigvergeAktoer` | Midlertidig verge |
| `fullmektig` | Fullmektig |
| `prosfull` | Prosessfullmektig |
| `fremtidsfullmektig` | Fremtidsfullmektig |
| `mottakerFullmaktDoedsboLitenVerdi` | Mottaker av fullmakt (dødsbo av liten verdi) |
| `testArvingFull` | Testamentarving (full) |
| `testArvingBegr` | Testamentarving (begrenset) |
| `ukjentRelasjon` | Ukjent relasjon |

## Appendix — case statuses and labels

| Value | Label |
|---|---|
| `MOTTATT` | Mottatt |
| `FERDIGBEHANDLET` | Ferdigbehandlet |
| `FEILFORT` | Feilført |
| `OVERFORT_ANNEN_DOMSTOL` | Overført annen domstol |
| `NONE` | Ingen status |
