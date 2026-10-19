import { useRef, useState, type MouseEvent } from "react";
import { SERIES_COLORS, nearestIndex, niceTicks } from "./chartUtils";
import "./series.css";

// Column, multi-line and stacked-column charts for the statistics tabs. Same frame as LineChart:
// a fixed viewBox scaled to the container width, a zero-based y axis with hairline gridlines,
// thinned x labels and a hover tooltip. Subject-agnostic: callers format their own labels.
const W = 800;
const H = 280;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 56 };
const PLOT_W = W - MARGIN.left - MARGIN.right;
const PLOT_H = H - MARGIN.top - MARGIN.bottom;
const MAX_X_LABELS = 8;
const BAR_MAX_WIDTH = 24;
const BAR_RADIUS = 4;
// The surface-coloured gap between touching marks.
const GAP = 2;

const GRID = "var(--ds-color-neutral-border-subtle, #30363d)";
const MUTED = "var(--ds-color-neutral-text-subtle, #8b949e)";
const TEXT = "var(--ds-color-neutral-text-default, #e6edf3)";
const SURFACE = "var(--ds-color-neutral-background-default, #0d1117)";
const TOOLTIP_W = 240;
const TOOLTIP_LINE = 16;

const defaultFormat = (value: number) => value.toLocaleString("nb-NO", { maximumFractionDigits: 1 });

const baseline = MARGIN.top + PLOT_H;
const yScale = (topTick: number) => (value: number) => baseline - (value / topTick) * PLOT_H;

// A column with a rounded data end and a square foot on the baseline.
function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(BAR_RADIUS, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

function YAxis({ ticks, y, format }: { ticks: number[]; y: (value: number) => number; format: (value: number) => string }) {
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={MARGIN.left} x2={W - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
          <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED}>
            {format(tick)}
          </text>
        </g>
      ))}
    </>
  );
}

function XLabels({ labels, x }: { labels: string[]; x: (index: number) => number }) {
  const every = Math.max(1, Math.ceil(labels.length / MAX_X_LABELS));
  return (
    <>
      {labels.map((label, i) =>
        i % every === 0 ? (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            // The first and last labels would otherwise overflow the chart edges.
            textAnchor={labels.length > 1 && i === labels.length - 1 ? "end" : i === 0 && labels.length > 1 ? "start" : "middle"}
            fontSize={11}
            fill={MUTED}
          >
            {label}
          </text>
        ) : null,
      )}
    </>
  );
}

interface TooltipLine {
  text: string;
  color?: string;
}

