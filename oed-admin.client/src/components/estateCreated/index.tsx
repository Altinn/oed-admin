import type { CSSProperties, ReactNode } from "react";
import { Card, Heading, Paragraph, Skeleton, Table, ValidationMessage } from "@digdir/designsystemet-react";
import { useEstateCreatedQuery, type EstateCreatedDay } from "../../queries/statisticsQueries";

const DAYS = 90;
const TOP_COUNT = 10;

const ACCENT = "var(--ds-color-accent-base-default)";
const TRACK = "var(--ds-color-neutral-background-tinted)";
const MUTED = "var(--ds-color-neutral-text-subtle)";
const BORDER = "var(--ds-color-neutral-border-subtle)";
// Soft halo in the accent colour, used to single out the top value in a chart.
const GLOW = `0 0 8px color-mix(in srgb, ${ACCENT} 45%, transparent)`;
// Darker at the baseline, lighter at the value end.
const ACCENT_LO = `color-mix(in srgb, ${ACCENT} 75%, black)`;
const ACCENT_HI = `color-mix(in srgb, ${ACCENT} 65%, white)`;
const gradient = (direction: "to right" | "to top") => `linear-gradient(${direction}, ${ACCENT_LO}, ${ACCENT_HI})`;

// Indexed by Date.getUTCDay(), which starts the week on Sunday.
const WEEKDAY_NAMES = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
// Monday first, as the week is read in Norway.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const isWeekend = (weekday: number) => weekday === 0 || weekday === 6;

const DAY_FORMAT = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", timeZone: "UTC" });
const LONG_DATE_FORMAT = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const MONTH_FORMAT = new Intl.DateTimeFormat("nb-NO", { month: "long", timeZone: "UTC" });

const numCellStyle: CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const formatCount = (value: number) => value.toLocaleString("nb-NO");
const formatDecimal = (value: number) =>
  value.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) => (values.length === 0 ? 0 : sum(values) / values.length);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

interface RankedDay extends EstateCreatedDay {
  rank: number;
}

// Busiest days first; ties share a rank (1, 2, 3, 3, 5) and the most recent of them is listed first.
function topDays(days: EstateCreatedDay[]): RankedDay[] {
  const sorted = [...days].sort((a, b) => b.created - a.created || b.day.localeCompare(a.day));
  return sorted.slice(0, TOP_COUNT).map((day) => ({
    ...day,
    rank: sorted.findIndex((other) => other.created === day.created) + 1,
  }));
}

interface WeekdayAverage {
  weekday: number;
  average: number;
}

function weekdayAverages(days: EstateCreatedDay[]): WeekdayAverage[] {
  return WEEK_ORDER.map((weekday) => ({
    weekday,
    average: mean(days.filter((day) => toDate(day.day).getUTCDay() === weekday).map((day) => day.created)),
  }));
}

interface MonthSummary {
  month: string; // yyyy-MM
  total: number;
  days: number;
  average: number;
}

function monthSummaries(days: EstateCreatedDay[]): MonthSummary[] {
  // Map.groupBy needs lib ES2024; tsconfig targets ES2022.
  const byMonth = new Map<string, number[]>();
  for (const day of days) {
    const month = day.day.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), day.created]);
  }
  return [...byMonth].map(([month, counts]) => ({ month, total: sum(counts), days: counts.length, average: mean(counts) }));
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card data-color="neutral">
      <Paragraph data-size="sm" style={{ color: MUTED }}>
        {label}
      </Paragraph>
      <Paragraph style={{ fontSize: "var(--ds-font-size-8)", fontWeight: 600, lineHeight: 1.1 }}>{value}</Paragraph>
      <Paragraph data-size="xs" style={{ color: MUTED }}>
        {note}
      </Paragraph>
    </Card>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card data-color="neutral">
      <Heading level={3} data-size="xs">
        {title}
      </Heading>
      <Paragraph data-size="sm" style={{ color: MUTED, marginBottom: "var(--ds-size-2)" }}>
        {subtitle}
      </Paragraph>
      {children}
    </Card>
  );
}

