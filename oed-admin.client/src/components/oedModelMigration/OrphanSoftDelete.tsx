import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Heading, Paragraph, Table, ValidationMessage } from "@digdir/designsystemet-react";
import {
  getAllRunItems,
  isOrphanCandidate,
  orphanDeleteEnabled,
  runQueryKeys,
  softDeleteOrphan,
  stopsTheLoop,
  type MigrationRun,
  type OrphanSoftDeleteResult,
  type RunItem,
} from "./api";
import { useFocusOnMount } from "./useFocusOnMount";

// Soft-deleting the estates a sweep can never copy (Failed with NoDeceasedInfo), TT02 only (Altinn/oed#1905).
// oed checks every estate itself before it deletes; these buttons only ask.

const consequence =
  "Soft delete i TT02: Storage beholder instansen, men den regnes ikke lenger som levende. oed sjekker selv at dødsboet " +
  "ikke kan migreres (ingen rad i databasen, ingen Estate-rad, ingen avdød i modellen) før det slettes. Det kan ikke " +
  "angres herfra.";

/** oed's answer for one estate, in one line. */
const describe = (answer: OrphanSoftDeleteResult): string => {
  const outcome = answer.result?.outcome;
  if (outcome === "SoftDeleted") return "Slettet (soft delete).";
  if (outcome === "AlreadyDeleted") return "Var allerede slettet.";
  if (outcome === "NotAnOrphan") return `Ikke slettet: dødsboet kan migreres eller er i bruk (${answer.result?.reason ?? "ukjent"}).`;
  if (outcome === "InstanceNotFound") return "Instansen finnes ikke.";
  if (outcome === "NotAllowed") return "oed nektet: dette er bare tillatt i TT02.";
  if (outcome === "StorageError") return `Storage feilet (${answer.result?.reason ?? "ukjent"}). Prøv igjen senere.`;
  if (answer.status === 503) return `Dødsboet var opptatt. Prøv igjen om ${answer.retryAfterSeconds ?? 10} s.`;
  if (answer.status === 0) return "Fikk ikke svar fra oed.";
  return `Uventet svar fra oed (${answer.status}).`;
};

/** How a result is counted in the bulk summary: oed's outcome, or the status when oed sent none. */
const outcomeKey = (answer: OrphanSoftDeleteResult) => answer.result?.outcome ?? `HTTP ${answer.status}`;

const instanceIdOf = (item: RunItem) => `${item.run.instanceOwnerPartyId}/${item.run.instanceGuid}`;

interface RowProps {
  run: MigrationRun;
  item: RunItem;
}

/** «Slett …» on one of a sweep run's NoDeceasedInfo items. Renders nothing elsewhere. */
export function OrphanRowDelete({ run, item }: RowProps) {
  const queryClient = useQueryClient();
  const focusOnMount = useFocusOnMount();
  const [confirming, setConfirming] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  if (!orphanDeleteEnabled() || !isOrphanCandidate(run, item)) return null;

  const instanceId = instanceIdOf(item);
  const send = async () => {
    setConfirming(false);
    setSending(true);
    try {
      setResult(describe(await softDeleteOrphan(item.run.instanceOwnerPartyId, item.run.instanceGuid)));
    } catch (error) {
      setResult(`Kunne ikke slette: ${(error as Error).message}`);
    } finally {
      setSending(false);
      await queryClient.invalidateQueries({ queryKey: runQueryKeys.allItems(run.id) });
    }
  };

  return (
    <>
      <Button variant="tertiary" data-size="sm" data-color="danger" disabled={sending} onClick={() => setConfirming(true)}>
        Slett …
      </Button>
      {confirming && (
        <Alert data-color="warning" role="alertdialog" aria-labelledby={`orphan-confirm-${instanceId}`}>
          <Heading level={5} data-size="2xs" id={`orphan-confirm-${instanceId}`}>
            Slette {instanceId}?
          </Heading>
          <Paragraph data-size="sm">{consequence}</Paragraph>
          <div style={{ display: "flex", gap: "var(--ds-size-2)" }}>
            <Button ref={focusOnMount} data-size="sm" data-color="danger" onClick={send}>
              Ja, slett
            </Button>
            <Button data-size="sm" variant="secondary" onClick={() => setConfirming(false)}>
              Avbryt
            </Button>
          </div>
        </Alert>
      )}
      {sending && <Paragraph data-size="sm">Sletter …</Paragraph>}
      {result && (
        <Paragraph data-size="sm" aria-live="polite">
          {result}
        </Paragraph>
      )}
    </>
  );
}

type BulkState =
  | { step: "idle" }
  | { step: "collecting" }
  | { step: "confirming"; items: RunItem[] }
  | {
      step: "running" | "done";
      total: number;
      done: number;
      counts: Record<string, number>;
      /** Every estate that wasn't deleted, with oed's answer: a result per estate (Altinn/oed#1905 spec §5.2). */
      problems: Array<{ instanceId: string; text: string }>;
      stoppedBecause: string | null;
    };

/** Answers that leave nothing for a person to look at. */
const isDone = (answer: OrphanSoftDeleteResult) =>
  answer.result?.outcome === "SoftDeleted" || answer.result?.outcome === "AlreadyDeleted";

