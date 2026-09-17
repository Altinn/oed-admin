# Estate Backlog ("Pågående") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only "Pågående" tab that charts the number of ongoing (declared but not yet probated) estates over time.

**Architecture:** A new vertical-slice endpoint `GET /api/statistics/estatebacklog` reads two timestamp columns for all eligible estates, turns them into +1/−1 events, and sweeps them once to produce an ongoing count at the end of each UTC day/week/month. The React client fetches it through TanStack Query and renders it with a new subject-agnostic hand-rolled SVG `LineChart`.

**Tech Stack:** ASP.NET Core 10 minimal APIs, EF Core (Npgsql, snake_case naming), React 19 + TypeScript 5.9 (strict, `erasableSyntaxOnly` — no TS `enum`s), TanStack Query 5, `@digdir/designsystemet-react` 1.x, `@navikt/aksel-icons`.

**Spec:** `docs/superpowers/specs/2026-09-17-estate-backlog-design.md`

## Global Constraints

- Ongoing at instant _t_: `DelarationCreated <= t` and (`ProbateIssued` is null or `ProbateIssued > t`). Note the entity property is spelled `DelarationCreated` (DB column `delaration_created`).
- Excluded entirely: `IsCancelled = true` or `CaseStatus = 'FEILFORT'`. Null branches written out explicitly.
- Never ongoing: `DelarationCreated` null; `ProbateIssued <= DelarationCreated`.
- No data floor — full history.
- All period boundaries are UTC. Weeks are ISO (Monday 00:00 UTC). Each point = count at the end of its period (events strictly before the next period start, or before `To` for the current period).
- Authorization: `AuthorizationPolicies.RequireAdminRole`. Response contains counts only.
- No new npm or NuGet dependencies. No EF Core migrations. No test project (decided in spec).
- Y axis starts at 0.
- User-facing text is Norwegian. Default resolution `Day`, default range 90 days.
- `npm run build` is the only SPA type check — every client task must run it (after `npm ci`).
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Work on branch `feature/estate-backlog` (already created; spec committed as `f3d58ea`).

**Refinement vs spec:** the spec says `scalePoints` gains `domainMin`. The chart needs the y top to match the rounded top tick too, so the parameter is `domain?: { min: number; max: number }` instead. Same intent, existing callers unchanged.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `oed-admin.Server/Features/Statistics/GetEstateBacklog/Request.cs` | Create | Query params, `BacklogResolution` enum, validation |
| `oed-admin.Server/Features/Statistics/GetEstateBacklog/Response.cs` | Create | `Response`, `BacklogPointDto` |
| `oed-admin.Server/Features/Statistics/GetEstateBacklog/Endpoint.cs` | Create | Query + event sweep + UTC period arithmetic |
| `oed-admin.Server/Features/Endpoints.cs` | Modify | Register route with `RequireAdminRole` |
| `oed-admin.client/src/components/charts/chartUtils.ts` | Modify | `scalePoints` domain param, `niceTicks`, `nearestIndex` |
| `oed-admin.client/src/components/charts/index.tsx` | Modify | Add `LineChart` |
| `oed-admin.client/src/queries/statisticsQueries.ts` | Modify | Backlog types, key factory, `useEstateBacklogQuery` |
| `oed-admin.client/src/components/estateBacklog/index.tsx` | Create | Tab content: text, headline, controls, chart |
| `oed-admin.client/src/components/Home.tsx` | Modify | New "Pågående" tab |

---

### Task 1: Backend endpoint

**Files:**
- Create: `oed-admin.Server/Features/Statistics/GetEstateBacklog/Request.cs`
- Create: `oed-admin.Server/Features/Statistics/GetEstateBacklog/Response.cs`
- Create: `oed-admin.Server/Features/Statistics/GetEstateBacklog/Endpoint.cs`
- Modify: `oed-admin.Server/Features/Endpoints.cs` (after the `estatecompletion` registration, ~line 43)

