import { Heading, Paragraph, Table, Tag } from "@digdir/designsystemet-react";
import { useEstateOutcomesQuery, type OutcomeMonth } from "../../queries/statisticsQueries";
import { Panel, QueryState } from "../statistics/panels";
import { MUTED, PROVISIONAL_MONTHS, formatCount, formatMonth, formatPercent, numCellStyle } from "../statistics/statsFormat";

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

function Outcomes({ months }: { months: OutcomeMonth[] }) {
  const columns = resultColumns(months);
  const provisional = new Set(months.slice(-PROVISIONAL_MONTHS).map((month) => month.month));
  const rows = [...months].reverse();

  return (
    <Panel
      title="Utfall per måned"
      subtitle="Antall og andel av alle bo opprettet i måneden. Utfallskolonnene er hentet rett fra ProbateResult."
    >
      <div style={{ overflowX: "auto" }}>
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
      </div>
    </Panel>
  );
}

export default function EstateOutcomes() {
  const { data, isLoading, error } = useEstateOutcomesQuery();

  return (
    <>
      <Heading level={2} data-size="xl">
        Utfall
      </Heading>
      <Paragraph data-size="sm" style={{ marginBottom: "var(--ds-size-3)" }}>
        Hvordan bo opprettet fra juli 2025 har endt, etter måneden de ble opprettet. Kansellerte og feilførte saker er
        talt for seg; resten er fordelt på resultatet fra tingretten. De siste {PROVISIONAL_MONTHS} månedene er merket
        foreløpige, fordi mange av boene ennå ikke har fått et resultat.
      </Paragraph>
      <QueryState data={data} isLoading={isLoading} error={error} isEmpty={(d) => d.months.length === 0} loadingLabel="Henter utfall">
        {(d) => <Outcomes months={d.months} />}
      </QueryState>
    </>
  );
}
