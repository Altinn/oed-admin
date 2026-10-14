import { Heading, Paragraph, Table, Tag } from "@digdir/designsystemet-react";
import {
  useEstateLeadTimesQuery,
  type LeadTime,
  type LeadTimeMeasure,
  type LeadTimeMonth,
} from "../../queries/statisticsQueries";
import { Panel, QueryState, Tile, Tiles } from "../statistics/panels";
import { PROVISIONAL_MONTHS, formatCount, formatDays, formatMonth, numCellStyle } from "../statistics/statsFormat";

const MEASURE_LABELS: Record<LeadTimeMeasure, string> = {
  deathToCreated: "Dødsfall → opprettet",
  createdToFirstHeir: "Opprettet → første arving",
  declarationDuration: "Skifteerklæring opprettet → sendt inn",
  createdToDeclarationSubmitted: "Opprettet → skifteerklæring sendt inn",
  createdToProbate: "Opprettet → skifteattest",
};

const SHORT_LABELS: Record<LeadTimeMeasure, string> = {
  deathToCreated: "Dødsfall",
  createdToFirstHeir: "Første arving",
  declarationDuration: "Utfylling",
  createdToDeclarationSubmitted: "Til innsendt",
  createdToProbate: "Til skifteattest",
};

function OverallTile({ leadTime }: { leadTime: LeadTime }) {
  return (
    <Tile
      label={MEASURE_LABELS[leadTime.measure]}
      value={leadTime.medianDays === null ? "–" : `${formatDays(leadTime.medianDays)} d`}
      note={`median · 75 %: ${formatDays(leadTime.p75Days)} d · ${formatCount(leadTime.count)} bo`}
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
          title={`${formatCount(leadTime.count)} bo · 75 %: ${formatDays(leadTime.p75Days)} dager`}
        >
          {formatDays(leadTime.medianDays)}
        </Table.Cell>
      ))}
    </Table.Row>
  );
}

function LeadTimes({ overall, months }: { overall: LeadTime[]; months: LeadTimeMonth[] }) {
  const provisional = new Set(months.slice(-PROVISIONAL_MONTHS).map((month) => month.month));
  // Newest first, as on the Fullført tab.
  const rows = [...months].reverse();

  return (
    <>
      <Tiles>
        {overall.map((leadTime) => (
          <OverallTile key={leadTime.measure} leadTime={leadTime} />
        ))}
      </Tiles>
      <Panel title="Median per måned" subtitle="Dager, etter måneden boet ble opprettet. Hold pekeren over en celle for antall bo og 75-persentilen.">
        <Table data-size="sm" style={{ width: "100%" }}>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Måned (UTC)</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: "right" }}>Bo</Table.HeaderCell>
              {overall.map((leadTime) => (
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
      </Panel>
    </>
  );
}

export default function EstateLeadTimes() {
  const { data, isLoading, error } = useEstateLeadTimesQuery();

  return (
    <>
      <Heading level={2} data-size="xl">
        Behandlingstid
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Median og 75-persentil i dager mellom stegene i et dødsbo, for bo opprettet fra juli 2025. Kansellerte og
        feilførte saker er holdt utenfor, og et bo teller bare med i et mål når det har nådd begge stegene. De siste{" "}
        {PROVISIONAL_MONTHS} månedene er merket foreløpige: der har bare de raskeste boene rukket frem, så tidene ser
        kortere ut enn de blir. Skifteerklæringer i den nye subappen er ikke med.
      </Paragraph>
      <QueryState data={data} isLoading={isLoading} error={error} isEmpty={(d) => d.months.length === 0} loadingLabel="Henter behandlingstider">
        {(d) => <LeadTimes overall={d.overall} months={d.months} />}
      </QueryState>
    </>
  );
}
