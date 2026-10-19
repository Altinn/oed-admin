import { useState, type ReactNode } from "react";
import { Card, Heading, Paragraph, Skeleton, Textfield, ToggleGroup, ValidationMessage } from "@digdir/designsystemet-react";
import { MUTED, TRACK, gradient, todayUtc, type DayRange } from "./statsFormat";

export function Tile({ label, value, note, color }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <Card data-color="neutral">
      <Paragraph data-size="sm" style={{ color: MUTED }}>
        {label}
      </Paragraph>
      <Paragraph style={{ fontSize: "var(--ds-font-size-8)", fontWeight: 600, lineHeight: 1.1, color }}>{value}</Paragraph>
      {note && (
        <Paragraph data-size="xs" style={{ color: MUTED }}>
          {note}
        </Paragraph>
      )}
    </Card>
  );
}

export function Tiles({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
        gap: "var(--ds-size-4)",
        marginBottom: "var(--ds-size-4)",
      }}
    >
      {children}
    </div>
  );
}

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card data-color="neutral">
      <Heading level={3} data-size="xs">
        {title}
      </Heading>
      {subtitle && (
        <Paragraph data-size="sm" style={{ color: MUTED, marginBottom: "var(--ds-size-2)" }}>
          {subtitle}
        </Paragraph>
      )}
      {children}
    </Card>
  );
}

/**
 * A panel that shows the same data as a chart or as a table, chart first. The toggle is per
 * panel, so switching one doesn't change the others.
 */
export function ChartPanel({ title, subtitle, chart, table }: { title: string; subtitle?: string; chart: ReactNode; table: ReactNode }) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <Card data-color="neutral">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--ds-size-2)" }}>
        <div>
          <Heading level={3} data-size="xs">
            {title}
          </Heading>
          {subtitle && (
            <Paragraph data-size="sm" style={{ color: MUTED, marginBottom: "var(--ds-size-2)" }}>
              {subtitle}
            </Paragraph>
          )}
        </div>
        <ToggleGroup data-size="sm" data-toggle-group={`Visning av ${title}`} value={view} onChange={(value) => setView(value as "chart" | "table")}>
          <ToggleGroup.Item value="chart">Graf</ToggleGroup.Item>
          <ToggleGroup.Item value="table">Tabell</ToggleGroup.Item>
        </ToggleGroup>
      </div>
      {view === "chart" ? chart : <div style={{ overflowX: "auto" }}>{table}</div>}
    </Card>
  );
}

/**
 * From–to picker over whole UTC days. A half-typed or reversed date is ignored rather than sent,
 * so the query only refires on a complete, valid period.
 */
export function DateRangePicker({ value, onChange }: { value: DayRange; onChange: (range: DayRange) => void }) {
  const today = todayUtc();
  const update = (range: DayRange) => {
    if (range.from && range.to && range.from <= range.to && range.to <= today) onChange(range);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ds-size-4)", marginBottom: "var(--ds-size-4)" }}>
      <Textfield
        data-size="sm"
        label="Fra (UTC)"
        type="date"
        value={value.from}
        max={value.to}
        onChange={(event) => update({ ...value, from: event.target.value })}
      />
      <Textfield
        data-size="sm"
        label="Til (UTC)"
        type="date"
        value={value.to}
        min={value.from}
        max={today}
        onChange={(event) => update({ ...value, to: event.target.value })}
      />
    </div>
  );
}

/** Horizontal bar on a track; `fraction` is the filled share, 0–1. */
export function Bar({ fraction, color, height = "0.9rem" }: { fraction: number; color?: string; height?: string }) {
  return (
    <div style={{ background: TRACK, borderRadius: 4, height, flex: 1 }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, fraction * 100))}%`,
          height: "100%",
          borderRadius: 4,
          background: gradient("to right", color),
        }}
      />
    </div>
  );
}

/** The loading / error / empty states every statistics tab shares; renders `children` with the data otherwise. */
export function QueryState<T>({
  data,
  isLoading,
  error,
  isEmpty,
  loadingLabel,
  children,
}: {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  isEmpty: (data: T) => boolean;
  loadingLabel: string;
  children: (data: T) => ReactNode;
}) {
  if (isLoading) {
    return <Skeleton variant="rectangle" aria-label={loadingLabel} style={{ height: "18rem" }} />;
  }
  if (error) {
    return <ValidationMessage>Det oppstod en feil under henting av statistikken: {error.message}</ValidationMessage>;
  }
  if (data === undefined || isEmpty(data)) {
    return <Paragraph>Ingen data.</Paragraph>;
  }
  return <>{children(data)}</>;
}
