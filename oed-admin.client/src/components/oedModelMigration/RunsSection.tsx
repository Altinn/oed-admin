import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Fieldset,
  Heading,
  Paragraph,
  Radio,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import {
  getActiveRun,
  getRun,
  isAccepted,
  isActiveStatus,
  parseRunId,
  runPollMs,
  runQueryKeys,
  startRun,
  throwIfUnavailable,
  type RunMode,
  type RunStart,
} from "./api";
import { describeRunProblem, runConsequence } from "./texts";
import { useFocusOnMount } from "./useFocusOnMount";
import RunDetails, { RunProblem } from "./RunDetails";

interface Props {
  /** The run in ?runId=: opened by id, from the latest verify, or from a continued run's link. */
  selectedRunId: string | null;
  /** What «Åpne kjøring» starts with: a ?runId= that wasn't a run id, so the person sees why nothing opened. */
  initialOpenRunId?: string;
  onShowRun: (runId: string | null) => void;
  onCopyInstance: (instanceId: string) => void;
}

type NumberField = "limit" | "ratePerSecond" | "maxParallelism" | "sampleSize";

const fieldRules: Record<NumberField, { label: string; min: number; max: number; integer: boolean; modes: RunMode[]; hint: string }> = {
  // The server's limit is an int.
  limit: { label: "Grense", min: 1, max: 2_147_483_647, integer: true, modes: ["sweep"], hint: "Stopp etter så mange kopier. Tomt: ingen grense." },
  ratePerSecond: { label: "Dødsbo per sekund", min: 0.1, max: 10, integer: false, modes: ["sweep", "verify"], hint: "Over 0, høyst 10. Tomt: 2." },
  maxParallelism: { label: "Parallellitet", min: 1, max: 10, integer: true, modes: ["sweep", "verify"], hint: "1 til 10. Tomt: 2." },
  sampleSize: { label: "Sample", min: 0, max: 10000, integer: true, modes: ["verify"], hint: "Rader å sammenligne med Storage, 0 til 10000. Tomt: 200." },
};

/** The value to send, null for oed's default, or undefined when it is not a valid number. */
const parse = (field: NumberField, raw: string): number | null | undefined => {
  if (raw.trim() === "") return null;
  const rule = fieldRules[field];
  // Accept a decimal comma ("0,5"), as Norwegians write it. Not for whole numbers, where "1,000" would be ambiguous.
  const value = Number(rule.integer ? raw : raw.replace(",", "."));
  if (!Number.isFinite(value) || (rule.integer && !Number.isInteger(value))) return undefined;
  if (field === "ratePerSecond" ? !(value > 0 && value <= 10) : value < rule.min || value > rule.max) return undefined;
  return value;
};