**Interfaces:**
- Consumes: `OedDbContext.Estate` (`Infrastructure/Database/Oed/Model/Estate.cs`: `DateTimeOffset? DelarationCreated`, `DateTimeOffset? ProbateIssued`, `bool? IsCancelled`, `string? CaseStatus`).
- Produces (HTTP contract used by Task 3):
  `GET /api/statistics/estatebacklog?resolution=Day|Week|Month&from=<ISO-8601>&to=<ISO-8601>` (all optional)
  → `200 { "points": [ { "periodStart": "2026-09-14", "ongoing": 1234 }, ... ] }` oldest first; `400` when `from >= to`.

- [ ] **Step 1: Create `Request.cs`**

```csharp
namespace oed_admin.Server.Features.Statistics.GetEstateBacklog;

public enum BacklogResolution
{
    Day,
    Week,
    Month
}

public record Request(BacklogResolution? Resolution, DateTimeOffset? From, DateTimeOffset? To)
{
    public BacklogResolution ResolutionOrDefault => Resolution ?? BacklogResolution.Day;

    /// <summary>
    /// No default for From: when omitted, the series starts at the period containing the earliest
    /// declaration, which is only known after querying.
    /// </summary>
    public DateTimeOffset ToOrDefault => To ?? DateTimeOffset.UtcNow;

    public bool IsValid() => From is null || From < ToOrDefault;
}
```

- [ ] **Step 2: Create `Response.cs`**

```csharp
namespace oed_admin.Server.Features.Statistics.GetEstateBacklog;

public record Response(IReadOnlyList<BacklogPointDto> Points);

/// <summary>
/// Number of ongoing estates at the end of the UTC period starting at <see cref="PeriodStart"/>.
/// For the current, unfinished period that is the count as of the request's To.
/// </summary>
public record BacklogPointDto(DateOnly PeriodStart, int Ongoing);
```

- [ ] **Step 3: Create `Endpoint.cs`**

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Statistics.GetEstateBacklog;

public static class Endpoint
{
    /// <summary>CaseStatus of a case the district court registered in error ("feilført").</summary>
    private const string MispostedCaseStatus = "FEILFORT";

    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        // No filter on From/To: an estate declared before the range can still be ongoing inside
        // it, so the running total needs the whole history.
        var estates = await dbContext.Estate
            .AsNoTracking()
            .Where(estate => estate.DelarationCreated != null)
            // Cancelled and mis-posted estates never reach probate and would sit in the backlog
            // forever. Neither flag is timestamped, so they are dropped from all of history. The
            // null branches are spelled out for the same reason as in GetEstateCompletion: a bare
            // <> in SQL drops NULL rows.
            .Where(estate => estate.IsCancelled == null || estate.IsCancelled == false)
            .Where(estate => estate.CaseStatus == null || estate.CaseStatus != MispostedCaseStatus)
            .Select(estate => new { estate.DelarationCreated, estate.ProbateIssued })
            .ToListAsync(cancellationToken);

        var events = new List<(DateTimeOffset At, int Delta)>(estates.Count * 2);
        foreach (var estate in estates)
        {
            var declared = estate.DelarationCreated!.Value;

            // Probate on or before the declaration is bad data; such an estate is never ongoing.
            if (estate.ProbateIssued is { } probate && probate <= declared)
                continue;

            events.Add((declared, +1));
            if (estate.ProbateIssued is { } issued)
                events.Add((issued, -1));
        }

        if (request.From is null && events.Count == 0)
            return TypedResults.Ok(new Response([]));

        events.Sort((a, b) => a.At.CompareTo(b.At));

        var resolution = request.ResolutionOrDefault;
        var to = request.ToOrDefault;
        var from = request.From ?? events[0].At;

