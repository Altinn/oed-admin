import { Heading, Paragraph, Table } from "@digdir/designsystemet-react";
import { useDistrictCourtStatisticsQuery, type DistrictCourtStatistics as Court } from "../../queries/statisticsQueries";
import { Bar, Panel, QueryState } from "../statistics/panels";
import { MUTED, formatCount, formatDays, formatPercent, numCellStyle } from "../statistics/statsFormat";

// Below this many probated estates a court's median swings on a handful of cases, so it is hidden.
const MIN_FOR_MEDIAN = 10;

function CourtRow({ court, maxEstates }: { court: Court; maxEstates: number }) {
  const showMedian = court.probateIssued >= MIN_FOR_MEDIAN;
  return (
    <Table.Row>
      <Table.Cell style={{ color: court.districtCourtName ? undefined : MUTED }}>{court.districtCourtName ?? "Ukjent"}</Table.Cell>
      <Table.Cell>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-size-2)" }}>
          <Bar fraction={maxEstates === 0 ? 0 : court.estates / maxEstates} height="0.4rem" />
          <span style={{ ...numCellStyle, minWidth: "3.5rem" }}>{formatCount(court.estates)}</span>
        </div>
      </Table.Cell>
      <Table.Cell style={numCellStyle}>{formatCount(court.openDeclarations)}</Table.Cell>
      <Table.Cell style={numCellStyle}>{formatCount(court.probateIssued)}</Table.Cell>
      <Table.Cell style={numCellStyle}>{formatPercent(court.pctProbateIssued)}</Table.Cell>
      <Table.Cell style={numCellStyle} title={showMedian ? undefined : `Færre enn ${MIN_FOR_MEDIAN} skifteattester`}>
        {showMedian ? formatDays(court.medianDaysToProbate) : "–"}
      </Table.Cell>
    </Table.Row>
  );
}

function Courts({ courts }: { courts: Court[] }) {
  const maxEstates = Math.max(...courts.map((court) => court.estates));

  return (
    <Panel title="Per tingrett" subtitle={`${courts.length} tingretter, sortert etter antall bo`}>
      <div style={{ overflowX: "auto" }}>
        <Table data-size="sm" style={{ width: "100%" }}>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Tingrett</Table.HeaderCell>
              <Table.HeaderCell>Bo</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: "right" }}>Åpne skifteerklæringer</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: "right" }}>Skifteattest</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: "right" }}>Andel</Table.HeaderCell>
              <Table.HeaderCell style={{ textAlign: "right" }}>Median dager til skifteattest</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {courts.map((court) => (
              <CourtRow key={court.districtCourtName ?? ""} court={court} maxEstates={maxEstates} />
            ))}
          </Table.Body>
        </Table>
      </div>
    </Panel>
  );
}

export default function DistrictCourtStatistics() {
  const { data, isLoading, error } = useDistrictCourtStatisticsQuery();

  return (
    <>
      <Heading level={2} data-size="xl">
        Tingretter
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Bo opprettet fra juli 2025, per tingrett. Kansellerte og feilførte saker er holdt utenfor. Åpne
        skifteerklæringer er de av disse boene som har en skifteerklæring som verken er sendt inn eller har fått
        skifteattest. Medianen vises bare for tingretter med minst {MIN_FOR_MEDIAN} skifteattester. Nyere bo har ikke
        rukket å få skifteattest, så andelen er lavere for tingretter med mange nye saker.
      </Paragraph>
      <QueryState data={data} isLoading={isLoading} error={error} isEmpty={(d) => d.courts.length === 0} loadingLabel="Henter statistikk for tingretter">
        {(d) => <Courts courts={d.courts} />}
      </QueryState>
    </>
  );
}