export default function RunsSection({ selectedRunId, initialOpenRunId = "", onShowRun, onCopyInstance }: Props) {
  const queryClient = useQueryClient();
  const [openRunId, setOpenRunId] = React.useState(initialOpenRunId);
  const parsedOpenRunId = parseRunId(openRunId);
  const [mode, setMode] = React.useState<RunMode | "">("");
  const [values, setValues] = React.useState<Record<NumberField, string>>({ limit: "", ratePerSecond: "", maxParallelism: "", sampleSize: "" });
  const [confirming, setConfirming] = React.useState(false);
  const focusOnMount = useFocusOnMount();

  // oed being briefly unavailable throws, so the last good answer stays and polling goes on.
  const active = useQuery({
    queryKey: runQueryKeys.active,
    queryFn: async () => throwIfUnavailable(await getActiveRun(), describeRunProblem),
    refetchInterval: runPollMs,
  });
  const activeRun = active.data?.status === 200 ? active.data.run : null;

  // The last run seen as active. Once it ends it is no longer active, but its report should stay on screen.
  const [lastActiveId, setLastActiveId] = React.useState<string | null>(null);
  if (activeRun && activeRun.id !== lastActiveId) setLastActiveId(activeRun.id);

  // The person's pick wins; otherwise the active run, or the one that just was.
  const shownRunId = selectedRunId ?? activeRun?.id ?? lastActiveId;
  const shown = useQuery({
    queryKey: runQueryKeys.run(shownRunId ?? "none"),
    queryFn: async () => throwIfUnavailable(await getRun(shownRunId!), describeRunProblem),
    enabled: shownRunId !== null,
    refetchInterval: (query) => (isActiveStatus(query.state.data?.run?.status) ? runPollMs : false),
  });

  // When the shown run ends, read what depends on it again rather than wait for the next poll (or none: the items stop
  // polling once the run is finished).
  const shownRun = shown.data?.run ?? null;
  const previous = React.useRef<{ id: string; status: string } | null>(null);
  React.useEffect(() => {
    const before = previous.current;
    previous.current = shownRun ? { id: shownRun.id, status: shownRun.status } : null;
    if (shownRun && before?.id === shownRun.id && isActiveStatus(before.status) && !isActiveStatus(shownRun.status)) {
      void queryClient.invalidateQueries({ queryKey: runQueryKeys.allItems(shownRun.id) });
      void queryClient.invalidateQueries({ queryKey: runQueryKeys.latestVerify });
      void queryClient.invalidateQueries({ queryKey: runQueryKeys.active });
    }
  }, [shownRun, queryClient]);

  const start = useMutation({
    mutationFn: startRun,
    // A start is never repeated behind the person's back.
    retry: false,
    onSuccess: (result) => {
      if (result.run) {
        queryClient.setQueryData(runQueryKeys.run(result.run.id), result);
        onShowRun(result.run.id);
      }
      void queryClient.invalidateQueries({ queryKey: runQueryKeys.active });
    },
  });

  const parsed = Object.fromEntries(
    (Object.keys(fieldRules) as NumberField[]).map((field) => [
      field,
      mode !== "" && fieldRules[field].modes.includes(mode) ? parse(field, values[field]) : null,
    ]),
  ) as Record<NumberField, number | null | undefined>;
  const invalid = (Object.keys(parsed) as NumberField[]).filter((field) => parsed[field] === undefined);
  const request: RunStart | null =
    mode !== "" && invalid.length === 0
      ? {
          mode,
          limit: parsed.limit ?? null,
          ratePerSecond: parsed.ratePerSecond ?? null,
          maxParallelism: parsed.maxParallelism ?? null,
          sampleSize: parsed.sampleSize ?? null,
        }
      : null;

  const runActive = activeRun !== null;

  return (
    <section aria-labelledby="runs-heading">
      <Heading level={2} data-size="md" id="runs-heading">
        Kjøringer
      </Heading>
      <Paragraph>
        En sweep kopierer alle dødsbo som mangler rad, med oed sin struping. En verify sjekker at alle er kopiert og like,
        og avgjør om fasen kan settes til Database. Bare én kjøring kan være aktiv om gangen.
      </Paragraph>

      {active.error && <ValidationMessage>Kunne ikke hente aktiv kjøring: {active.error.message}</ValidationMessage>}
      {active.data && active.data.status !== 200 && active.data.status !== 404 && <RunProblem result={active.data} />}
      {activeRun && activeRun.id !== shownRunId && (
        <Alert data-color="info" data-testid="other-active-run">
          En annen kjøring er aktiv: {activeRun.mode} {activeRun.status}.{" "}
          <Button variant="tertiary" data-size="sm" onClick={() => onShowRun(activeRun.id)}>
            Vis den
          </Button>
        </Alert>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (request) setConfirming(true);
        }}
      >
        <Fieldset>
          <Fieldset.Legend>Start en kjøring</Fieldset.Legend>
          <Radio
            name="run-mode"
            value="verify"
            label="Verify"
            description="Leser og sammenligner. Skriver ingen dødsbo-rader."
            checked={mode === "verify"}
            onChange={() => {
              setMode("verify");
              setConfirming(false);
            }}
          />
          <Radio
            name="run-mode"
            value="sweep"
            label="Sweep"
            description="Kopierer dødsbo til databasen. Regel 5 gjelder fra første kopi."
            checked={mode === "sweep"}
            onChange={() => {
              setMode("sweep");
              setConfirming(false);
            }}
          />
          {mode !== "" &&
            (Object.keys(fieldRules) as NumberField[])
              .filter((field) => fieldRules[field].modes.includes(mode))
              .map((field) => (
                <Textfield
                  key={field}
                  label={fieldRules[field].label}
                  description={fieldRules[field].hint}
                  inputMode="decimal"
                  value={values[field]}
                  onChange={(event) => {
                    setValues({ ...values, [field]: event.target.value });
                    setConfirming(false);
                  }}
                  error={parsed[field] === undefined ? "Ugyldig verdi." : undefined}
                />
              ))}
          <Button type="submit" disabled={!request || start.isPending || runActive}>
            Start kjøringen …
          </Button>
          {runActive && <Paragraph data-size="sm">En kjøring er aktiv. Vent på den, eller avbryt den.</Paragraph>}
        </Fieldset>
      </form>

      {confirming && request && (
        <Alert data-color="warning" role="alertdialog" aria-labelledby="run-confirm-heading">
          <Heading level={3} data-size="xs" id="run-confirm-heading">
            Starte en {request.mode}?
          </Heading>
          <Paragraph data-testid="run-consequence">{runConsequence(request)}</Paragraph>
          <div style={{ display: "flex", gap: "var(--ds-size-2)" }}>
            <Button
              ref={focusOnMount}
              data-color="danger"
              onClick={() => {
                setConfirming(false);
                start.mutate(request);
              }}
            >
              Ja, start {request.mode}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Avbryt
            </Button>
          </div>
        </Alert>
      )}

      {start.isPending && <Paragraph>Sender til oed …</Paragraph>}
      {start.error && <ValidationMessage>Kunne ikke starte: {start.error.message}</ValidationMessage>}
      {start.data && isAccepted(start.data) && <Alert data-color="success">Kjøringen er lagt i kø. oed starter den innen omtrent 30 sekunder.</Alert>}
      {start.data && !isAccepted(start.data) && (
        <>
          <RunProblem result={start.data} />
          {start.data.activeRunId && (
            <Button variant="secondary" onClick={() => onShowRun(start.data.activeRunId)}>
              Vis den aktive kjøringen
            </Button>
          )}
        </>
      )}

      {/* oed has no list of runs: a finished one is opened by its id, from its view, oed's log or the issue. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsedOpenRunId) return;
          onShowRun(parsedOpenRunId);
          setOpenRunId("");
        }}
      >
        <Fieldset>
          <Fieldset.Legend>Åpne kjøring</Fieldset.Legend>
          <Textfield
            label="Kjørings-id"
            description="Står i kjøringens visning og i oed sin logg («OED_M migration run … started»)."
            value={openRunId}
            onChange={(event) => setOpenRunId(event.target.value)}
            error={openRunId.trim() !== "" && !parsedOpenRunId ? "Ikke en gyldig kjørings-id." : undefined}
          />
          <Button type="submit" variant="secondary" disabled={!parsedOpenRunId}>
            Åpne
          </Button>
        </Fieldset>
      </form>

      {shown.error && (
        <ValidationMessage data-testid="run-fetch-error">
          Kunne ikke hente kjøringen: {shown.error.message}
          {shown.data?.run && isActiveStatus(shown.data.run.status) ? " Viser forrige svar og prøver igjen." : ""}
        </ValidationMessage>
      )}
      {/* Not "status !== 200": a start or cancel puts its 202 answer, with the run, in this cache entry. */}
      {shown.data && !shown.data.run && <RunProblem result={shown.data} />}
      {shown.data?.run && (
        <RunDetails
          key={shown.data.run.id}
          run={shown.data.run}
          onShowRun={onShowRun}
          onCopyInstance={onCopyInstance}
        />
      )}
      {!shownRunId && active.data?.status === 404 && <Paragraph>Ingen kjøring er aktiv.</Paragraph>}
    </section>
  );
}
