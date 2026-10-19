import { Heading, Paragraph, Table } from "@digdir/designsystemet-react";
import { useProbateDeadlinesQuery, type DeadlineBucket, type ProbateDeadlinesResponse } from "../../queries/statisticsQueries";
import { Bar, ChartPanel, QueryState, Tile, Tiles } from "../statistics/panels";
import { DANGER, MUTED, WARNING, formatCount, formatDay, isoWeek, numCellStyle } from "../statistics/statsFormat";

const BUCKETS: Record<DeadlineBucket, { label: string; color?: string }> = {
  overdueMoreThan30: { label: "Forfalt for over 30 dager siden", color: DANGER },
  overdue: { label: "Forfalt siste 30 dager", color: DANGER },
  within7: { label: "Frist innen 7 dager", color: WARNING },
  within30: { label: "Frist om 8–30 dager", color: WARNING },
  within90: { label: "Frist om 31–90 dager" },
  later: { label: "Frist om over 90 dager" },
  noDeadline: { label: "Uten frist" },
};

function Deadlines({ buckets, weeks }: ProbateDeadlinesResponse) {
  const open = buckets.reduce((total, bucket) => total + bucket.count, 0);
  const max = Math.max(...weeks.map((week) => week.count));

  return (
    <>
      <Paragraph data-size="lg" style={{ marginBottom: "var(--ds-size-3)" }}>
        Åpne bo: <strong>{formatCount(open)}</strong>
      </Paragraph>
      <Tiles>
        {buckets.map((bucket) => (
          <Tile
            key={bucket.bucket}
            label={BUCKETS[bucket.bucket].label}
            value={formatCount(bucket.count)}
            color={bucket.count > 0 ? BUCKETS[bucket.bucket].color : undefined}
          />
        ))}
      </Tiles>
      <ChartPanel
        title="Frister de neste 12 ukene"
        subtitle="Åpne bo med frist i hver uke, fra og med denne uken"
        chart={
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--ds-size-2)" }}>
            {weeks.map((week) => (
              <li
                key={week.weekStart}
                style={{ display: "grid", gridTemplateColumns: "10rem 1fr 3rem", alignItems: "center", gap: "var(--ds-size-2)" }}
              >
                <span>
                  uke {isoWeek(week.weekStart)} <span style={{ color: MUTED }}>fra {formatDay(week.weekStart)}</span>
                </span>
                <Bar fraction={max === 0 ? 0 : week.count / max} />
                <strong style={numCellStyle}>{formatCount(week.count)}</strong>
              </li>
            ))}
          </ol>
        }
        table={
          <Table data-size="sm" style={{ width: "100%" }}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Uke</Table.HeaderCell>
                <Table.HeaderCell>Fra</Table.HeaderCell>
                <Table.HeaderCell style={{ textAlign: "right" }}>Bo med frist</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {weeks.map((week) => (
                <Table.Row key={week.weekStart}>
                  <Table.Cell>{isoWeek(week.weekStart)}</Table.Cell>
                  <Table.Cell>{formatDay(week.weekStart)}</Table.Cell>
                  <Table.Cell style={numCellStyle}>{formatCount(week.count)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        }
      />
    </>
  );
}

export default function ProbateDeadlines() {
  const { data, isLoading, error } = useProbateDeadlinesQuery();

  return (
    <>
      <Heading level={2} data-size="xl">
        Frister
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Åpne bo fordelt etter hvor langt unna skiftefristen er. Et bo regnes som åpent til skifteerklæringen er sendt
        inn eller skifteattesten er utstedt. Kansellerte og feilførte saker er holdt utenfor. Alle bo i tabellen er med,
        også de fra før juli 2025, så de forfalte kan omfatte eldre bo som er avsluttet utenfor løsningen. Skifteerklæringer
        i den nye subappen er ikke med, så bo som har sendt inn der kan stå som åpne. Fanen viser situasjonen nå og har
        derfor ikke valg av periode.
      </Paragraph>
      <QueryState data={data} isLoading={isLoading} error={error} isEmpty={(d) => d.buckets.length === 0} loadingLabel="Henter frister">
        {(d) => <Deadlines buckets={d.buckets} weeks={d.weeks} />}
      </QueryState>
    </>
  );
}