        return TypedResults.Ok(new Response(Sweep(events, from, to, resolution)));
    }

    /// <summary>
    /// Walks the sorted events once, recording the running total at the end of each UTC period.
    /// An event counts towards a period when it happened strictly before the period's end; the
    /// last period ends at <paramref name="to"/> instead of at the next period start.
    /// </summary>
    private static List<BacklogPointDto> Sweep(
        List<(DateTimeOffset At, int Delta)> events,
        DateTimeOffset from,
        DateTimeOffset to,
        BacklogResolution resolution)
    {
        var points = new List<BacklogPointDto>();
        var total = 0;
        var index = 0;

        for (var periodStart = FloorToPeriod(from, resolution); periodStart < to;)
        {
            var nextStart = NextPeriod(periodStart, resolution);
            var evaluatedAt = nextStart < to ? nextStart : to;

            while (index < events.Count && events[index].At < evaluatedAt)
            {
                total += events[index].Delta;
                index++;
            }

            points.Add(new BacklogPointDto(DateOnly.FromDateTime(periodStart.UtcDateTime), total));
            periodStart = nextStart;
        }

        return points;
    }

    private static DateTimeOffset FloorToPeriod(DateTimeOffset value, BacklogResolution resolution)
    {
        var utc = value.ToUniversalTime();
        var day = new DateTimeOffset(utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero);

        return resolution switch
        {
            BacklogResolution.Day => day,
            // ISO weeks start on Monday; DayOfWeek.Sunday is 0, so shift it to 6.
            BacklogResolution.Week => day.AddDays(-(((int)day.DayOfWeek + 6) % 7)),
            BacklogResolution.Month => new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero),
            _ => throw new ArgumentOutOfRangeException(nameof(resolution), resolution, null)
        };
    }

    private static DateTimeOffset NextPeriod(DateTimeOffset periodStart, BacklogResolution resolution) =>
        resolution switch
        {
            BacklogResolution.Day => periodStart.AddDays(1),
            BacklogResolution.Week => periodStart.AddDays(7),
            BacklogResolution.Month => periodStart.AddMonths(1),
            _ => throw new ArgumentOutOfRangeException(nameof(resolution), resolution, null)
        };
}
```

- [ ] **Step 4: Register the route in `Features/Endpoints.cs`**

Insert directly after the `estatecompletion` registration (the `.RequireAuthorization(AuthorizationPolicies.RequireAdminRole);` line that follows `app.MapGet("/api/statistics/estatecompletion", ...)`):

```csharp

        // Ongoing-estate backlog over time, bucketed by UTC day/week/month. Counts only - no estate
        // ids, no personal data - so the audit middleware has nothing to extract, which is correct
        // here rather than an oversight.
        app.MapGet("/api/statistics/estatebacklog", Statistics.GetEstateBacklog.Endpoint.Get)
            .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);
```

- [ ] **Step 5: Build**

Run (repo root): `dotnet build`
Expected: `Build succeeded` with no new warnings from `Features/Statistics/GetEstateBacklog`. The PostToolUse hook that warns about unregistered `Endpoint.cs` files should be silent after Step 4.

- [ ] **Step 6: Commit**

```bash
git add oed-admin.Server/Features/Statistics/GetEstateBacklog oed-admin.Server/Features/Endpoints.cs
git commit -m "Add estate backlog statistics endpoint

GET /api/statistics/estatebacklog reports how many estates were ongoing
(declaration created, probate not yet issued) at the end of each UTC day,
ISO week or month. Cancelled and FEILFORT estates are excluded from all of
history; probate on or before the declaration is treated as never ongoing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Chart primitives (`LineChart`)

**Files:**
- Modify: `oed-admin.client/src/components/charts/chartUtils.ts`
- Modify: `oed-admin.client/src/components/charts/index.tsx`

**Interfaces:**
- Consumes: existing `scalePoints`, `toPolyline`, `Point` from `chartUtils.ts`. Existing callers: `charts/index.tsx` (`Sparkline`, `scalePoints(values, SPARK_W, SPARK_H, 2)`) and `qaDashboard/charts.tsx` (`scalePoints(values, plotW, plotH, 0)`) — both must keep compiling unchanged.
- Produces (used by Task 3):
  - `export interface LineChartPoint { label: string; value: number }` from `components/charts/index.tsx`
  - `export function LineChart({ points, ariaLabel }: { points: LineChartPoint[]; ariaLabel?: string })`
  - `chartUtils.ts`: `scalePoints(values, width, height, pad = 0, domain?: { min: number; max: number })`, `niceTicks(max: number, count = 5): number[]`, `nearestIndex(x: number, points: Point[]): number`

