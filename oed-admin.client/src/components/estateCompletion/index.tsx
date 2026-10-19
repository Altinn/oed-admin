import { useState } from "react";
import { Heading, Paragraph, Table, Tag } from "@digdir/designsystemet-react";
import {
  useEstateCompletionQuery,
  type EstateCompletionCohort,
  type EstateCompletionMonth,
  type EstateCompletionResponse,
} from "../../queries/statisticsQueries";
import { Sparkline } from "../charts";
import { SERIES_COLORS } from "../charts/chartUtils";
import { MultiLineChart } from "../charts/statCharts";
import { ChartPanel, DateRangePicker, QueryState } from "../statistics/panels";
import { COHORT_FLOOR, formatCount, formatMonth, todayUtc, type DayRange } from "../statistics/statsFormat";

// The district court issues probate well after the estate is opened, so the newest cohorts have
// not had time to complete and will always read low. Mark them, rather than let the tail of the
// table be read as a decline.
const PROVISIONAL_MONTHS = 3;

const numCellStyle = { textAlign: "right", fontVariantNumeric: "tabular-nums" } as const;

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} %`;
}

function CohortRow({ cohort, provisional }: { cohort: EstateCompletionCohort; provisional: boolean }) {
  return (
    <Table.Row>
      <Table.Cell>
        {cohort.month}
        {provisional && (
          <Tag data-color="neutral" data-size="sm" style={{ marginLeft: "0.5em" }}>
            foreløpig
          </Tag>
        )}
      </Table.Cell>
      <Table.Cell style={numCellStyle}>{cohort.opened}</Table.Cell>
      <Table.Cell style={numCellStyle}>{cohort.declarationSubmitted}</Table.Cell>
      <Table.Cell style={numCellStyle}>{formatPercent(cohort.pctDeclarationSubmitted)}</Table.Cell>
      <Table.Cell style={numCellStyle}>{cohort.probateIssued}</Table.Cell>
      <Table.Cell style={numCellStyle}>{formatPercent(cohort.pctProbateIssued)}</Table.Cell>
    </Table.Row>
  );
}

function Cohorts({ cohorts }: { cohorts: EstateCompletionCohort[] }) {
  // The endpoint returns cohorts oldest-first. Keep that order for the sparkline, which reads
  // left-to-right in time and takes its trend direction from first vs last value.
  const completionRates = cohorts.map((cohort) => cohort.pctProbateIssued);

  // Identify the immature cohorts by month rather than row position, so the table can be sorted
  // independently of this rule.
  const provisional = new Set(cohorts.slice(-PROVISIONAL_MONTHS).map((cohort) => cohort.month));

  // Newest month first: the recent cohorts are the ones anyone opening this page is here to read.
  const rows = [...cohorts].reverse();

  const chart = (
    <MultiLineChart
      labels={cohorts.map((cohort) => formatMonth(cohort.month))}
      series={[
        { name: "Skifteerklæring sendt inn", values: cohorts.map((cohort) => cohort.pctDeclarationSubmitted), color: SERIES_COLORS[0] },
        { name: "Skifteattest utstedt", values: cohorts.map((cohort) => cohort.pctProbateIssued), color: SERIES_COLORS[1] },
      ]}
      formatValue={formatPercent}
      ariaLabel="Andel av boene i hver månedskohort som har sendt inn skifteerklæring og fått skifteattest"
    />
  );

  const table = (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--ds-size-2)" }}>
        <Sparkline values={completionRates} dir="higher" />
      </div>
      <Table data-size="sm" style={{ width: "100%" }}>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Måned (UTC)</Table.HeaderCell>
            <Table.HeaderCell style={{ textAlign: "right" }}>Opprettet</Table.HeaderCell>
            <Table.HeaderCell style={{ textAlign: "right" }}>Skifteerklæring</Table.HeaderCell>
            <Table.HeaderCell style={{ textAlign: "right" }}>Andel</Table.HeaderCell>
            <Table.HeaderCell style={{ textAlign: "right" }}>Skifteattest</Table.HeaderCell>
            <Table.HeaderCell style={{ textAlign: "right" }}>Andel fullført</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map((cohort) => (
            <CohortRow key={cohort.month} cohort={cohort} provisional={provisional.has(cohort.month)} />
          ))}
        </Table.Body>
      </Table>
    </>
  );

  return (
    <ChartPanel
      title="Kohorter"
      subtitle="Andel av boene opprettet i måneden som har sendt inn skifteerklæring og fått skifteattest, i prosent."
      chart={chart}
      table={table}
    />
  );
}

function MonthlyEvents({ months }: { months: EstateCompletionMonth[] }) {
  const rows = [...months].reverse();

  const chart = (
    <MultiLineChart
      labels={months.map((month) => formatMonth(month.month))}
      series={[
        { name: "Opprettet", values: months.map((month) => month.opened), color: SERIES_COLORS[0] },
        { name: "Skifteerklæring sendt inn", values: months.map((month) => month.declarationsSubmitted), color: SERIES_COLORS[1] },
        { name: "Skifteattest utstedt", values: months.map((month) => month.probatesIssued), color: SERIES_COLORS[2] },
      ]}
      formatValue={formatCount}
      ariaLabel="Opprettede bo, innsendte skifteerklæringer og utstedte skifteattester per måned"
    />
  );

  const table = (
    <Table data-size="sm" style={{ width: "100%" }}>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Måned (UTC)</Table.HeaderCell>
          <Table.HeaderCell style={{ textAlign: "right" }}>Opprettet</Table.HeaderCell>
          <Table.HeaderCell style={{ textAlign: "right" }}>Skifteerklæring sendt inn</Table.HeaderCell>
          <Table.HeaderCell style={{ textAlign: "right" }}>Innsendt per opprettet</Table.HeaderCell>
          <Table.HeaderCell style={{ textAlign: "right" }}>Skifteattest utstedt</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((month) => (
          <Table.Row key={month.month}>
            <Table.Cell>{month.month}</Table.Cell>
            <Table.Cell style={numCellStyle}>{formatCount(month.opened)}</Table.Cell>
            <Table.Cell style={numCellStyle}>{formatCount(month.declarationsSubmitted)}</Table.Cell>
            <Table.Cell style={numCellStyle}>
              {month.opened === 0 ? "–" : formatPercent((100 * month.declarationsSubmitted) / month.opened)}
            </Table.Cell>
            <Table.Cell style={numCellStyle}>{formatCount(month.probatesIssued)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );

  return (
    <ChartPanel
      title="Hendelser per måned"
      subtitle="Opprettede bo, innsendte skifteerklæringer og utstedte skifteattester, hver talt i måneden det skjedde uansett når boet ble opprettet."
      chart={chart}
      table={table}
    />
  );
}

function Completion({ data }: { data: EstateCompletionResponse }) {
  return (
    <div style={{ display: "grid", gap: "var(--ds-size-4)" }}>
      <Cohorts cohorts={data.cohorts} />
      <MonthlyEvents months={data.months} />
    </div>
  );
}

export default function EstateCompletion() {
  const [range, setRange] = useState<DayRange>(() => ({ from: COHORT_FLOOR, to: todayUtc() }));
  const { data, isLoading, error, isPlaceholderData } = useEstateCompletionQuery(range);

  return (
    <>
      <Heading level={2} data-size="xl">
        Fullførte dødsbo
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Andelen dødsbo som har fått utstedt skifteattest, gruppert etter måneden boet ble opprettet.
        Kansellerte og feilførte saker er holdt utenfor. Et bo teller i måneden det ble opprettet, ikke
        i måneden det ble fullført — de siste {PROVISIONAL_MONTHS} månedene er derfor merket foreløpige,
        og andelen vil stige etter hvert som tingrettene behandler sakene. Hendelser per måned teller i stedet
        hvert steg i måneden det skjedde. Skifteerklæringer i den nye subappen er ikke med. Før juli 2025 er
        opprettet-tidspunktet upålitelig.
      </Paragraph>
      <DateRangePicker value={range} onChange={setRange} />
      <div style={{ opacity: isPlaceholderData ? 0.5 : 1, transition: "opacity 150ms" }} aria-busy={isPlaceholderData}>
        <QueryState
          data={data}
          isLoading={isLoading}
          error={error}
          isEmpty={(d) => d.cohorts.length === 0 && d.months.length === 0}
          loadingLabel="Henter statistikk for dødsbo"
        >
          {(d) => <Completion data={d} />}
        </QueryState>
      </div>
    </>
  );
}