/** «Slett alle NoDeceasedInfo-dødsbo i kjøringen …» for a sweep run. Renders nothing elsewhere. */
export function OrphanBulkDelete({ run }: { run: MigrationRun }) {
  const queryClient = useQueryClient();
  const focusOnMount = useFocusOnMount();
  const [state, setState] = React.useState<BulkState>({ step: "idle" });
  const [error, setError] = React.useState<string | null>(null);
  const stopRequested = React.useRef(false);

  if (!orphanDeleteEnabled() || run.mode !== "Sweep") return null;

  const collect = async () => {
    setError(null);
    setState({ step: "collecting" });
    try {
      const items = (await getAllRunItems(run.id, "Failed")).filter((item) => isOrphanCandidate(run, item));
      setState({ step: "confirming", items });
    } catch (e) {
      setError(`Kunne ikke hente kjøringens dødsbo: ${(e as Error).message}`);
      setState({ step: "idle" });
    }
  };

  // Strictly one call at a time: each waits for the previous answer.
  const deleteAll = async (items: RunItem[]) => {
    stopRequested.current = false;
    const counts: Record<string, number> = {};
    const problems: Array<{ instanceId: string; text: string }> = [];
    let done = 0;
    let stoppedBecause: string | null = null;
    setState({ step: "running", total: items.length, done, counts: {}, problems: [], stoppedBecause });

    for (const item of items) {
      if (stopRequested.current) {
        stoppedBecause = "Stoppet av deg.";
        break;
      }
      let answer: OrphanSoftDeleteResult;
      try {
        answer = await softDeleteOrphan(item.run.instanceOwnerPartyId, item.run.instanceGuid);
      } catch (e) {
        stoppedBecause = `Stoppet ved ${instanceIdOf(item)}: ${(e as Error).message}`;
        break;
      }
      done++;
      counts[outcomeKey(answer)] = (counts[outcomeKey(answer)] ?? 0) + 1;
      if (!isDone(answer)) problems.push({ instanceId: instanceIdOf(item), text: describe(answer) });
      setState({ step: "running", total: items.length, done, counts: { ...counts }, problems: [...problems], stoppedBecause });
      if (stopsTheLoop(answer)) {
        stoppedBecause = `Stoppet ved ${instanceIdOf(item)}: oed svarte ${answer.status}. ${describe(answer)}`;
        break;
      }
    }

    setState({ step: "done", total: items.length, done, counts: { ...counts }, problems: [...problems], stoppedBecause });
    await queryClient.invalidateQueries({ queryKey: runQueryKeys.allItems(run.id) });
  };

  return (
    <div data-testid="orphan-bulk">
      <Button
        variant="secondary"
        data-size="sm"
        data-color="danger"
        disabled={state.step === "collecting" || state.step === "running"}
        onClick={collect}
      >
        Slett alle NoDeceasedInfo-dødsbo i kjøringen …
      </Button>
      {error && <ValidationMessage>{error}</ValidationMessage>}
      {state.step === "collecting" && <Paragraph data-size="sm">Henter alle sidene …</Paragraph>}

      {state.step === "confirming" && state.items.length === 0 && (
        <Alert data-color="info">Kjøringen har ingen dødsbo med Failed og NoDeceasedInfo.</Alert>
      )}
      {state.step === "confirming" && state.items.length > 0 && (
        <Alert data-color="warning" role="alertdialog" aria-labelledby="orphan-bulk-confirm">
          <Heading level={5} data-size="2xs" id="orphan-bulk-confirm">
            Slette {state.items.length} dødsbo med NoDeceasedInfo?
          </Heading>
          <Paragraph data-size="sm">{consequence}</Paragraph>
          <Paragraph data-size="sm">
            Kallene går ett og ett. Du kan stoppe underveis, og en ny kjøring hopper over dem som allerede er slettet.
          </Paragraph>
          <div style={{ display: "flex", gap: "var(--ds-size-2)" }}>
            <Button ref={focusOnMount} data-size="sm" data-color="danger" onClick={() => deleteAll(state.items)}>
              Ja, slett {state.items.length}
            </Button>
            <Button data-size="sm" variant="secondary" onClick={() => setState({ step: "idle" })}>
              Avbryt
            </Button>
          </div>
        </Alert>
      )}

      {(state.step === "running" || state.step === "done") && (
        <div aria-live="polite">
          <Paragraph data-size="sm">
            {state.step === "running" ? "Sletter" : "Ferdig"}: {state.done} av {state.total}
          </Paragraph>
          {state.step === "running" && (
            <Button
              data-size="sm"
              variant="secondary"
              onClick={() => {
                stopRequested.current = true;
              }}
            >
              Stopp
            </Button>
          )}
          {state.step === "done" && (
            <>
              <Paragraph data-size="sm" data-testid="orphan-bulk-summary">
                Ferdig: {state.done}.{" "}
                {Object.entries(state.counts)
                  .map(([outcome, count]) => `${outcome}: ${count}`)
                  .join(", ")}
              </Paragraph>
              {state.problems.length > 0 && (
                <Table data-size="sm" data-testid="orphan-bulk-problems">
                  <caption>Ikke slettet</caption>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Instans</Table.HeaderCell>
                      <Table.HeaderCell>Svar fra oed</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {state.problems.map(({ instanceId, text }) => (
                      <Table.Row key={instanceId}>
                        <Table.Cell>
                          <code>{instanceId}</code>
                        </Table.Cell>
                        <Table.Cell>{text}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
              {state.stoppedBecause && (
                <Alert data-color="danger" data-testid="orphan-bulk-stopped">
                  {state.stoppedBecause}
                </Alert>
              )}
              <Paragraph data-size="sm">Start en verify for å se resultatet.</Paragraph>
            </>
          )}
        </div>
      )}
    </div>
  );
}