- [ ] **Step 1: Extend `scalePoints` in `chartUtils.ts`**

Replace the existing `scalePoints` (comment and function) with:

```ts
// Map a value series to SVG coordinates inside a width×height box. By default the y range is the
// series' own min/max; pass `domain` to pin it (e.g. { min: 0, max: topTick } for a chart whose
// axis starts at zero). SVG y grows downward, so larger values sit higher (smaller y). A flat
// range (min === max) or single point is centred.
export function scalePoints(
  values: number[],
  width: number,
  height: number,
  pad = 0,
  domain?: { min: number; max: number },
): Point[] {
  const min = domain?.min ?? Math.min(...values);
  const max = domain?.max ?? Math.max(...values);
  const span = max - min;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const n = values.length;
  return values.map((v, i) => ({
    x: pad + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    y: span === 0 ? pad + innerH / 2 : pad + innerH - ((v - min) / span) * innerH,
  }));
}
```

- [ ] **Step 2: Append `niceTicks` and `nearestIndex` to `chartUtils.ts`**

```ts
// Axis ticks from 0 up to a "nice" value at or above `max`, stepping by 1/2/5 × 10^n. Integer
// steps only, since the charts here plot counts. An all-zero series still gets a 0..1 axis.
export function niceTicks(max: number, count = 5): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  const step = Math.max(1, niceResidual * magnitude);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

// Index of the point whose x is closest to `x`, for snapping a hover position; -1 when empty.
export function nearestIndex(x: number, points: Point[]): number {
  let best = -1;
  let bestDistance = Infinity;
  points.forEach((p, i) => {
    const distance = Math.abs(p.x - x);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
```

- [ ] **Step 3: Add `LineChart` to `charts/index.tsx`**

Replace the import line at the top of the file with:

```tsx
import { useRef, useState, type MouseEvent } from "react";
import {
  nearestIndex,
  niceTicks,
  scalePoints,
  toPolyline,
  trendColor,
  trendKind,
  type Direction,
} from "./chartUtils";
```

Append to the end of the file:

