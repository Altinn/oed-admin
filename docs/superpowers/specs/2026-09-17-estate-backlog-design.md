# Estate backlog ("Pågående dødsbo") — design

Date: 2026-09-17
Status: Approved; implemented on feature/estate-backlog

## Goal

Give admins a view of how many estates are still unfinished, and how that number has moved
over time, rendered as a line chart in a new top-level tab.

## Definitions

- **Ongoing at instant _t_**: `DelarationCreated <= t` and (`ProbateIssued` is null or `ProbateIssued > t`).
- **Completed**: `ProbateIssued` is not null.
- **Excluded entirely** (from every point in history): `IsCancelled = true` or `CaseStatus = 'FEILFORT'`.
  Neither flag has a timestamp, so history before cancellation is slightly understated. Accepted.
- **Never ongoing**:
  - `DelarationCreated` is null (even if `ProbateIssued` is set).
  - `ProbateIssued <= DelarationCreated` (bad data).
- **No data floor**: full history is shown, including the artificial ramp-up around the
  2025-06-11 introduction of the `estate` table (older estates were backfilled on their next
  case update). The explanatory text calls this out.

## Time semantics

- All period boundaries are **UTC**.
- Resolutions: `Day` (UTC midnight), `Week` (ISO, Monday 00:00 UTC), `Month` (1st, 00:00 UTC).
- Each point's value is the **ongoing count at the end of its period**, evaluated at the
  exclusive period end (i.e. counting events strictly before the next period start). For the
  current, unfinished period the evaluation instant is `To` (default: now).

## Backend

Vertical slice `oed-admin.Server/Features/Statistics/GetEstateBacklog/` (`Endpoint.cs`,
`Request.cs`, `Response.cs`).

### Route and authorization

`GET /api/statistics/estatebacklog`, registered in `Features/Endpoints.cs` beside
`estatecompletion`, with `AuthorizationPolicies.RequireAdminRole`. Comment as for its neighbour:
the response is counts only, no estate ids or personal data, so the audit middleware extracting
nothing is correct.

### Request (`[AsParameters]`)

| Field        | Type                          | Default                                              |
|--------------|-------------------------------|------------------------------------------------------|
| `Resolution` | enum `Day` / `Week` / `Month` | `Day`                                                |
| `From`       | `DateTimeOffset?`             | UTC start of the period containing the earliest included `DelarationCreated` |
| `To`         | `DateTimeOffset?`             | `DateTimeOffset.UtcNow`                              |

`IsValid()`: resolved `From < To`, `From >= 2000-01-01` and `To <= now + 1 day`. These bounds keep
a single request from generating millions of periods or pushing period arithmetic past
`DateTimeOffset`'s limits; when `From` is omitted it is floored at 2000-01-01 the same way.
Invalid → `TypedResults.BadRequest()`. If there are no included estates and `From` is omitted,
return an empty `Points` list.

### Query

Single `OedDbContext.Estate` read with `.AsNoTracking()`:

- `DelarationCreated != null`
- `IsCancelled == null || IsCancelled == false`
- `CaseStatus == null || CaseStatus != "FEILFORT"` (null branches written out, as in
  `GetEstateCompletion`)
- Project to `DelarationCreated`, `ProbateIssued` only.
- **No filter on `From`/`To`** — estates declared before the range contribute to its running total.

### Computation (in memory)

1. Drop rows with `ProbateIssued <= DelarationCreated`.
2. Emit events: `+1` at `DelarationCreated`; `-1` at `ProbateIssued` when set.
3. Sort events by timestamp.
4. Generate period starts from `From` (floored to the resolution) up to `To`. For each period,
   the evaluation instant is `min(nextPeriodStart, To)`.
5. Single forward sweep over the sorted events, accumulating a running total, recording the
   total for each evaluation instant (events with timestamp `< instant` are counted).

### Response

```csharp
public record Response(IReadOnlyList<BacklogPointDto> Points);          // oldest first
public record BacklogPointDto(DateOnly PeriodStart, int Ongoing);
```

