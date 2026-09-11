import { Heading, Paragraph, Skeleton, Table, Tag, ValidationMessage } from "@digdir/designsystemet-react";
import { useEstateCompletionQuery, type EstateCompletionCohort } from "../../queries/statisticsQueries";
import { Sparkline } from "../charts";

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

export default function EstateCompletion() {
  const { data, isLoading, error } = useEstateCompletionQuery();

  if (isLoading) {
    return <Skeleton variant="rectangle" aria-label="Henter statistikk for dødsbo" style={{ height: "12rem" }} />;
  }
  if (error) {
    return <ValidationMessage>Det oppstod en feil under henting av statistikken: {error.message}</ValidationMessage>;
  }
  if (!data || data.cohorts.length === 0) {
    return <Paragraph>Ingen statistikk å vise enda.</Paragraph>;
  }

  // The endpoint returns cohorts oldest-first. Keep that order for the sparkline, which reads
  // left-to-right in time and takes its trend direction from first vs last value.
  const cohorts = data.cohorts;
  const completionRates = cohorts.map((cohort) => cohort.pctProbateIssued);

  // Identify the immature cohorts by month rather than row position, so the table can be sorted
  // independently of this rule.
  const provisional = new Set(cohorts.slice(-PROVISIONAL_MONTHS).map((cohort) => cohort.month));

  // Newest month first: the recent cohorts are the ones anyone opening this page is here to read.
  const rows = [...cohorts].reverse();

  return (
    <>
      <Heading level={2} data-size="xl">
        Fullførte dødsbo
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Andelen dødsbo som har fått utstedt skifteattest, gruppert etter måneden boet ble opprettet.
        Kansellerte og feilførte saker er holdt utenfor. Et bo teller i måneden det ble opprettet, ikke
        i måneden det ble fullført — de siste {PROVISIONAL_MONTHS} månedene er derfor merket foreløpige,
        og andelen vil stige etter hvert som tingrettene behandler sakene.
      </Paragraph>
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
}