```tsx
export interface LineChartPoint {
  label: string;
  value: number;
}

// Full-width line chart with a zero-based y axis, gridlines, thinned x labels and a hover tooltip
// that snaps to the nearest point. Subject-agnostic: callers format their own labels. Drawn in a
// fixed viewBox and scaled to the container width.
const LC_W = 800;
const LC_H = 280;
const LC_MARGIN = { top: 12, right: 16, bottom: 28, left: 56 };
const LC_MAX_X_LABELS = 6;
const LC_GRID = "var(--ds-color-neutral-border-subtle, #30363d)";
const LC_MUTED = "var(--ds-color-neutral-text-subtle, #8b949e)";
const LC_TEXT = "var(--ds-color-neutral-text-default, #e6edf3)";
const LC_LINE = "var(--ds-color-accent-base-default, #58a6ff)";
const LC_TOOLTIP_BG = "var(--ds-color-neutral-background-default, #0d1117)";
const LC_TOOLTIP_W = 140;
const LC_TOOLTIP_H = 40;

const formatCount = (value: number) => value.toLocaleString("nb-NO");

export function LineChart({ points, ariaLabel }: { points: LineChartPoint[]; ariaLabel?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length === 0) return null;

  const plotW = LC_W - LC_MARGIN.left - LC_MARGIN.right;
  const plotH = LC_H - LC_MARGIN.top - LC_MARGIN.bottom;
  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.max(...values));
  const topTick = ticks[ticks.length - 1];
  const coords = scalePoints(values, plotW, plotH, 0, { min: 0, max: topTick }).map((c) => ({
    x: c.x + LC_MARGIN.left,
    y: c.y + LC_MARGIN.top,
  }));
  const yFor = (value: number) => LC_MARGIN.top + plotH - (value / topTick) * plotH;
  const labelEvery = Math.max(1, Math.ceil(points.length / LC_MAX_X_LABELS));

  const onMouseMove = (event: MouseEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (LC_W / rect.width);
    setHovered(nearestIndex(x, coords));
  };

  const active = hovered !== null && hovered < points.length ? hovered : null;
  const activeCoord = active !== null ? coords[active] : null;
  const tooltipX =
    activeCoord && activeCoord.x + 8 + LC_TOOLTIP_W > LC_W
      ? activeCoord.x - 8 - LC_TOOLTIP_W
      : (activeCoord?.x ?? 0) + 8;

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${LC_W} ${LC_H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={LC_MARGIN.left}
            x2={LC_W - LC_MARGIN.right}
            y1={yFor(tick)}
            y2={yFor(tick)}
            stroke={LC_GRID}
            strokeWidth={1}
          />
          <text x={LC_MARGIN.left - 8} y={yFor(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={LC_MUTED}>
            {formatCount(tick)}
          </text>
        </g>
      ))}

      {points.map((point, i) =>
        i % labelEvery === 0 ? (
          <text key={i} x={coords[i].x} y={LC_H - 8} textAnchor="middle" fontSize={11} fill={LC_MUTED}>
            {point.label}
          </text>
        ) : null,
      )}

      {points.length >= 2 ? (
        <polyline
          points={toPolyline(coords)}
          fill="none"
          stroke={LC_LINE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        <circle cx={coords[0].x} cy={coords[0].y} r={3} fill={LC_LINE} />
      )}

      {active !== null && activeCoord && (
        <g pointerEvents="none">
          <line
            x1={activeCoord.x}
            x2={activeCoord.x}
            y1={LC_MARGIN.top}
            y2={LC_MARGIN.top + plotH}
            stroke={LC_MUTED}
            strokeDasharray="3 3"
          />
          <circle cx={activeCoord.x} cy={activeCoord.y} r={4} fill={LC_LINE} />
          <rect
            x={tooltipX}
            y={LC_MARGIN.top}
            width={LC_TOOLTIP_W}
            height={LC_TOOLTIP_H}
            rx={4}
            fill={LC_TOOLTIP_BG}
            stroke={LC_GRID}
          />
          <text x={tooltipX + 8} y={LC_MARGIN.top + 16} fontSize={11} fill={LC_MUTED}>
            {points[active].label}
          </text>
          <text x={tooltipX + 8} y={LC_MARGIN.top + 32} fontSize={13} fontWeight={600} fill={LC_TEXT}>
            {formatCount(points[active].value)}
          </text>
        </g>
      )}

      <rect
        x={LC_MARGIN.left}
        y={LC_MARGIN.top}
        width={plotW}
        height={plotH}
        fill="transparent"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
      />
    </svg>
  );
}
```

Note: the hooks are called before the early `return null`, so the rules-of-hooks lint rule is satisfied.

- [ ] **Step 4: Type-check and lint**

Run (in `oed-admin.client/`):
```powershell
npm ci
npm run build
npm run lint
```
Expected: `tsc -b` reports no errors (in particular `qaDashboard/charts.tsx` and `Sparkline` still compile), `vite build` succeeds, eslint reports no errors.

- [ ] **Step 5: Commit**