## Frontend

### Query — `src/queries/statisticsQueries.ts`

- Types `EstateBacklogPoint { periodStart: string; ongoing: number }`, `EstateBacklogResponse { points: EstateBacklogPoint[] }`.
- Types `BacklogResolution = "Day" | "Week" | "Month"`, `BacklogRange = "30d" | "90d" | "1y" | "all"`.
- `estateBacklogKeys.list(resolution, range)`.
- `useEstateBacklogQuery(resolution, range)`: derives `from` (today UTC minus 30 days / 90 days /
  1 year; omitted for `all`), calls `fetchWithMsal`, throws
  `"Kunne ikke hente statistikk for pågående dødsbo"` on non-OK, uses
  `placeholderData: keepPreviousData`.

### Tab — `src/components/Home.tsx`

New `Tabs.Tab value="backlog"` directly after "Fullført": `HourglassIcon` + "Pågående", panel
renders `<EstateBacklog />`.

### Component — `src/components/estateBacklog/index.tsx`

Top to bottom:

1. `Heading` "Pågående dødsbo".
2. Explanatory paragraph (Norwegian): ongoing from skifteerklæring created until skifteattest
   issued; cancelled and feilførte excluded; periods in UTC, each point is the count at period end;
   figures before June 2025 are incomplete because the table was introduced then.
3. Headline: "Pågående nå: **N**" (last point), always. When there are at least two points, a
   coloured, signed change since the first point's period is appended, labelled by that period
   rather than by the selected range (e.g. "+123 siden 17.09.26", "0 siden uke 38"), because the
   first point is the end of a floored period and a fixed range label like "siste 90 dager" can
   overstate the actual span. Coloured via `trendColor(trendKind(first, last, "lower"))`.
4. Controls: two `ToggleGroup`s — Oppløsning (Dag / Uke / Måned, default Dag) and Periode
   (30 dager / 90 dager / 1 år / Alt, default 90 dager).
5. `LineChart`, with `Skeleton` (loading), `ValidationMessage` (error) and "Ingen data" (empty)
   states matching the Fullført tab.

X-axis label formats: Day `17.09.26`, Week `uke 38`, Month `sep. 26`.

### Chart — `src/components/charts/`

`LineChart` in `index.tsx`, subject-agnostic:

- Props: `points: { label: string; value: number }[]`, `ariaLabel?: string`.
- Responsive SVG (`viewBox`, width 100%).
- **Y axis starts at 0**; ~5 gridlines at nice tick values.
- X axis with thinned labels to avoid overlap.
- Hover: transparent overlay, snap to nearest point, crosshair + tooltip (label and value).

`chartUtils.ts` additions (pure, JSX-free):

- `scalePoints` gains an optional `domainMin` parameter; when given, the y domain is
  `[domainMin, max]`. Sparkline callers are unchanged.
- `niceTicks(max, count)` for the y axis.
- `nearestIndex(x, points)` for hover snapping.

## Verification

No test project will be added (decided). Verification is manual:

1. `dotnet build`.
2. In `oed-admin.client`: `npm ci`, `npm run build`, `npm run lint`.
3. SQL cross-check against `oed` for 3–4 sample dates (early 2025, around the June 2025 backfill,
   recent) using an independent `COUNT(*)` with the same definition; compare with the endpoint.
4. Edge cases: `ProbateIssued <= DelarationCreated` and cancelled/FEILFORT rows are excluded;
   `all` + `Week` starts on a Monday; last point equals "Pågående nå".
5. In the running app: every resolution × range combination, hover tooltip, loading/error states.
6. Run the `security-reviewer` and `sonar-preflight` agents on the diff before opening the PR.

## Delivery

Branch `feature/estate-backlog`, one PR. Commits: spec; backend endpoint; chart component;
query and tab.

## Out of scope

- Unit/integration test project.
- Read-role access / `RestrictedHome`.
- The pre-existing mismatch between the `estatecompletion` commit message (`AtLeastReadRole`)
  and its code (`RequireAdminRole`).
