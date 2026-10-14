import type { ReactNode } from "react";
import { Card, Heading, Paragraph, Skeleton, ValidationMessage } from "@digdir/designsystemet-react";
import { MUTED, TRACK, gradient } from "./statsFormat";

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