```bash
git add oed-admin.client/src/components/charts
git commit -m "Add zero-based LineChart to the shared chart components

scalePoints takes an optional fixed domain so the axis can start at zero
and end on a rounded tick. niceTicks and nearestIndex back the axis and
the hover tooltip. Existing Sparkline and QA dashboard callers are
unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Query, "Pågående" tab and component

**Files:**
- Modify: `oed-admin.client/src/queries/statisticsQueries.ts`
- Create: `oed-admin.client/src/components/estateBacklog/index.tsx`
- Modify: `oed-admin.client/src/components/Home.tsx`

**Interfaces:**
- Consumes: HTTP contract from Task 1; `LineChart`, `LineChartPoint` from `components/charts` (Task 2); `trendColor`, `trendKind` from `components/charts/chartUtils`; `fetchWithMsal` from `utils/msalUtils`.
- Produces: `export default function EstateBacklog()`; exports from `statisticsQueries.ts`: `BacklogResolution`, `BacklogRange`, `EstateBacklogPoint`, `EstateBacklogResponse`, `estateBacklogKeys`, `useEstateBacklogQuery`.

- [ ] **Step 1: Add backlog query to `statisticsQueries.ts`**

Change the first import line to:

```ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
```

Append to the end of the file:

```ts
// Mirrors GET /api/statistics/estatebacklog. One point per UTC day, ISO week or month, oldest
// first; `ongoing` is the number of estates with a declaration created and no probate issued at
// the end of that period (or as of now, for the current period).
export type BacklogResolution = "Day" | "Week" | "Month";
export type BacklogRange = "30d" | "90d" | "1y" | "all";

export interface EstateBacklogPoint {
  periodStart: string; // yyyy-MM-dd, UTC
  ongoing: number;
}

export interface EstateBacklogResponse {
  points: EstateBacklogPoint[];
}

export const estateBacklogKeys = {
  all: ["estateBacklog"] as const,
  list: (resolution: BacklogResolution, range: BacklogRange) =>
    [...estateBacklogKeys.all, resolution, range] as const,
};

// Start of the selected range at UTC midnight; undefined means "all", which the server starts at
// the earliest declaration.
function rangeStart(range: BacklogRange): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (range === "30d") start.setUTCDate(start.getUTCDate() - 30);
  else if (range === "90d") start.setUTCDate(start.getUTCDate() - 90);
  else start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start.toISOString();
}

export const useEstateBacklogQuery = (resolution: BacklogResolution, range: BacklogRange) => {
  return useQuery<EstateBacklogResponse>({
    queryKey: estateBacklogKeys.list(resolution, range),
    queryFn: async () => {
      const params = new URLSearchParams({ resolution });
      const from = rangeStart(range);
      if (from) params.set("from", from);
      const response = await fetchWithMsal(`/api/statistics/estatebacklog?${params}`);
      if (!response.ok) {
        throw new Error("Kunne ikke hente statistikk for pågående dødsbo");
      }
      return response.json();
    },
    placeholderData: keepPreviousData,
  });
};
```

- [ ] **Step 2: Create `components/estateBacklog/index.tsx`**

```tsx
import { useState, type ReactNode } from "react";
import { Heading, Paragraph, Skeleton, ToggleGroup, ValidationMessage } from "@digdir/designsystemet-react";
import {
  useEstateBacklogQuery,
  type BacklogRange,
  type BacklogResolution,
  type EstateBacklogPoint,
} from "../../queries/statisticsQueries";
import { LineChart, type LineChartPoint } from "../charts";
import { trendColor, trendKind } from "../charts/chartUtils";

const RANGE_TEXT: Record<BacklogRange, string> = {
  "30d": "siste 30 dager",
  "90d": "siste 90 dager",
  "1y": "siste år",
  all: "totalt",
};

const MONTH_FORMAT = new Intl.DateTimeFormat("nb-NO", { month: "short", year: "2-digit", timeZone: "UTC" });

