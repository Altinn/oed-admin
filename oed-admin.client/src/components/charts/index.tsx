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

// Tiny inline trend line for a single table cell. Decorative: the cell already shows the
// value, so this is aria-hidden. `values` run oldest→newest, which is also the direction the
// line is drawn and the order trendKind compares.
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
          <text
            key={i}
            x={coords[i].x}
            y={LC_H - 8}
            // The last label would otherwise overflow past the right edge of the chart.
            textAnchor={i === points.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill={LC_MUTED}
          >
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
