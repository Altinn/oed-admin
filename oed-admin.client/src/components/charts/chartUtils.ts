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

// Map a value series to SVG coordinates inside a width×height box, normalised to the series'
// own min/max. SVG y grows downward, so larger values sit higher (smaller y). A flat series
// (all equal) or single point is centred vertically.
export function scalePoints(values: number[], width: number, height: number, pad = 0): Point[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
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