// ISO 8601 week number of a UTC date (the week containing the Thursday decides the year).
function isoWeek(date: Date): number {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

function formatPeriod(periodStart: string, resolution: BacklogResolution): string {
  const date = new Date(`${periodStart}T00:00:00Z`);
  switch (resolution) {
    case "Day": {
      const [year, month, day] = periodStart.split("-");
      return `${day}.${month}.${year.slice(2)}`;
    }
    case "Week":
      return `uke ${isoWeek(date)}`;
    case "Month":
      return MONTH_FORMAT.format(date);
  }
}

function toChartPoints(points: EstateBacklogPoint[], resolution: BacklogResolution): LineChartPoint[] {
  return points.map((point) => ({ label: formatPeriod(point.periodStart, resolution), value: point.ongoing }));
}

function Headline({ points, range }: { points: EstateBacklogPoint[]; range: BacklogRange }) {
  const first = points[0].ongoing;
  const last = points[points.length - 1].ongoing;
  const delta = last - first;
  // A shrinking backlog is the good direction.
  const color = trendColor(trendKind(first, last, "lower"));
  const sign = delta > 0 ? "+" : "";

  return (
    <Paragraph data-size="lg" style={{ marginBottom: "var(--ds-size-3)" }}>
      Pågående nå: <strong>{last.toLocaleString("nb-NO")}</strong>{" "}
      <span style={{ color }}>
        ({sign}
        {delta.toLocaleString("nb-NO")} {RANGE_TEXT[range]})
      </span>
    </Paragraph>
  );
}

export default function EstateBacklog() {
  const [resolution, setResolution] = useState<BacklogResolution>("Day");
  const [range, setRange] = useState<BacklogRange>("90d");
  const { data, isLoading, error } = useEstateBacklogQuery(resolution, range);

  let content: ReactNode;
  if (isLoading) {
    content = <Skeleton variant="rectangle" aria-label="Henter pågående dødsbo" style={{ height: "18rem" }} />;
  } else if (error) {
    content = <ValidationMessage>Det oppstod en feil under henting av statistikken: {error.message}</ValidationMessage>;
  } else if (!data || data.points.length === 0) {
    content = <Paragraph>Ingen data.</Paragraph>;
  } else {
    content = (
      <>
        <Headline points={data.points} range={range} />
        <LineChart points={toChartPoints(data.points, resolution)} ariaLabel="Antall pågående dødsbo over tid" />
      </>
    );
  }

  return (
    <>
      <Heading level={2} data-size="xl">
        Pågående dødsbo
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Et dødsbo regnes som pågående fra skifteerklæringen er opprettet til skifteattesten er utstedt.
        Kansellerte og feilførte saker er holdt utenfor. Periodene er i UTC, og hvert punkt viser antallet
        ved slutten av perioden. Tall fra før juni 2025 er ufullstendige, fordi tabellen ble innført da.
      </Paragraph>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ds-size-4)", marginBottom: "var(--ds-size-3)" }}>
        <ToggleGroup
          data-size="sm"
          data-toggle-group="Oppløsning"
          value={resolution}
          onChange={(value) => setResolution(value as BacklogResolution)}
        >
          <ToggleGroup.Item value="Day">Dag</ToggleGroup.Item>
          <ToggleGroup.Item value="Week">Uke</ToggleGroup.Item>
          <ToggleGroup.Item value="Month">Måned</ToggleGroup.Item>
        </ToggleGroup>
        <ToggleGroup
          data-size="sm"
          data-toggle-group="Periode"
          value={range}
          onChange={(value) => setRange(value as BacklogRange)}
        >
          <ToggleGroup.Item value="30d">30 dager</ToggleGroup.Item>
          <ToggleGroup.Item value="90d">90 dager</ToggleGroup.Item>
          <ToggleGroup.Item value="1y">1 år</ToggleGroup.Item>
          <ToggleGroup.Item value="all">Alt</ToggleGroup.Item>
        </ToggleGroup>
      </div>
      {content}
    </>
  );
}
```

- [ ] **Step 3: Add the tab in `Home.tsx`**

Add `HourglassIcon,` to the `@navikt/aksel-icons` import list, and add after `import EstateCompletion from "./estateCompletion";`:

```tsx
import EstateBacklog from "./estateBacklog";
```

After the `completion` tab trigger:

```tsx
          <Tabs.Tab value="completion">
            <CheckmarkCircleIcon /> Fullført
          </Tabs.Tab>
          <Tabs.Tab value="backlog">
            <HourglassIcon /> Pågående
          </Tabs.Tab>
