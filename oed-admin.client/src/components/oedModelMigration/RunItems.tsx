import React from "react";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Field, Heading, Label, Paragraph, Table, ValidationMessage } from "@digdir/designsystemet-react";
import { formatDateTime } from "../../utils/formatters";
import { copyMutationKey, getRunItems, isActiveStatus, runItemsPageSize, runOutcomes, runPollMs, runQueryKeys, type MigrationRun } from "./api";
import { describeRunProblem } from "./texts";
import { OrphanBulkDelete, OrphanRowDelete } from "./OrphanSoftDelete";

interface Props {
  run: MigrationRun;
  onCopyInstance: (instanceId: string) => void;
}

/** What a person most likely wants to look at first. */
const defaultOutcome = (mode: string) => (mode === "Verify" ? "Missing" : "Failed");

/** A run's items, paged and filtered by outcome (Altinn/oed#1923 §4.3). Party ids and guids only, never nins. */
export default function RunItems({ run, onCopyInstance }: Props) {
  const outcomes = runOutcomes[run.mode] ?? [];
  const [outcome, setOutcome] = React.useState(() => defaultOutcome(run.mode));
  const [page, setPage] = React.useState(1);
  // Filling the copy form remounts it, which would hide the answer to a copy still in flight.
  const copying = useIsMutating({ mutationKey: copyMutationKey }) > 0;

  const { data, error, isLoading } = useQuery({
    queryKey: runQueryKeys.items(run.id, outcome, page),
    queryFn: () => getRunItems(run.id, outcome, page),
    refetchInterval: isActiveStatus(run.status) ? runPollMs : false,
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / runItemsPageSize));

  return (
    <section aria-labelledby="items-heading" data-testid="run-items">
      <Heading level={4} data-size="xs" id="items-heading">
        Dødsbo i kjøringen
      </Heading>
      <OrphanBulkDelete run={run} />
      <Field>
        <Label htmlFor="run-items-outcome">Utfall</Label>
        <select
          id="run-items-outcome"
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Alle</option>
          {outcomes.map((name) => (
            <option key={name} value={name}>
              {name}
              {run.report ? ` (${run.report.outcomes[name] ?? 0})` : ""}
            </option>
          ))}
        </select>
      </Field>

      {isLoading && <Paragraph>Henter …</Paragraph>}
      {error && <ValidationMessage>Kunne ikke hente dødsboene: {error.message}</ValidationMessage>}
      {data && data.status !== 200 && (
        <ValidationMessage>
          {describeRunProblem(data.status)} {data.problem?.detail ?? data.problem?.title ?? ""}
        </ValidationMessage>
      )}

      {data?.items && (
        <>
          <Paragraph data-size="sm" data-testid="run-items-total">
            {total} dødsbo{outcome ? ` med utfall ${outcome}` : ""}.
          </Paragraph>
          {data.items.length > 0 && (
            <Table data-size="sm">
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Instans</Table.HeaderCell>
                  <Table.HeaderCell>Utfall</Table.HeaderCell>
                  <Table.HeaderCell>Feil</Table.HeaderCell>
                  <Table.HeaderCell>Årsak</Table.HeaderCell>
                  <Table.HeaderCell>Forsøk</Table.HeaderCell>
                  <Table.HeaderCell>Oppdatert</Table.HeaderCell>
                  <Table.HeaderCell>Dødsbo</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {data.items.map((runItem) => {
                  const { run: item, estateId } = runItem;
                  const instanceId = `${item.instanceOwnerPartyId}/${item.instanceGuid}`;
                  return (
                    <Table.Row key={instanceId}>
                      <Table.Cell>
                        <code>{instanceId}</code>
                      </Table.Cell>
                      <Table.Cell>{item.outcome ?? "venter"}</Table.Cell>
                      <Table.Cell>{item.failure ?? "–"}</Table.Cell>
                      <Table.Cell>{item.reason ?? "–"}</Table.Cell>
                      <Table.Cell>{item.attempts}</Table.Cell>
                      <Table.Cell>{formatDateTime(item.updated, true)}</Table.Cell>
                      <Table.Cell>{estateId ? <Link to={`/estate/${estateId}`}>Åpne dødsbo</Link> : "–"}</Table.Cell>
                      <Table.Cell>
                        <Button variant="tertiary" data-size="sm" disabled={copying} onClick={() => onCopyInstance(instanceId)}>
                          Kopier …
                        </Button>
                        <OrphanRowDelete run={run} item={runItem} />
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          )}
          {pages > 1 && (
            <div style={{ display: "flex", gap: "var(--ds-size-2)", alignItems: "center" }}>
              <Button variant="secondary" data-size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Forrige
              </Button>
              <Paragraph data-size="sm">
                Side {page} av {pages}
              </Paragraph>
              <Button variant="secondary" data-size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Neste
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