function Bar({
  fraction,
  color = gradient("to right"),
  height = "0.9rem",
  glow = false,
}: {
  fraction: number;
  color?: string;
  height?: string;
  glow?: boolean;
}) {
  return (
    <div style={{ background: TRACK, borderRadius: 4, height, flex: 1 }}>
      <div
        style={{
          width: `${Math.min(100, fraction * 100)}%`,
          height: "100%",
          borderRadius: 4,
          background: color,
          boxShadow: glow ? GLOW : undefined,
        }}
      />
    </div>
  );
}

function TopDays({ days, average }: { days: RankedDay[]; average: number }) {
  const max = days[0]?.created ?? 0;
  const mondays = days.filter((day) => toDate(day.day).getUTCDay() === 1).length;
  const weekends = days.filter((day) => isWeekend(toDate(day.day).getUTCDay())).length;
  const subtitle = `${mondays} av ${days.length} er mandager – ${weekends === 0 ? "ingen" : weekends} helgedager. Snitt per dag er ${formatDecimal(average)}.`;

  return (
    <Panel title={`Topp ${TOP_COUNT} dager`} subtitle={subtitle}>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--ds-size-2)" }}>
        {days.map((day) => (
          <li
            key={day.day}
            style={{ display: "grid", gridTemplateColumns: "1.75rem 10rem 1fr 2.5rem", alignItems: "center", gap: "var(--ds-size-2)" }}
          >
            <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>{day.rank}</span>
            <span>
              {WEEKDAY_NAMES[toDate(day.day).getUTCDay()]} <span style={{ color: MUTED }}>{DAY_FORMAT.format(toDate(day.day))}</span>
            </span>
            <Bar fraction={max === 0 ? 0 : day.created / max} glow={day.rank === 1} />
            <strong style={numCellStyle}>{formatCount(day.created)}</strong>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function Weekdays({ averages }: { averages: WeekdayAverage[] }) {
  const max = Math.max(...averages.map((entry) => entry.average));
  const busiest = averages.find((entry) => entry.average === max);
  const weekdayMean = mean(averages.filter((entry) => !isWeekend(entry.weekday)).map((entry) => entry.average));
  const weekendMean = mean(averages.filter((entry) => isWeekend(entry.weekday)).map((entry) => entry.average));
  const weekendDrop = weekdayMean === 0 ? 0 : Math.round((1 - weekendMean / weekdayMean) * 100);
  const subtitle = `${capitalize(WEEKDAY_NAMES[busiest?.weekday ?? 1])} er travlest; helgene ligger ca. ${weekendDrop} % lavere enn hverdagene`;

  return (
    <Panel title="Snitt per ukedag" subtitle={subtitle}>
      <div
        role="img"
        aria-label={averages.map((entry) => `${WEEKDAY_NAMES[entry.weekday]} ${formatDecimal(entry.average)}`).join(", ")}
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--ds-size-2)", alignItems: "end", height: "11rem" }}
      >
        {averages.map((entry) => (
          <div key={entry.weekday} style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
            <strong style={{ fontSize: "var(--ds-font-size-3)", fontVariantNumeric: "tabular-nums" }}>
              {formatDecimal(entry.average)}
            </strong>
            <div
              style={{
                width: "60%",
                height: `${max === 0 ? 0 : (entry.average / max) * 75}%`,
                background: gradient("to top"),
                opacity: isWeekend(entry.weekday) ? 0.5 : 1,
                boxShadow: entry === busiest ? GLOW : undefined,
                borderRadius: "4px 4px 0 0",
                marginTop: "var(--ds-size-1)",
              }}
            />
            <span style={{ color: MUTED, fontSize: "var(--ds-font-size-3)", borderTop: `1px solid ${BORDER}`, width: "100%", textAlign: "center" }}>
              {WEEKDAY_NAMES[entry.weekday].slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Months({ months }: { months: MonthSummary[] }) {
  const max = Math.max(...months.map((month) => month.average));
  const first = months[0];
  const last = months[months.length - 1];
  const change = first.average === 0 ? 0 : Math.round((last.average / first.average - 1) * 100);
  const subtitle =
    months.length >= 2
      ? `Snitt per dag har endret seg ${change > 0 ? "+" : ""}${change} % fra ${MONTH_FORMAT.format(toDate(`${first.month}-01`))} til ${MONTH_FORMAT.format(toDate(`${last.month}-01`))}`
      : "Kun én måned i perioden";

  return (
    <Panel title="Per måned" subtitle={subtitle}>
      <Table data-size="sm" style={{ width: "100%" }}>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Måned</Table.HeaderCell>
            <Table.HeaderCell>Snitt per dag</Table.HeaderCell>
            <Table.HeaderCell style={{ textAlign: "right" }}>Sum</Table.HeaderCell>
            <Table.HeaderCell style={{ textAlign: "right" }}>Hele dager</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {months.map((month) => (
            <Table.Row key={month.month} style={{ fontWeight: month.average === max ? 600 : undefined }}>
              <Table.Cell>{capitalize(MONTH_FORMAT.format(toDate(`${month.month}-01`)))}</Table.Cell>
              <Table.Cell>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-size-2)" }}>
                  <Bar fraction={max === 0 ? 0 : month.average / max} height="0.4rem" />
                  <span style={{ ...numCellStyle, minWidth: "2.5rem" }}>{formatDecimal(month.average)}</span>
                </div>
              </Table.Cell>
              <Table.Cell style={numCellStyle}>{formatCount(month.total)}</Table.Cell>
              <Table.Cell style={numCellStyle}>{month.days}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Panel>
  );
}

function Dashboard({ days }: { days: EstateCreatedDay[] }) {
  // The last day is today and still running; it counts towards the total only.
  const fullDays = days.slice(0, -1);
  const counts = fullDays.map((day) => day.created);
  const average = mean(counts);
  const today = days[days.length - 1];

  return (
    <>
      <Paragraph data-size="sm" style={{ color: MUTED, marginBottom: "var(--ds-size-4)" }}>
        {LONG_DATE_FORMAT.format(toDate(days[0].day))} – {LONG_DATE_FORMAT.format(toDate(today.day))} (UTC)
      </Paragraph>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          gap: "var(--ds-size-4)",
          marginBottom: "var(--ds-size-4)",
        }}
      >
        <Tile label="Totalt" value={formatCount(sum(days.map((day) => day.created)))} note={`dødsbo opprettet, ${formatCount(today.created)} så langt i dag`} />
        <Tile label="Snitt per dag" value={formatDecimal(average)} note={`${fullDays.length} hele dager`} />
        <Tile label="Median" value={formatDecimal(median(counts)).replace(",0", "")} note="per dag" />
        <Tile label="Laveste – høyeste dag" value={`${Math.min(...counts)} – ${Math.max(...counts)}`} note="hele dager" />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(24rem, 1fr))",
          gap: "var(--ds-size-4)",
          alignItems: "start",
        }}
      >
        <TopDays days={topDays(fullDays)} average={average} />
        <div style={{ display: "grid", gap: "var(--ds-size-4)" }}>
          <Weekdays averages={weekdayAverages(fullDays)} />
          <Months months={monthSummaries(fullDays)} />
        </div>
      </div>
    </>
  );
}

export default function EstateCreated() {
  const { data, isLoading, error } = useEstateCreatedQuery(DAYS);

  let content: ReactNode;
  if (isLoading) {
    content = <Skeleton variant="rectangle" aria-label="Henter opprettede dødsbo" style={{ height: "24rem" }} />;
  } else if (error) {
    content = <ValidationMessage>Det oppstod en feil under henting av statistikken: {error.message}</ValidationMessage>;
  } else if (!data || data.days.length < 2) {
    content = <Paragraph>Ingen data.</Paragraph>;
  } else {
    content = <Dashboard days={data.days} />;
  }

  return (
    <>
      <Heading level={2} data-size="xl">
        Opprettede dødsbo – siste {DAYS} dager
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-2)" }}>
        Antall rader i estate-tabellen per dag de ble opprettet, inkludert kansellerte og feilførte saker. Dagene er i UTC.
        Dagens tall er med i totalen, men holdt utenfor snitt, median, topp {TOP_COUNT}, ukedager og måneder fordi dagen ikke er over.
      </Paragraph>
      {content}
    </>
  );
}
