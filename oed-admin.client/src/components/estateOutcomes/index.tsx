import { useState } from "react";
import { Heading, Paragraph, Table, Tag } from "@digdir/designsystemet-react";
import { useEstateOutcomesQuery, type OutcomeMonth } from "../../queries/statisticsQueries";
import { SERIES_COLORS } from "../charts/chartUtils";
import { StackedColumnChart } from "../charts/statCharts";
import { ChartPanel, DateRangePicker, QueryState } from "../statistics/panels";
import {
  COHORT_FLOOR,
  MUTED,
  PROVISIONAL_MONTHS,
  formatCount,
  formatMonth,
  formatPercent,
  numCellStyle,
  todayUtc,
  type DayRange,
} from "../statistics/statsFormat";

// The chart has eight series colours. The most common results get their own, the rest are
// folded into "Andre"; cancelled and misposted take the last two, and "no result yet" is neutral
// grey so it reads as the absence of an outcome rather than one more outcome.
const CHART_RESULTS = 5;
const OTHER_COLOR = SERIES_COLORS[5];
const CANCELLED_COLOR = SERIES_COLORS[6];
const MISPOSTED_COLOR = SERIES_COLORS[7];
const NO_RESULT_COLOR = "var(--ds-color-neutral-border-default)";

const RELEASES = [{ month: "2026-09", label: "Ett skjema pr arving 28.9." }];

// Results are keyed by their raw ProbateResult value; "none" stands in for estates without one.
const NO_RESULT = "none";
const resultKey = (result: string | null) => result ?? NO_RESULT;
const resultLabel = (key: string) => (key === NO_RESULT ? "Ingen ennå" : sentenceCase(key));

// ProbateResult values are ASCII-only, so words that need æ/ø/å are restored here. Matched
// against whole words only - "A" must not touch the A in other words.
const NORWEGIAN_WORDS: Record<string, string> = {
  FORSTE: "første",
  A: "å",
  BEGJARING: "begjæring",
};

