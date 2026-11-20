import { useQuery } from "@tanstack/react-query";
import { Button, Paragraph, Tag, ValidationMessage } from "@digdir/designsystemet-react";
import { formatDateTime } from "../../utils/formatters";
import { getLatestVerifyRun, runPollMs, runQueryKeys } from "./api";

interface Props {
  onShowRun?: (runId: string) => void;
}

/**
 * The latest finished verify and its `ready`, next to the phase: oed allows `Database` only after a ready verify under
 * an hour old (Altinn/oed#1923 §4.3).
 */
export default function LatestVerify({ onShowRun }: Props) {
  const { data, error } = useQuery({
    queryKey: runQueryKeys.latestVerify,
    queryFn: getLatestVerifyRun,
    refetchInterval: runPollMs * 4,
  });

  if (error) return <ValidationMessage>Kunne ikke hente siste verify: {error.message}</ValidationMessage>;
  if (!data) return null;

  if (data.status === 404 || (data.status === 200 && !data.run)) {
    return <Paragraph data-testid="latest-verify">Siste verify: ingen er fullført ennå.</Paragraph>;
  }
  if (!data.run) {
    return <Paragraph data-testid="latest-verify">Siste verify: kunne ikke leses (oed svarte {data.status}).</Paragraph>;
  }

  const run = data.run;
  return (
    <Paragraph data-testid="latest-verify">
      Siste verify: {run.status}
      {run.finished ? `, ferdig ${formatDateTime(run.finished, true)}` : ""}. Ready:{" "}
      <Tag data-color={run.ready ? "success" : "danger"}>{run.ready ? "ja" : "nei"}</Tag>
      {onShowRun && (
        <>
          {" "}
          <Button variant="tertiary" data-size="sm" onClick={() => onShowRun(run.id)}>
            Vis rapporten
          </Button>
        </>
      )}
    </Paragraph>
  );
}
