import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Heading,
  Paragraph,
  Table,
  Tag,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { formatDateTime } from "../../utils/formatters";
import { cancelRun, isAccepted, isActiveStatus, runQueryKeys, type MigrationRun, type RunResult } from "./api";
import { describeRunProblem, runStatusColor } from "./texts";
import { useFocusOnMount } from "./useFocusOnMount";
import RunItems from "./RunItems";

interface Props {
  run: MigrationRun;
  onShowRun: (runId: string) => void;
  onCopyInstance: (instanceId: string) => void;
}

const when = (value: string | null) => (value ? formatDateTime(value, true) : "–");

function CountTable({ caption, counts }: { caption: string; counts: Record<string, number> }) {
  return (
    <Table data-size="sm" data-testid={`report-${caption}`}>
      <caption>{caption}</caption>
      <Table.Body>
        {Object.entries(counts).map(([name, count]) => (
          <Table.Row key={name}>
            <Table.HeaderCell>{name}</Table.HeaderCell>
            <Table.Cell>{count}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

export function RunProblem({ result }: { result: RunResult }) {
  return (
    <Alert data-color="danger" data-testid="run-problem">
      <Paragraph>{describeRunProblem(result.status)}</Paragraph>
      {/* oed's detail is the reason. Shown verbatim, never retried. */}
      {result.problem?.detail && <Paragraph data-testid="run-problem-detail">{result.problem.detail}</Paragraph>}
      {!result.problem?.detail && result.problem?.title && <Paragraph>{result.problem.title}</Paragraph>}
      {Object.entries(result.problem?.errors ?? {}).map(([field, messages]) => (
        <Paragraph key={field}>
          {field}: {messages.join(" ")}
        </Paragraph>
      ))}
    </Alert>
  );
}

export default function RunDetails({ run, onShowRun, onCopyInstance }: Props) {
  const queryClient = useQueryClient();
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const focusOnMount = useFocusOnMount();

  const cancel = useMutation({
    mutationFn: () => cancelRun(run.id),
    // A cancel is never repeated behind the person's back.
    retry: false,
    onSuccess: (result) => {
      if (result.run) queryClient.setQueryData(runQueryKeys.run(run.id), result);
      void queryClient.invalidateQueries({ queryKey: runQueryKeys.active });
    },
  });

  const active = isActiveStatus(run.status);
  const { listed, processed, toProcess } = run.progress;
  const report = run.report;

  return (
    <section aria-labelledby="run-heading" data-testid="run-details">
      <Heading level={3} data-size="sm" id="run-heading">
        {run.mode} <Tag data-color={runStatusColor(run.status)}>{run.status}</Tag>
      </Heading>
      <Table data-size="sm">
        <Table.Body>
          <Table.Row>
            <Table.HeaderCell>Kjøring</Table.HeaderCell>
            <Table.Cell>
              <code>{run.id}</code>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.HeaderCell>Startet av (klient)</Table.HeaderCell>
            <Table.Cell>{run.requestedBy}</Table.Cell>
          </Table.Row>
          {run.cancelRequestedBy && (
            <Table.Row>
              <Table.HeaderCell>Avbrudd bedt om av</Table.HeaderCell>
              <Table.Cell>{run.cancelRequestedBy}</Table.Cell>
            </Table.Row>
          )}
          {run.continuesRunId && (
            <Table.Row>
              <Table.HeaderCell>Fortsetter</Table.HeaderCell>
              <Table.Cell>
                <Button variant="tertiary" data-size="sm" onClick={() => onShowRun(run.continuesRunId!)}>
                  {run.continuesRunId}
                </Button>
              </Table.Cell>
            </Table.Row>
          )}
          <Table.Row>
            <Table.HeaderCell>Opprettet / startet / ferdig</Table.HeaderCell>
            <Table.Cell>
              {when(run.created)} / {when(run.started)} / {when(run.finished)}
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.HeaderCell>Siste hjerteslag</Table.HeaderCell>
            <Table.Cell>{when(run.heartbeat)}</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.HeaderCell>Parametere</Table.HeaderCell>
            <Table.Cell>
              rate {run.parameters.ratePerSecond}/s, parallellitet {run.parameters.maxParallelism}
              {run.parameters.limit !== null && `, grense ${run.parameters.limit}`}
              {run.parameters.sampleSize !== null && `, sample ${run.parameters.sampleSize}`}
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.HeaderCell>Fremdrift</Table.HeaderCell>
            <Table.Cell data-testid="run-progress">
              {processed} av {toProcess} behandlet ({listed} listet)
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
      <progress value={processed} max={Math.max(toProcess, 1)} aria-label="Fremdrift" />

      {active && (
        <Paragraph data-size="sm">
          Oppdateres hvert 15. sekund. oed skriver hjerteslag hvert 15. sekund; en kjøring uten hjerteslag i 2 minutter
          blir Abandoned og fortsatt som en ny kjøring.
        </Paragraph>
      )}
      {run.status === "Abandoned" && (
        <Alert data-color="warning">
          Poden som kjørte denne, stoppet. oed fortsetter den som en ny kjøring med ny id; den vises som aktiv kjøring.
        </Alert>
      )}
      {run.failureReason && (
        <Alert data-color="danger" data-testid="run-failure">
          <Paragraph>Kjøringen feilet: {run.failureReason}</Paragraph>
        </Alert>
      )}

      {active && !confirmingCancel && (
        <Button variant="secondary" data-color="danger" onClick={() => setConfirmingCancel(true)} disabled={cancel.isPending}>
          Avbryt kjøringen …
        </Button>
      )}
      {active && confirmingCancel && (
        <Alert data-color="warning" role="alertdialog" aria-labelledby="cancel-confirm-heading">
          <Heading level={4} data-size="xs" id="cancel-confirm-heading">
            Avbryte kjøringen?
          </Heading>
          <Paragraph>
            Kjøringen planlegger ikke mer arbeid. Dødsbo som kopieres akkurat nå, blir ferdige. Den ender som Cancelled og
            får en rapport. En avbrutt verify er aldri ready.
          </Paragraph>
          <div style={{ display: "flex", gap: "var(--ds-size-2)" }}>
            <Button
              ref={focusOnMount}
              data-color="danger"
              onClick={() => {
                setConfirmingCancel(false);
                cancel.mutate();
              }}
            >
              Ja, avbryt kjøringen
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>
              Nei
            </Button>
          </div>
        </Alert>
      )}
      {cancel.error && <ValidationMessage>Kunne ikke avbryte: {cancel.error.message}</ValidationMessage>}
      {cancel.data && isAccepted(cancel.data) && <Alert data-color="info">Avbrudd er bedt om.</Alert>}
      {cancel.data && !isAccepted(cancel.data) && <RunProblem result={cancel.data} />}

      {report && (
        <section aria-labelledby="report-heading" data-testid="run-report">
          <Heading level={4} data-size="xs" id="report-heading">
            Rapport
          </Heading>
          {run.mode === "Verify" && (
            <Paragraph data-testid="run-ready">
              Ready:{" "}
              <Tag data-color={report.ready ? "success" : "danger"}>{report.ready ? "ja" : "nei"}</Tag>
              {" "}({report.sampled} rader sammenlignet med Storage, {report.databaseCreatedRows} rader opprettet i
              databasen)
            </Paragraph>
          )}
          <div style={{ display: "flex", gap: "var(--ds-size-8)", flexWrap: "wrap" }}>
            <CountTable caption="Utfall" counts={report.outcomes} />
            <CountTable caption="Feil per årsak" counts={report.failuresByReason} />
          </div>
          <Paragraph data-size="sm">
            Eiere med mer enn én levende instans: {report.duplicateOwnerCount}
            {report.duplicateOwnerPartyIds.length > 0 && ` (party-id ${report.duplicateOwnerPartyIds.join(", ")})`}
          </Paragraph>
        </section>
      )}

      <RunItems run={run} onCopyInstance={onCopyInstance} />
    </section>
  );
}
