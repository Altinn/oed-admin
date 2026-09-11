import { scalePoints, toPolyline, trendColor, trendKind, type Direction } from "./chartUtils";

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