// INTET_TIL_SKIFTE_UFORMUENDE -> "Intet til skifte uformuende".
function sentenceCase(value: string): string {
  const words = value
    .split("_")
    .map((word) => NORWEGIAN_WORDS[word] ?? word.toLowerCase())
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Every result value seen in any month, most common first, with "no result yet" last.
function resultColumns(months: OutcomeMonth[]): string[] {
  const totals = new Map<string, number>();
  for (const month of months) {
    for (const { result, count } of month.results) {
      totals.set(resultKey(result), (totals.get(resultKey(result)) ?? 0) + count);
    }
  }
  return [...totals]
    .sort(([keyA, countA], [keyB, countB]) => Number(keyA === NO_RESULT) - Number(keyB === NO_RESULT) || countB - countA)
    .map(([key]) => key);
}

function CountCell({ count, total }: { count: number; total: number }) {
  return (
    <Table.Cell style={{ ...numCellStyle, whiteSpace: "nowrap" }}>
      {formatCount(count)}{" "}
      <span style={{ color: MUTED }}>({formatPercent(total === 0 ? 0 : (100 * count) / total)})</span>
    </Table.Cell>
  );
}

function OutcomesChart({ months, columns }: { months: OutcomeMonth[]; columns: string[] }) {
  const results = columns.filter((key) => key !== NO_RESULT);
  const shown = results.slice(0, CHART_RESULTS);
  const folded = results.slice(CHART_RESULTS);
  const countOf = (month: OutcomeMonth, key: string) =>
    month.results.find((entry) => resultKey(entry.result) === key)?.count ?? 0;

  // Stacked bottom-up in this order: the settled outcomes first, then the estates still waiting,
  // then the ones that dropped out.
  const series = [
    ...shown.map((key, i) => ({ name: resultLabel(key), values: months.map((month) => countOf(month, key)), color: SERIES_COLORS[i] })),
    ...(folded.length > 0
      ? [{ name: "Andre", values: months.map((month) => folded.reduce((sum, key) => sum + countOf(month, key), 0)), color: OTHER_COLOR }]
      : []),
    ...(columns.includes(NO_RESULT)
      ? [{ name: resultLabel(NO_RESULT), values: months.map((month) => countOf(month, NO_RESULT)), color: NO_RESULT_COLOR }]
      : []),
    { name: "Kansellert", values: months.map((month) => month.cancelled), color: CANCELLED_COLOR },
    { name: "Feilført", values: months.map((month) => month.misposted), color: MISPOSTED_COLOR },
  ];

  return (
    <StackedColumnChart
      labels={months.map((month) => formatMonth(month.month))}
      series={series}
      formatValue={formatCount}
      ariaLabel="Utfall for bo opprettet hver måned"
    />
  );
}

function Outcomes({ months }: { months: OutcomeMonth[] }) {
  const columns = resultColumns(months);
  const provisional = new Set(months.slice(-PROVISIONAL_MONTHS).map((month) => month.month));
  const rows = [...months].reverse();

  return (
    <ChartPanel
      title="Utfall per måned"
      subtitle="Antall og andel av alle bo opprettet i måneden. Utfallskolonnene er hentet rett fra ProbateResult."
      chart={<OutcomesChart months={months} columns={columns} />}
      table={
        <Table data-size="sm" style={{ width: "100%" }}>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Måned (UTC)</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: "right" }}>Bo</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: "right" }}>Kansellert</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: "right" }}>Feilført</Table.HeaderCell>
              {columns.map((key) => (
                // ProbateResult values are long; let them wrap so the columns stay as narrow as the counts.
                <Table.HeaderCell
                  key={key}
                  style={{ textAlign: "right", whiteSpace: "normal", minWidth: "8rem", maxWidth: "12rem", verticalAlign: "bottom" }}
                >
                  {resultLabel(key)}
                </Table.HeaderCell>
              ))}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map((month) => {
              const counts = new Map(month.results.map(({ result, count }) => [resultKey(result), count]));
              const release = RELEASES.find((r) => r.month === month.month);
              return (
                <Table.Row key={month.month}>
                  <Table.Cell>
                    {formatMonth(month.month)}
                    {provisional.has(month.month) && (
                      <Tag data-color="neutral" data-size="sm" style={{ marginLeft: "0.5em" }}>
                        foreløpig
                      </Tag>
                    )}
                    {release && (
                      <Tag data-color="accent" data-size="sm" style={{ marginLeft: "0.5em" }}>
                        {release.label}
                      </Tag>
                    )}
                  </Table.Cell>
                  <Table.Cell style={numCellStyle}>{formatCount(month.total)}</Table.Cell>
                  <CountCell count={month.cancelled} total={month.total} />
                  <CountCell count={month.misposted} total={month.total} />
                  {columns.map((key) => (
                    <CountCell key={key} count={counts.get(key) ?? 0} total={month.total} />
                  ))}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      }
    />
  );
}

export default function EstateOutcomes() {
  const [range, setRange] = useState<DayRange>(() => ({ from: COHORT_FLOOR, to: todayUtc() }));
  const { data, isLoading, error, isPlaceholderData } = useEstateOutcomesQuery(range);

  return (
    <>
      <Heading level={2} data-size="xl">
        Utfall
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Hvordan bo opprettet i perioden har endt, etter måneden de ble opprettet. Kansellerte og feilførte saker er
        talt for seg; resten er fordelt på resultatet fra tingretten. De siste {PROVISIONAL_MONTHS} månedene er merket
        foreløpige, fordi mange av boene ennå ikke har fått et resultat. Før juli 2025 er opprettet-tidspunktet upålitelig.
      </Paragraph>
      <DateRangePicker value={range} onChange={setRange} />
      <div style={{ opacity: isPlaceholderData ? 0.5 : 1, transition: "opacity 150ms" }} aria-busy={isPlaceholderData}>
        <QueryState data={data} isLoading={isLoading} error={error} isEmpty={(d) => d.months.length === 0} loadingLabel="Henter utfall">
          {(d) => <Outcomes months={d.months} />}
        </QueryState>
      </div>
    </>
  );
}
