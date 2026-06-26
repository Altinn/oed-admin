// Shared, JSX-free helpers for the QA dashboard: the metric column config, trend
// semantics (reused by the table arrow, sparklines and charts) and pure SVG geometry.

export type Direction = "lower" | "higher" | "neutral";

export interface MetricColumn {
  key: string;
  label: string;
  dir: Direction;
  debt?: boolean;
}

// "lower is better" for defect counts/duplication/debt, "higher is better" for coverage,
// "neutral" for size (LOC).
export const METRIC_COLUMNS: MetricColumn[] = [
  { key: "bugs", label: "Bugs", dir: "lower" },
  { key: "vulnerabilities", label: "Vulns", dir: "lower" },
  { key: "code_smells", label: "Smells", dir: "lower" },
  { key: "security_hotspots", label: "Hotspots", dir: "lower" },
  { key: "coverage", label: "Cov %", dir: "higher" },
  { key: "duplicated_lines_density", label: "Dup %", dir: "lower" },
  { key: "ncloc", label: "LOC", dir: "neutral" },
  { key: "complexity", label: "Cyclo", dir: "lower" },
  { key: "cognitive_complexity", label: "Cognitive", dir: "lower" },
  { key: "sqale_index", label: "Debt (t)", dir: "lower", debt: true },
];

export function formatTimestamp(iso: string): string {
  // Show the run time in UTC as yyyy-MM-dd HH:mm:ss, matching the standalone dashboard.
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

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

// Is moving from `prev` to `cur` good or bad, given the metric's preferred direction?
// "neutral" when there is no change or no directional preference.
export function trendKind(prev: number, cur: number, dir: Direction): TrendKind {
  if (!Number.isFinite(prev) || !Number.isFinite(cur) || cur === prev || dir === "neutral") {
    return "neutral";
  }
  const rose = cur > prev;
  return dir === "lower" ? (rose ? "bad" : "good") : rose ? "good" : "bad";
}

// --- Metric values & series ---

// Numeric value of a metric, applying the same debt minutes→hours conversion the table uses.
// Returns NaN when the metric is missing or unparseable.
export function metricNumber(metrics: Record<string, string>, col: MetricColumn): number {
  const raw = metrics[col.key];
  if (raw === undefined || raw === "") return NaN;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return NaN;
  return col.debt ? n / 60 : n;
}

// A metric value paired with the timestamp of the run it came from.
export interface MetricPoint {
  value: number;
  timestamp: string;
}

type SnapshotLike = { timestamp: string; metrics: Record<string, string> };

// Snapshots arrive newest-first; charts read oldest→newest. Non-finite values are dropped
// (value and timestamp stay aligned).
export function metricPoints(snapshots: readonly SnapshotLike[], col: MetricColumn): MetricPoint[] {
  const points: MetricPoint[] = [];
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const value = metricNumber(snapshots[i].metrics, col);
    if (Number.isFinite(value)) points.push({ value, timestamp: snapshots[i].timestamp });
  }
  return points;
}

export function metricSeries(snapshots: readonly SnapshotLike[], col: MetricColumn): number[] {
  return metricPoints(snapshots, col).map((p) => p.value);
}

// Display string for a numeric (already debt-converted) metric value.
export function formatMetricValue(col: MetricColumn, value: number): string {
  if (col.debt) return value.toFixed(1);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

export function polylinePoints(values: number[], width: number, height: number, pad = 0): string {
  return toPolyline(scalePoints(values, width, height, pad));
}