function Tooltip({ anchorX, title, lines }: { anchorX: number; title: string; lines: TooltipLine[] }) {
  const height = 24 + lines.length * TOOLTIP_LINE;
  const left = anchorX + 8 + TOOLTIP_W > W ? anchorX - 8 - TOOLTIP_W : anchorX + 8;
  return (
    <g pointerEvents="none">
      <rect x={left} y={MARGIN.top} width={TOOLTIP_W} height={height} rx={4} fill={SURFACE} stroke={GRID} />
      <text x={left + 8} y={MARGIN.top + 16} fontSize={11} fill={MUTED}>
        {title}
      </text>
      {lines.map((line, i) => {
        const y = MARGIN.top + 16 + (i + 1) * TOOLTIP_LINE;
        return (
          <g key={i}>
            {line.color && <rect x={left + 8} y={y - 8} width={8} height={8} rx={2} fill={line.color} />}
            <text x={left + (line.color ? 22 : 8)} y={y} fontSize={12} fill={TEXT}>
              {line.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: "0 0 var(--ds-size-2)",
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--ds-size-1) var(--ds-size-4)",
        fontSize: "var(--ds-font-size-3)",
      }}
    >
      {items.map((item) => (
        <li key={item.name} style={{ display: "flex", alignItems: "center", gap: "var(--ds-size-1)" }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

export interface Column {
  label: string;
  value: number;
  /** Extra tooltip line under the value. */
  detail?: string;
}

/**
 * A labelled vertical line. `position` is in column widths from the left edge of the first
 * column, so 0 is the left edge and `columns.length` the right edge.
 */
export interface ColumnMarker {
  position: number;
  label: string;
}

export function ColumnChart({
  columns,
  ariaLabel,
  markers = [],
  formatValue = defaultFormat,
  color = SERIES_COLORS[0],
}: {
  columns: Column[];
  ariaLabel: string;
  markers?: ColumnMarker[];
  formatValue?: (value: number) => string;
  color?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (columns.length === 0) return null;

  const ticks = niceTicks(Math.max(...columns.map((column) => column.value)));
  const y = yScale(ticks[ticks.length - 1]);
  const band = PLOT_W / columns.length;
  const barWidth = Math.max(1, Math.min(BAR_MAX_WIDTH, band - GAP));
  const center = (i: number) => MARGIN.left + band * (i + 0.5);
  const visibleMarkers = markers.filter((marker) => marker.position >= 0 && marker.position <= columns.length);
  const active = hovered !== null && hovered < columns.length ? hovered : null;

  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <YAxis ticks={ticks} y={y} format={defaultFormat} />
      <XLabels labels={columns.map((column) => column.label)} x={center} />
      {columns.map((column, i) =>
        column.value > 0 ? (
          <path
            key={i}
            d={columnPath(center(i) - barWidth / 2, y(column.value), barWidth, baseline - y(column.value))}
            fill={color}
            opacity={active === null || active === i ? 1 : 0.6}
          />
        ) : null,
      )}
      {visibleMarkers.map((marker, i) => {
        const x = MARGIN.left + band * marker.position;
        // Labels in the right half hang to the left of the line so they stay inside the chart;
        // successive markers step down so labels of nearby markers don't overprint.
        const rightHalf = x > MARGIN.left + PLOT_W / 2;
        return (
          <g key={marker.label} pointerEvents="none">
            <line x1={x} x2={x} y1={MARGIN.top} y2={baseline} stroke={TEXT} strokeWidth={1} strokeDasharray="2 3" />
            <text x={rightHalf ? x - 4 : x + 4} y={MARGIN.top + 10 + i * 14} textAnchor={rightHalf ? "end" : "start"} fontSize={11} fill={TEXT}>
              {marker.label}
            </text>
          </g>
        );
      })}
      <g onMouseLeave={() => setHovered(null)}>
        {columns.map((_, i) => (
          <rect key={i} x={MARGIN.left + band * i} y={MARGIN.top} width={band} height={PLOT_H} fill="transparent" onMouseEnter={() => setHovered(i)} />
        ))}
      </g>
      {active !== null && (
        <Tooltip
          anchorX={center(active)}
          title={columns[active].label}
          lines={[
            { text: formatValue(columns[active].value) },
            ...(columns[active].detail ? [{ text: columns[active].detail }] : []),
          ]}
        />
      )}
    </svg>
  );
}

export interface ChartSeries {
  name: string;
  /** One value per label; null where the series has nothing to show. */
  values: (number | null)[];
  color: string;
}

export function MultiLineChart({
  labels,
  series,
  ariaLabel,
  formatValue = defaultFormat,
}: {
  labels: string[];
  series: ChartSeries[];
  ariaLabel: string;
  formatValue?: (value: number) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  if (labels.length === 0) return null;

  const all = series.flatMap((s) => s.values).filter((value): value is number => value !== null);
  const ticks = niceTicks(Math.max(0, ...all));
  const y = yScale(ticks[ticks.length - 1]);
  const x = (i: number) => (labels.length === 1 ? MARGIN.left + PLOT_W / 2 : MARGIN.left + (i / (labels.length - 1)) * PLOT_W);
  const xs = labels.map((_, i) => ({ x: x(i), y: 0 }));

  // Each run of consecutive values becomes its own polyline, so a null leaves a gap instead of
  // being drawn as zero.
  const runs = (values: (number | null)[]) => {
    const result: { i: number; value: number }[][] = [];
    let current: { i: number; value: number }[] = [];
    values.forEach((value, i) => {
      if (value === null) {
        if (current.length) result.push(current);
        current = [];
      } else {
        current.push({ i, value });
      }
    });
    if (current.length) result.push(current);
    return result;
  };

  const onMouseMove = (event: MouseEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setHovered(nearestIndex((event.clientX - rect.left) * (W / rect.width), xs));
  };

  const active = hovered !== null && hovered < labels.length ? hovered : null;

  return (
    <div>
      {series.length >= 2 && <Legend items={series} />}
      <svg ref={svgRef} role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <YAxis ticks={ticks} y={y} format={defaultFormat} />
        <XLabels labels={labels} x={x} />
        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={baseline} stroke={MUTED} strokeDasharray="3 3" pointerEvents="none" />
        )}
        {series.map((s) =>
          runs(s.values).map((run) =>
            run.length === 1 ? (
              <circle key={`${s.name}-${run[0].i}`} cx={x(run[0].i)} cy={y(run[0].value)} r={3} fill={s.color} />
            ) : (
              <polyline
                key={`${s.name}-${run[0].i}`}
                points={run.map((point) => `${x(point.i).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ),
          ),
        )}
        {active !== null &&
          series.map((s) => {
            const value = s.values[active];
            return value === null ? null : (
              <circle key={s.name} cx={x(active)} cy={y(value)} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} pointerEvents="none" />
            );
          })}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHovered(null)}
        />
        {active !== null && (
          <Tooltip
            anchorX={x(active)}
            title={labels[active]}
            lines={series.map((s) => {
              const value = s.values[active];
              return { color: s.color, text: `${s.name}: ${value === null ? "–" : formatValue(value)}` };
            })}
          />
        )}
      </svg>
    </div>
  );
}

export function StackedColumnChart({
  labels,
  series,
  ariaLabel,
  formatValue = defaultFormat,
}: {
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
  ariaLabel: string;
  formatValue?: (value: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (labels.length === 0) return null;

  const totals = labels.map((_, i) => series.reduce((total, s) => total + (s.values[i] ?? 0), 0));
  const ticks = niceTicks(Math.max(...totals));
  const y = yScale(ticks[ticks.length - 1]);
  const band = PLOT_W / labels.length;
  const barWidth = Math.max(1, Math.min(BAR_MAX_WIDTH * 1.5, band - GAP * 2));
  const center = (i: number) => MARGIN.left + band * (i + 0.5);
  const active = hovered !== null && hovered < labels.length ? hovered : null;

  return (
    <div>
      <Legend items={series} />
      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <YAxis ticks={ticks} y={y} format={defaultFormat} />
        <XLabels labels={labels} x={center} />
        {labels.map((_, i) => {
          const left = center(i) - barWidth / 2;
          // findLastIndex needs lib ES2023; tsconfig targets ES2022.
          const topIndex = series.reduce((last, s, index) => ((s.values[i] ?? 0) > 0 ? index : last), -1);
          let cumulative = 0;
          return (
            <g key={i} opacity={active === null || active === i ? 1 : 0.6}>
              {series.map((s, index) => {
                const value = s.values[i] ?? 0;
                if (value <= 0) return null;
                const bottom = y(cumulative);
                cumulative += value;
                const top = y(cumulative);
                // The gap comes off the bottom of every segment but the lowest, which sits on the baseline.
                const height = Math.max(0, bottom - top - (bottom < baseline ? GAP : 0));
                return index === topIndex ? (
                  <path key={s.name} d={columnPath(left, top, barWidth, height)} fill={s.color} />
                ) : (
                  <rect key={s.name} x={left} y={top} width={barWidth} height={height} fill={s.color} />
                );
              })}
            </g>
          );
        })}
        <g onMouseLeave={() => setHovered(null)}>
          {labels.map((_, i) => (
            <rect key={i} x={MARGIN.left + band * i} y={MARGIN.top} width={band} height={PLOT_H} fill="transparent" onMouseEnter={() => setHovered(i)} />
          ))}
        </g>
        {active !== null && (
          <Tooltip
            anchorX={center(active)}
            title={`${labels[active]} · ${formatValue(totals[active])} totalt`}
            lines={series
              .filter((s) => (s.values[active] ?? 0) > 0)
              .reverse()
              .map((s) => {
                const value = s.values[active];
                const share = totals[active] === 0 ? 0 : (100 * value) / totals[active];
                return { color: s.color, text: `${s.name}: ${formatValue(value)} (${defaultFormat(share)} %)` };
              })}
          />
        )}
      </svg>
    </div>
  );
}
