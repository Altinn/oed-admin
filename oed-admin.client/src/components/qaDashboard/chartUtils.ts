// SonarQube-specific helpers for the QA dashboard: the metric column config, metric value
// parsing and series extraction. The generic trend semantics and SVG geometry these build on
// live in ../charts/chartUtils, which knows nothing about Sonar.

import type { Direction } from "../charts/chartUtils";

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
