import { useState } from "react";
import { Heading, Paragraph, Table, Tag, ToggleGroup } from "@digdir/designsystemet-react";
import {
  useEstateLeadTimesQuery,
  type EstateLeadTimesResponse,
  type LeadTime,
  type LeadTimeDistribution,
  type LeadTimeMeasure,
  type LeadTimeMonth,
} from "../../queries/statisticsQueries";
import { SERIES_COLORS } from "../charts/chartUtils";
import { ColumnChart, MultiLineChart, type ColumnMarker } from "../charts/statCharts";
import { ChartPanel, DateRangePicker, Panel, QueryState, Tile, Tiles } from "../statistics/panels";
import {
  COHORT_FLOOR,
  PROVISIONAL_MONTHS,
  formatCount,
  formatDays,
  formatMonth,
  formatPercent,
  numCellStyle,
  todayUtc,
  type DayRange,
} from "../statistics/statsFormat";

const MEASURE_LABELS: Record<LeadTimeMeasure, string> = {
  deathToCreated: "Dødsfall → opprettet",
  createdToFirstHeir: "Opprettet → første arving",
  declarationDuration: "Skifteerklæring opprettet → sendt inn",
  createdToDeclarationSubmitted: "Opprettet → skifteerklæring sendt inn",
  declarationSubmittedToProbate: "Skifteerklæring sendt inn → skifteattest",
  createdToProbate: "Opprettet → skifteattest",
};

const SHORT_LABELS: Record<LeadTimeMeasure, string> = {
  deathToCreated: "Dødsfall",
  createdToFirstHeir: "Første arving",
  declarationDuration: "Utfylling",
  createdToDeclarationSubmitted: "Til innsendt",
  declarationSubmittedToProbate: "Innsendt til attest",
  createdToProbate: "Til skifteattest",
};

// Bin widths the histogram may pick, in days; it takes the narrowest that keeps the bin count
// readable.
const BIN_WIDTHS = [1, 2, 5, 7, 14, 30, 60, 90];
const MAX_BINS = 40;
// The longest durations are a thin tail that would squeeze the rest of the chart into a few
// columns, so everything past this share of the estates is collected in the last bin.
const TAIL_SHARE = 0.98;

interface Histogram {
  width: number;
  bins: { start: number; count: number; tail: boolean }[];
  total: number;
}

function histogram(distribution: LeadTimeDistribution): Histogram {
  const total = distribution.days.reduce((sum, entry) => sum + entry.count, 0);
  let cumulative = 0;
  const cutoff = distribution.days.find((entry) => (cumulative += entry.count) >= total * TAIL_SHARE)?.days ?? 0;
  const width = BIN_WIDTHS.find((candidate) => (cutoff + 1) / candidate <= MAX_BINS) ?? BIN_WIDTHS[BIN_WIDTHS.length - 1];
  const binCount = Math.max(1, Math.ceil((cutoff + 1) / width));
  const hasTail = distribution.days.some((entry) => entry.days >= binCount * width);

  const bins = Array.from({ length: binCount }, (_, i) => ({ start: i * width, count: 0, tail: hasTail && i === binCount - 1 }));
  for (const entry of distribution.days) {
    bins[Math.min(Math.floor(entry.days / width), binCount - 1)].count += entry.count;
  }
  return { width, bins, total };
}

function binLabel(bin: Histogram["bins"][number], width: number): string {
  if (bin.tail) return `${bin.start}+`;
  return width === 1 ? `${bin.start}` : `${bin.start}–${bin.start + width - 1}`;
}

function OverallTile({ leadTime }: { leadTime: LeadTime }) {
  return (
    <Tile
      label={MEASURE_LABELS[leadTime.measure]}
      value={leadTime.medianDays === null ? "–" : `${formatDays(leadTime.medianDays)} d`}
      note={`median · snitt ${formatDays(leadTime.meanDays)} d · 75 %: ${formatDays(leadTime.p75Days)} d · ${formatCount(leadTime.count)} bo`}
    />
  );
}

