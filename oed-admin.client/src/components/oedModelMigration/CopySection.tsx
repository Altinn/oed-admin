import React from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Fieldset,
  Heading,
  Paragraph,
  Table,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { formatDateTime } from "../../utils/formatters";
import { copyEstate, copyMutationKey, parseInstanceId, type CopyResult } from "./api";
import { describeCopy } from "./texts";
import { useFocusOnMount } from "./useFocusOnMount";

interface Props {
  initialInstanceId?: string;
}

interface RetryWindow {
  /** Epoch ms when the person may try again. */
  at: number;
  /** Epoch ms when the 503 arrived, so the first render doesn't count from a stale clock. */
  from: number;
}

/** Seconds left of `retry`, ticking while there are any. */
function useSecondsLeft(retry: RetryWindow | null) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (retry === null) return;
    const timer = globalThis.setInterval(() => {
      const time = Date.now();
      setTick(time);
      if (time >= retry.at) globalThis.clearInterval(timer);
    }, 250);
    return () => globalThis.clearInterval(timer);
  }, [retry]);
  if (retry === null) return 0;
  return Math.max(0, Math.ceil((retry.at - Math.max(tick, retry.from)) / 1000));
}

function CopyAnswer({ instanceId, result }: { instanceId: string; result: CopyResult }) {
  const verdict = describeCopy(result);
  const copy = result.copy;
  return (
    <>
      <Alert data-color={verdict.severity} data-testid="copy-verdict">
        <Paragraph>{verdict.message}</Paragraph>
      </Alert>
      <Table data-size="sm" data-testid="copy-answer">
        <Table.Body>
          <Table.Row>
            <Table.HeaderCell>Instans</Table.HeaderCell>
            <Table.Cell>{instanceId}</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.HeaderCell>HTTP-status fra oed</Table.HeaderCell>
            <Table.Cell>{result.status === 0 ? "ingen svar" : result.status}</Table.Cell>
          </Table.Row>
          {copy && (
            <>
              <Table.Row>
                <Table.HeaderCell>outcome</Table.HeaderCell>
                <Table.Cell>{copy.outcome}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>failure</Table.HeaderCell>
                <Table.Cell>{copy.failure ?? "–"}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>failureReason</Table.HeaderCell>
                <Table.Cell>{copy.failureReason ?? "–"}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>droppedElements</Table.HeaderCell>
                <Table.Cell>
                  {copy.droppedElements.length === 0 ? (
                    "ingen"
                  ) : (
                    <ul>
                      {copy.droppedElements.map((element) => (
                        <li key={element}>
                          <code>{element}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>storageLastChanged</Table.HeaderCell>
                <Table.Cell>
                  {copy.storageLastChanged ? `${formatDateTime(copy.storageLastChanged, true)} (${copy.storageLastChanged})` : "–"}
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>created</Table.HeaderCell>
                <Table.Cell>
                  {copy.created ? `${formatDateTime(copy.created, true)} (${copy.created})` : "–"}
                </Table.Cell>
              </Table.Row>
            </>
          )}
          {result.problem && (
            <Table.Row>
              <Table.HeaderCell>Feil fra oed</Table.HeaderCell>
              <Table.Cell>
                {[result.problem.title, result.problem.detail].filter(Boolean).join(": ")}
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </>
  );
}

export default function CopySection({ initialInstanceId = "" }: Props) {
  const [instanceId, setInstanceId] = React.useState(initialInstanceId);
  const [confirming, setConfirming] = React.useState(false);
  const focusOnMount = useFocusOnMount();
  const [retryWindow, setRetryWindow] = React.useState<RetryWindow | null>(null);
  const parsed = parseInstanceId(instanceId);

  const mutation = useMutation({
    mutationKey: copyMutationKey,
    mutationFn: ({ partyId, instanceGuid }: { partyId: number; instanceGuid: string; label: string }) =>
      copyEstate(partyId, instanceGuid),
    // No automatic retry. After a 503 the person may ask again (below), once Retry-After has passed.
    retry: false,
    onSuccess: (result) => {
      const wait = describeCopy(result).retryAfterSeconds;
      const now = Date.now();
      setRetryWindow(wait === undefined ? null : { at: now + wait * 1000, from: now });
    },
  });

  const lastVerdict = mutation.data ? describeCopy(mutation.data) : undefined;
  const waitSeconds = useSecondsLeft(retryWindow);

  const send = () => {
    if (!parsed) return;
    setConfirming(false);
    setRetryWindow(null);
    mutation.mutate({ ...parsed, label: `${parsed.partyId}/${parsed.instanceGuid}` });
  };

  const retry = () => {
    if (mutation.variables) mutation.mutate(mutation.variables);
  };

  return (
    <section aria-labelledby="copy-heading">
      <Heading level={2} data-size="md" id="copy-heading">
        Kopier ett dødsbo
      </Heading>
      <Paragraph>
        Kopierer ett dødsbos OED_M fra Storage til databasen i oed. Ett dødsbo om gangen; massekopiering
        er sweep-kjøringen (#1902).
      </Paragraph>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (parsed) setConfirming(true);
        }}
      >
        <Fieldset>
          <Fieldset.Legend>Instans</Fieldset.Legend>
          <Textfield
            label="Instans-id"
            description="{partyId}/{instanceGuid}, for eksempel 512345/55555555-5555-5555-5555-555555555555"
            value={instanceId}
            onChange={(event) => {
              setInstanceId(event.target.value);
              setConfirming(false);
            }}
            error={
              instanceId.trim() !== "" && !parsed
                ? "Skriv instans-id-en som {partyId}/{instanceGuid}."
                : undefined
            }
          />
          <Button type="submit" disabled={!parsed || mutation.isPending}>
            Kopier …
          </Button>
        </Fieldset>
      </form>

      {confirming && parsed && (
        <Alert data-color="warning" role="alertdialog" aria-labelledby="copy-confirm-heading">
          <Heading level={3} data-size="xs" id="copy-confirm-heading">
            Kopiere {parsed.partyId}/{parsed.instanceGuid} til databasen?
          </Heading>
          <Paragraph>
            Fra da av leses og skrives dødsboet bare i databasen, og Storage-kopien fryses. Fra første rad
            i et miljø gjelder regel 5: deploy aldri et oed-bygg eldre enn #1904 dit.
          </Paragraph>
          <div style={{ display: "flex", gap: "var(--ds-size-2)" }}>
            <Button ref={focusOnMount} data-color="danger" onClick={send}>
              Ja, kopier
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Avbryt
            </Button>
          </div>
        </Alert>
      )}

      {mutation.isPending && <Paragraph>Kopierer …</Paragraph>}
      {mutation.error && (
        <ValidationMessage>Kunne ikke kopiere: {mutation.error.message}</ValidationMessage>
      )}
      {mutation.data && mutation.variables && (
        <CopyAnswer instanceId={mutation.variables.label} result={mutation.data} />
      )}
      {lastVerdict?.retryAfterSeconds !== undefined && !mutation.isPending && (
        <Button variant="secondary" onClick={retry} disabled={waitSeconds > 0}>
          {waitSeconds > 0 ? `Prøv igjen om ${waitSeconds} s` : "Prøv igjen"}
        </Button>
      )}
    </section>
  );
}