```

After the `completion` panel:

```tsx
        <Tabs.Panel value="completion">
          <EstateCompletion />
        </Tabs.Panel>
        <Tabs.Panel value="backlog">
          <EstateBacklog />
        </Tabs.Panel>
```

- [ ] **Step 4: Type-check and lint**

Run (in `oed-admin.client/`):
```powershell
npm run build
npm run lint
```
Expected: no `tsc` errors (the `switch` in `formatPeriod` is exhaustive over `BacklogResolution`, so no missing-return error), vite build succeeds, no eslint errors.

- [ ] **Step 5: Commit**

```bash
git add oed-admin.client/src/queries/statisticsQueries.ts oed-admin.client/src/components/estateBacklog oed-admin.client/src/components/Home.tsx
git commit -m "Add Pågående tab charting the ongoing-estate backlog

Resolution (dag/uke/måned) and range (30 dager/90 dager/1 år/alt) are
selectable, defaulting to daily over 90 days. Shows the current count and
its change over the selected range above the chart.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: End-to-end verification and review

**Files:** none expected. If a check fails, fix in the file owning the defect and commit the fix with a message describing it.

**Interfaces:**
- Consumes: everything from Tasks 1–3; local `oed` database (see `/setup-dev`).

- [ ] **Step 1: Run the app**

Run (repo root): `dotnet run --project oed-admin.Server`
Open the Vite URL (`https://localhost:60475`), sign in as an Admin, open the **Pågående** tab.

- [ ] **Step 2: SQL cross-check**

For each sample date `D` — one in early 2025, `2025-06-15`, `2025-07-15`, and yesterday (UTC) — run against the `oed` database:

```sql
SELECT COUNT(*)
FROM estate
WHERE delaration_created IS NOT NULL
  AND (is_cancelled IS NULL OR is_cancelled = false)
  AND (case_status IS NULL OR case_status <> 'FEILFORT')
  AND NOT (probate_issued IS NOT NULL AND probate_issued <= delaration_created)
  AND delaration_created < (DATE 'D' + INTERVAL '1 day') AT TIME ZONE 'UTC'
  AND (probate_issued IS NULL OR probate_issued >= (DATE 'D' + INTERVAL '1 day') AT TIME ZONE 'UTC');
```

Select **Dag** + **Alt**, open the browser devtools Network tab, find the `estatebacklog` response and read the `ongoing` value for `periodStart = D`.
Expected: identical numbers for every sample date.

- [ ] **Step 3: Edge-case checks**

- In the SQL console, count rows with `probate_issued <= delaration_created` and rows that are cancelled/FEILFORT with a declaration; confirm Step 2's query (which excludes them) still matched the endpoint.
- **Uke** + **Alt**: every `periodStart` in the response is a Monday.
- **Måned** + **1 år**: every `periodStart` ends in `-01`.
- For every combination, the last point's `ongoing` equals "Pågående nå" in the UI.
- Requesting `/api/statistics/estatebacklog?from=2030-01-01T00:00:00Z` returns `400`.

- [ ] **Step 4: UI checks**

- Default state: **Dag** and **90 dager** are selected.
- All 12 resolution × range combinations render; the chart doesn't blank while switching.
- Y axis starts at 0; x labels don't overlap; tooltip follows the mouse, snaps to points and flips left near the right edge.
- Loading skeleton appears on first load; stopping the backend and reloading shows the error message.
- Check the tab in both light and dark themes if the app offers them.

- [ ] **Step 5: Review agents**

Dispatch the `security-reviewer` and `sonar-preflight` agents on the branch diff (`git diff main...HEAD`). Fix any confirmed findings and commit each fix.

- [ ] **Step 6: Confirm clean state**

Run: `git status` and `git log --oneline main..HEAD`
Expected: clean working tree; commits for spec, plan, backend, chart, tab, plus any fix commits.
