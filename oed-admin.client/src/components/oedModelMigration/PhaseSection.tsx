import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Fieldset,
  Heading,
  Paragraph,
  Radio,
  Skeleton,
  Table,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { formatDateTime } from "../../utils/formatters";
import {
  getPhase,
  phaseQueryKey,
  phases,
  setPhase,
  type Phase,
  type PhaseResult,
} from "./api";
import { describePhaseRefusal, phaseConsequences } from "./texts";
import LatestVerify from "./LatestVerify";
import { useFocusOnMount } from "./useFocusOnMount";

const maxReasonLength = 500;

function PhaseProblem({ result }: { result: PhaseResult }) {
  const errors = Object.entries(result.problem?.errors ?? {});
  return (
    <Alert data-color="danger" data-testid="phase-problem">
      <Paragraph>{describePhaseRefusal(result.status)}</Paragraph>
      {/* oed's detail is the reason. Shown verbatim, never retried. */}
      {result.problem?.detail && <Paragraph data-testid="phase-problem-detail">{result.problem.detail}</Paragraph>}
      {!result.problem?.detail && result.problem?.title && <Paragraph>{result.problem.title}</Paragraph>}
      {errors.map(([field, messages]) => (
        <Paragraph key={field}>
          {field}: {messages.join(" ")}
        </Paragraph>
      ))}
    </Alert>
  );
}

export default function PhaseSection({ onShowRun }: { onShowRun?: (runId: string) => void }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = React.useState<Phase | "">("");
  const [reason, setReason] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const focusOnMount = useFocusOnMount();

  const { data, isLoading, error } = useQuery({
    queryKey: phaseQueryKey,
    queryFn: getPhase,
  });

  const mutation = useMutation({
    mutationFn: ({ phase, reason }: { phase: Phase; reason: string }) => setPhase(phase, reason),
    // No retry: a phase change is never repeated behind the person's back.
    retry: false,
    onSuccess: (result) => {
      if (result.status === 200 && result.phase) {
        queryClient.setQueryData(phaseQueryKey, result);
        setReason("");
        setTarget("");
      }
    },
  });

  const trimmedReason = reason.trim();
  const canAsk = target !== "" && trimmedReason.length > 0 && trimmedReason.length <= maxReasonLength;

  const confirm = () => {
    if (target === "" || !canAsk) return;
    setConfirming(false);
    mutation.mutate({ phase: target, reason: trimmedReason });
  };

  const current = data?.status === 200 ? data.phase : null;

  return (
    <section aria-labelledby="phase-heading">
      <Heading level={2} data-size="md" id="phase-heading">
        Fase
      </Heading>

      {isLoading && <Skeleton variant="rectangle" height="6rem" aria-label="Henter fasen" />}
      {error && <ValidationMessage>Kunne ikke hente fasen: {error.message}</ValidationMessage>}
      {data && !(data.status === 200 && data.phase) && <PhaseProblem result={data} />}

      {current && (
        <>
          <Table data-size="sm">
            <Table.Body>
              <Table.Row>
                <Table.HeaderCell>Lagret fase</Table.HeaderCell>
                <Table.Cell data-testid="current-phase">{current.phase}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>Begrunnelse</Table.HeaderCell>
                <Table.Cell>{current.reason}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>Endret</Table.HeaderCell>
                <Table.Cell>{formatDateTime(current.changed, true)}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>Endret av (klient)</Table.HeaderCell>
                <Table.Cell>{current.changedBy}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>Fasen poden som svarte, ser</Table.HeaderCell>
                <Table.Cell>{current.cachedOnThisPod ?? "(ikke lest ennå)"}</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
          <Paragraph data-size="sm">
            Den lagrede fasen gjelder. Hver oed-pod leser den på nytt hvert femte sekund, så andre
            pods følger etter innen omtrent 5 sekunder.
          </Paragraph>
          <LatestVerify onShowRun={onShowRun} />
        </>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canAsk) setConfirming(true);
        }}
      >
        <Fieldset>
          <Fieldset.Legend>Endre fasen</Fieldset.Legend>
          {phases.map((phase) => (
            <Radio
              key={phase}
              name="phase"
              value={phase}
              label={phase}
              description={phaseConsequences[phase]}
              checked={target === phase}
              onChange={() => {
                setTarget(phase);
                setConfirming(false);
              }}
            />
          ))}
          <Textfield
            multiline
            label="Begrunnelse"
            description="Påkrevd. oed-admin legger til navnet ditt og objekt-id-en din før den sendes til oed."
            value={reason}
            maxLength={maxReasonLength}
            onChange={(event) => {
              setReason(event.target.value);
              setConfirming(false);
            }}
          />
          <Button type="submit" disabled={!canAsk || mutation.isPending}>
            Endre fasen …
          </Button>
        </Fieldset>
      </form>

      {confirming && target !== "" && (
        <Alert data-color="warning" role="alertdialog" aria-labelledby="phase-confirm-heading">
          <Heading level={3} data-size="xs" id="phase-confirm-heading">
            Sette fasen til {target}?
          </Heading>
          <Paragraph data-testid="phase-consequence">{phaseConsequences[target]}</Paragraph>
          <Paragraph>Begrunnelse: {trimmedReason}</Paragraph>
          <div style={{ display: "flex", gap: "var(--ds-size-2)" }}>
            <Button ref={focusOnMount} data-color="danger" onClick={confirm}>
              Ja, sett fasen til {target}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Avbryt
            </Button>
          </div>
        </Alert>
      )}

      {mutation.isPending && <Paragraph>Sender til oed …</Paragraph>}
      {mutation.error && (
        <ValidationMessage>Kunne ikke endre fasen: {mutation.error.message}</ValidationMessage>
      )}
      {mutation.data?.status === 200 && mutation.data.phase && (
        <Alert data-color="success">Fasen er satt til {mutation.data.phase.phase}.</Alert>
      )}
      {mutation.data && !(mutation.data.status === 200 && mutation.data.phase) && (
        <PhaseProblem result={mutation.data} />
      )}
    </section>
  );
}
