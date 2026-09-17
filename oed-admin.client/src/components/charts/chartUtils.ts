// Subject-agnostic charting helpers, JSX-free: trend semantics and pure SVG geometry, with no
// knowledge of what is being plotted. Anything that names the thing on the axis -- metric
// columns, snapshot shapes, quality gates -- belongs to the feature that owns that vocabulary,
// not here.

export type Direction = "lower" | "higher" | "neutral";

// --- Trend semantics (single source of truth for arrows, sparklines, charts) ---

export type TrendKind = "good" | "bad" | "neutral";

// GitHub-style status colours, matching the original trend arrows.
const TREND_COLORS: Record<TrendKind, string> = {
  good: "#3fb950",
  bad: "#f85149",
  neutral: "#8b949e",
};

export function trendColor(kind: TrendKind): string {
  return TREND_COLORS[kind];
}

// Is moving from `prev` to `cur` good or bad, given the series' preferred direction?
// "neutral" when there is no change or no directional preference.
export function trendKind(prev: number, cur: number, dir: Direction): TrendKind {
  if (!Number.isFinite(prev) || !Number.isFinite(cur) || cur === prev || dir === "neutral") {
    return "neutral";
  }
  const rose = cur > prev;
  return dir === "lower" ? (rose ? "bad" : "good") : rose ? "good" : "bad";
}

// --- SVG geometry ---

export interface Point {
  x: number;
  y: number;
}

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

export function toPolyline(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

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
