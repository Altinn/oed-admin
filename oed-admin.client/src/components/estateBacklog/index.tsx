import { useState, type ReactNode } from "react";
import { Heading, Paragraph, Skeleton, ToggleGroup, ValidationMessage } from "@digdir/designsystemet-react";
import {
  useEstateBacklogQuery,
  type BacklogRange,
  type BacklogResolution,
  type EstateBacklogPoint,
} from "../../queries/statisticsQueries";
import { LineChart, type LineChartPoint } from "../charts";
import { trendColor, trendKind } from "../charts/chartUtils";

const MONTH_FORMAT = new Intl.DateTimeFormat("nb-NO", { month: "short", year: "2-digit", timeZone: "UTC" });

// ISO 8601 week number of a UTC date (the week containing the Thursday decides the year).
function isoWeek(date: Date): number {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

function formatPeriod(periodStart: string, resolution: BacklogResolution): string {
  const date = new Date(`${periodStart}T00:00:00Z`);
  switch (resolution) {
    case "Day": {
      const [year, month, day] = periodStart.split("-");
      return `${day}.${month}.${year.slice(2)}`;
    }
    case "Week":
      return `uke ${isoWeek(date)}`;
    case "Month":
      return MONTH_FORMAT.format(date);
  }
}

function toChartPoints(points: EstateBacklogPoint[], resolution: BacklogResolution): LineChartPoint[] {
  return points.map((point) => ({ label: formatPeriod(point.periodStart, resolution), value: point.ongoing }));
}

function Headline({ points, resolution }: { points: EstateBacklogPoint[]; resolution: BacklogResolution }) {
  const last = points[points.length - 1].ongoing;

  // With a single point there is no earlier value to compare against, so only the current count
  // is shown.
  let change: ReactNode = null;
  if (points.length >= 2) {
    const first = points[0].ongoing;
    const delta = last - first;
    // A shrinking backlog is the good direction.
    const color = trendColor(trendKind(first, last, "lower"));
    const sign = delta > 0 ? "+" : "";
    change = (
      <span style={{ color }}>
        {" "}
        ({sign}
        {delta.toLocaleString("nb-NO")} siden {formatPeriod(points[0].periodStart, resolution)})
      </span>
    );
  }

  return (
    <Paragraph data-size="lg" style={{ marginBottom: "var(--ds-size-3)" }}>
      Pågående nå: <strong>{last.toLocaleString("nb-NO")}</strong>
      {change}
    </Paragraph>
  );
}

export default function EstateBacklog() {
  const [resolution, setResolution] = useState<BacklogResolution>("Day");
  const [range, setRange] = useState<BacklogRange>("90d");
  const { data, isLoading, error, isPlaceholderData } = useEstateBacklogQuery(resolution, range);

  let content: ReactNode;
  if (isLoading) {
    content = <Skeleton variant="rectangle" aria-label="Henter pågående dødsbo" style={{ height: "18rem" }} />;
  } else if (error) {
    content = <ValidationMessage>Det oppstod en feil under henting av statistikken: {error.message}</ValidationMessage>;
  } else if (!data || data.points.length === 0) {
    content = <Paragraph>Ingen data.</Paragraph>;
  } else {
    // Dimmed while a toggle change is refetching, so the previous (stale) numbers and chart don't
    // read as current.
    content = (
      <div style={{ opacity: isPlaceholderData ? 0.5 : 1, transition: "opacity 150ms" }} aria-busy={isPlaceholderData}>
        <Headline points={data.points} resolution={resolution} />
        <LineChart points={toChartPoints(data.points, resolution)} ariaLabel="Antall pågående dødsbo over tid" />
      </div>
    );
  }

  return (
    <>
      <Heading level={2} data-size="xl">
        Pågående dødsbo
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Et dødsbo regnes som pågående fra skifteerklæringen er opprettet til skifteattesten er utstedt.
        Kansellerte og feilførte saker er holdt utenfor. Periodene er i UTC, og hvert punkt viser antallet
        ved slutten av perioden. Tall fra før juni 2025 er ufullstendige, fordi tabellen ble innført da.
      </Paragraph>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ds-size-4)", marginBottom: "var(--ds-size-3)" }}>
        <ToggleGroup
          data-size="sm"
          data-toggle-group="Oppløsning"
          value={resolution}
          onChange={(value) => setResolution(value as BacklogResolution)}
        >
          <ToggleGroup.Item value="Day">Dag</ToggleGroup.Item>
          <ToggleGroup.Item value="Week">Uke</ToggleGroup.Item>
          <ToggleGroup.Item value="Month">Måned</ToggleGroup.Item>
        </ToggleGroup>
        <ToggleGroup
          data-size="sm"
          data-toggle-group="Periode"
          value={range}
          onChange={(value) => setRange(value as BacklogRange)}
        >
          <ToggleGroup.Item value="30d">30 dager</ToggleGroup.Item>
          <ToggleGroup.Item value="90d">90 dager</ToggleGroup.Item>
          <ToggleGroup.Item value="1y">1 år</ToggleGroup.Item>
          <ToggleGroup.Item value="all">Alt</ToggleGroup.Item>
        </ToggleGroup>
      </div>
      {content}
    </>
  );
}