function MonthRow({ month, provisional }: { month: LeadTimeMonth; provisional: boolean }) {
  return (
    <Table.Row>
      <Table.Cell>
        {formatMonth(month.month)}
        {provisional && (
          <Tag data-color="neutral" data-size="sm" style={{ marginLeft: "0.5em" }}>
            foreløpig
          </Tag>
        )}
      </Table.Cell>
      <Table.Cell style={numCellStyle}>{formatCount(month.estates)}</Table.Cell>
      {month.measures.map((leadTime) => (
        <Table.Cell
          key={leadTime.measure}
          style={numCellStyle}
          title={`${formatCount(leadTime.count)} bo · snitt: ${formatDays(leadTime.meanDays)} dager · 75 %: ${formatDays(leadTime.p75Days)} dager`}
        >
          {formatDays(leadTime.medianDays)}
        </Table.Cell>
      ))}
    </Table.Row>
  );
}

function Distribution({ distribution, leadTime }: { distribution: LeadTimeDistribution; leadTime: LeadTime }) {
  const { width, bins, total } = histogram(distribution);
  const markers: ColumnMarker[] = [
    ...(leadTime.medianDays === null ? [] : [{ position: leadTime.medianDays / width, label: `median ${formatDays(leadTime.medianDays)} d` }]),
    ...(leadTime.meanDays === null ? [] : [{ position: leadTime.meanDays / width, label: `snitt ${formatDays(leadTime.meanDays)} d` }]),
  ];
  const share = (count: number) => (total === 0 ? 0 : (100 * count) / total);
  const cumulative = bins.map((_, i) => bins.slice(0, i + 1).reduce((sum, bin) => sum + bin.count, 0));

  const chart = (
    <ColumnChart
      columns={bins.map((bin) => ({
        label: binLabel(bin, width),
        value: bin.count,
        detail: `${formatPercent(share(bin.count))} av boene`,
      }))}
      markers={markers}
      formatValue={(value) => `${formatCount(value)} bo`}
      ariaLabel={`Fordeling av ${MEASURE_LABELS[leadTime.measure].toLowerCase()} i dager`}
    />
  );

  const table = (
    <Table data-size="sm" style={{ width: "100%" }}>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Dager</Table.HeaderCell>
          <Table.HeaderCell style={{ textAlign: "right" }}>Bo</Table.HeaderCell>
          <Table.HeaderCell style={{ textAlign: "right" }}>Andel</Table.HeaderCell>
          <Table.HeaderCell style={{ textAlign: "right" }}>Kumulativ andel</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {bins.map((bin, i) => (
          <Table.Row key={bin.start}>
            <Table.Cell>{binLabel(bin, width)}</Table.Cell>
            <Table.Cell style={numCellStyle}>{formatCount(bin.count)}</Table.Cell>
            <Table.Cell style={numCellStyle}>{formatPercent(share(bin.count))}</Table.Cell>
            <Table.Cell style={numCellStyle}>{formatPercent(share(cumulative[i]))}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );

  const tail = bins[bins.length - 1].tail ? ` Den siste søylen samler de ${formatPercent(100 * (1 - TAIL_SHARE))} tregeste.` : "";
  return (
    <ChartPanel
      title={`Fordeling: ${MEASURE_LABELS[leadTime.measure]}`}
      subtitle={`Antall bo etter hele dager, ${width === 1 ? "én dag" : `${width} dager`} per søyle. ${formatCount(total)} bo.${tail}`}
      chart={chart}
      table={table}
    />
  );
}

function Monthly({ months, measure, provisional }: { months: LeadTimeMonth[]; measure: LeadTimeMeasure; provisional: Set<string> }) {
  // Newest first, as on the Fullført tab.
  const rows = [...months].reverse();
  const pick = (month: LeadTimeMonth) => month.measures.find((leadTime) => leadTime.measure === measure);
  const headers = months[0]?.measures ?? [];

  const chart = (
    <MultiLineChart
      labels={months.map((month) => formatMonth(month.month))}
      series={[
        { name: "Median", values: months.map((month) => pick(month)?.medianDays ?? null), color: SERIES_COLORS[0] },
        { name: "Snitt", values: months.map((month) => pick(month)?.meanDays ?? null), color: SERIES_COLORS[1] },
        { name: "75-persentil", values: months.map((month) => pick(month)?.p75Days ?? null), color: SERIES_COLORS[2] },
      ]}
      formatValue={(value) => `${formatDays(value)} d`}
      ariaLabel={`${MEASURE_LABELS[measure]} per måned, i dager`}
    />
  );

  const table = (
    <Table data-size="sm" style={{ width: "100%" }}>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Måned (UTC)</Table.HeaderCell>
          <Table.HeaderCell style={{ textAlign: "right" }}>Bo</Table.HeaderCell>
          {headers.map((leadTime) => (
            <Table.HeaderCell key={leadTime.measure} style={{ textAlign: "right" }} title={MEASURE_LABELS[leadTime.measure]}>
              {SHORT_LABELS[leadTime.measure]}
            </Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((month) => (
          <MonthRow key={month.month} month={month} provisional={provisional.has(month.month)} />
        ))}
      </Table.Body>
    </Table>
  );

  return (
    <ChartPanel
      title="Per måned"
      subtitle={`Grafen viser ${MEASURE_LABELS[measure].toLowerCase()}; tabellen viser medianen for alle målene. Dager, etter måneden boet ble opprettet. Hold pekeren over en celle for antall bo, snitt og 75-persentilen.`}
      chart={chart}
      table={table}
    />
  );
}

function LeadTimes({ data }: { data: EstateLeadTimesResponse }) {
  const [measure, setMeasure] = useState<LeadTimeMeasure>("declarationDuration");
  const provisional = new Set(data.months.slice(-PROVISIONAL_MONTHS).map((month) => month.month));
  const leadTime = data.overall.find((entry) => entry.measure === measure);
  const distribution = data.distributions.find((entry) => entry.measure === measure);

  return (
    <>
      <Tiles>
        {data.overall.map((entry) => (
          <OverallTile key={entry.measure} leadTime={entry} />
        ))}
      </Tiles>
      <div style={{ marginBottom: "var(--ds-size-4)" }}>
        <ToggleGroup data-size="sm" data-toggle-group="Mål" value={measure} onChange={(value) => setMeasure(value as LeadTimeMeasure)}>
          {data.overall.map((entry) => (
            <ToggleGroup.Item key={entry.measure} value={entry.measure} title={MEASURE_LABELS[entry.measure]}>
              {SHORT_LABELS[entry.measure]}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
      </div>
      <div style={{ display: "grid", gap: "var(--ds-size-4)" }}>
        {leadTime && distribution && distribution.days.length > 0 ? (
          <Distribution distribution={distribution} leadTime={leadTime} />
        ) : (
          <Panel title={`Fordeling: ${MEASURE_LABELS[measure]}`}>
            <Paragraph>Ingen bo har nådd begge stegene i perioden.</Paragraph>
          </Panel>
        )}
        <Monthly months={data.months} measure={measure} provisional={provisional} />
      </div>
    </>
  );
}

export default function EstateLeadTimes() {
  const [range, setRange] = useState<DayRange>(() => ({ from: COHORT_FLOOR, to: todayUtc() }));
  const { data, isLoading, error, isPlaceholderData } = useEstateLeadTimesQuery(range);

  return (
    <>
      <Heading level={2} data-size="xl">
        Behandlingstid
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Snitt, median og 75-persentil i dager mellom stegene i et dødsbo, for bo opprettet i perioden. Kansellerte og
        feilførte saker er holdt utenfor, og et bo teller bare med i et mål når det har nådd begge stegene. De siste{" "}
        {PROVISIONAL_MONTHS} månedene er merket foreløpige: der har bare de raskeste boene rukket frem, så tidene ser
        kortere ut enn de blir. Skifteerklæringer i den nye subappen er ikke med. Før juli 2025 er opprettet-tidspunktet
        upålitelig.
      </Paragraph>
      <DateRangePicker value={range} onChange={setRange} />
      <div style={{ opacity: isPlaceholderData ? 0.5 : 1, transition: "opacity 150ms" }} aria-busy={isPlaceholderData}>
        <QueryState data={data} isLoading={isLoading} error={error} isEmpty={(d) => d.months.length === 0} loadingLabel="Henter behandlingstider">
          {(d) => <LeadTimes data={d} />}
        </QueryState>
      </div>
    </>
  );
}
