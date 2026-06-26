import type { CSSProperties } from "react";
import { Paragraph } from "@digdir/designsystemet-react";
import {
  formatMetricValue,
  formatTimestamp,
  scalePoints,
  toPolyline,
  trendColor,
  trendKind,
  type Direction,
  type MetricColumn,
  type MetricPoint,
} from "./chartUtils";

// Muted chrome colours fall back to GitHub-style hexes when the design tokens are absent,
// so charts stay legible in both light and dark mode.
const GRID = "var(--ds-color-neutral-border-subtle, #30363d)";
const MUTED = "var(--ds-color-neutral-text-subtle, #8b949e)";

// Tiny inline trend line for a single overview table cell. Decorative: the cell already
// shows the value and the arrow, so this is aria-hidden.
const SPARK_W = 64;
const SPARK_H = 18;

export function Sparkline({ values, dir }: { values: number[]; dir: Direction }) {
  if (values.length === 0) return null;
  const coords = scalePoints(values, SPARK_W, SPARK_H, 2);
  const last = coords[coords.length - 1];
  const kind = values.length >= 2 ? trendKind(values[0], values[values.length - 1], dir) : "neutral";
  const color = trendColor(kind);
  return (
    <svg
      aria-hidden
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      style={{ display: "block", marginLeft: "auto" }}
    >
      {values.length >= 2 && (
        <polyline
          points={toPolyline(coords)}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <circle cx={last.x} cy={last.y} r={1.6} fill={color} />
    </svg>
  );
}

// One small-multiple line chart for a single metric over the run history.
const CHART_W = 240;
const CHART_H = 120;
const CHART_M = { top: 14, right: 8, bottom: 16, left: 8 };

const cardStyle: CSSProperties = {
  border: `1px solid ${GRID}`,
  borderRadius: "6px",
  padding: "var(--ds-size-2)",
  margin: 0,
};
const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  fontSize: "0.8rem",
  marginBottom: "var(--ds-size-1)",
};
const cardValueStyle: CSSProperties = { fontVariantNumeric: "tabular-nums", fontWeight: 600 };

export function MetricChart({ col, points }: { col: MetricColumn; points: MetricPoint[] }) {
  if (points.length < 2) {
    return (
      <figure style={cardStyle}>
        <figcaption style={cardHeaderStyle}>
          <span>{col.label}</span>
          {points.length === 1 && <span style={cardValueStyle}>{formatMetricValue(col, points[0].value)}</span>}
        </figcaption>
        <Paragraph data-size="xs" style={{ color: MUTED, margin: 0 }}>
          Ikke nok historikk
        </Paragraph>
      </figure>
    );
  }

  const values = points.map((p) => p.value);
  const latest = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const plotW = CHART_W - CHART_M.left - CHART_M.right;
  const plotH = CHART_H - CHART_M.top - CHART_M.bottom;
  const coords = scalePoints(values, plotW, plotH, 0);
  const color = trendColor(trendKind(values[0], latest, col.dir));

  return (
    <figure style={cardStyle}>
      <figcaption style={cardHeaderStyle}>
        <span>{col.label}</span>
        <span style={cardValueStyle}>{formatMetricValue(col, latest)}</span>
      </figcaption>
      <svg
        width="100%"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label={`${col.label} over tid`}
        style={{ display: "block" }}
      >
        <g transform={`translate(${CHART_M.left} ${CHART_M.top})`}>
          <line x1={0} y1={0} x2={plotW} y2={0} stroke={GRID} strokeWidth={1} />
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke={GRID} strokeWidth={1} />
          <polyline
            points={toPolyline(coords)}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {coords.map((c, i) => (
            <circle key={points[i].timestamp} cx={c.x} cy={c.y} r={1.8} fill={color}>
              <title>{`${formatTimestamp(points[i].timestamp)}: ${formatMetricValue(col, values[i])}`}</title>
            </circle>
          ))}
          <text x={0} y={-4} fontSize={9} fill={MUTED}>
            {`maks ${formatMetricValue(col, max)}`}
          </text>
          <text x={0} y={plotH + 11} fontSize={9} fill={MUTED}>
            {`min ${formatMetricValue(col, min)}`}
          </text>
        </g>
      </svg>
    </figure>
  );
}

// Horizontal strip of one block per run (oldest→newest), green for a passing quality gate
// and red otherwise. Colours match the GitHub-style palette used by the trend arrows.
const GATE_OK = "#3fb950";
const GATE_FAIL = "#f85149";

export function GateTimeline({ snapshots }: { snapshots: readonly { timestamp: string; gateStatus: string }[] }) {
  if (snapshots.length === 0) return null;
  const ordered = [...snapshots].reverse();
  const cw = 12;
  const gap = 3;
  const h = 16;
  const width = ordered.length * cw + (ordered.length - 1) * gap;
  return (
    <svg
      width={width}
      height={h}
      viewBox={`0 0 ${width} ${h}`}
      role="img"
      aria-label="Quality gate-historikk"
      style={{ display: "block", maxWidth: "100%" }}
    >
      {ordered.map((s, i) => (
        <rect
          key={s.timestamp}
          x={i * (cw + gap)}
          y={0}
          width={cw}
          height={h}
          rx={2}
          fill={s.gateStatus === "OK" ? GATE_OK : GATE_FAIL}
        >
          <title>{`${formatTimestamp(s.timestamp)} — ${s.gateStatus}`}</title>
        </rect>
      ))}
    </svg>
  );
}
