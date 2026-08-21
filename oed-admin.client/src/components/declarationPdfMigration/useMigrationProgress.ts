import React from "react";
import { fetchWithMsal } from "../../utils/msalUtils";
import { readSseStream } from "../../utils/sseReader";

export type RunStatus =
  | "Idle"
  | "Running"
  | "Completed"
  | "Cancelled"
  | "Aborted"
  | "Faulted";

export type MigrationFailure = {
  estateId: string;
  reason: string;
  detail: string | null;
  status: number;
};

export type ProgressSnapshot = {
  status: RunStatus;
  startedAt: string | null;
  endedAt: string | null;
  dryRun: boolean;
  overwrite: boolean;
  limit: number | null;
  total: number;
  processed: number;
  outcomes: Record<string, number>;
  failureCount: number;
  failures: MigrationFailure[];
  error: string | null;
};

const progressUrl = "/api/maintenance/declarationpdfmigration/progress";

/**
 * Holds the latest snapshot and the accumulated failure list.
 *
 * The server sends every failure it has on the first snapshot of a connection and only the new
 * ones afterwards, so failures are appended rather than replaced - unless a new run starts on an
 * already-open connection (the server only closes the stream once it observes a non-Running
 * status, so a run ending and the next one starting between two ticks is invisible to it, and its
 * per-connection failure cursor keeps counting into the new run's list). A change in
 * snapshot.startedAt is how the client detects that and drops the stale accumulation instead.
 * failureCount is the authoritative total: on a mismatch the client reconnects once per
 * connection to resynchronise, so a persistent disagreement cannot become a reconnect loop.
 */
export function useMigrationProgress() {
  const [snapshot, setSnapshot] = React.useState<ProgressSnapshot | null>(null);
  const [failures, setFailures] = React.useState<MigrationFailure[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [generation, setGeneration] = React.useState(0);

  // Bumping the generation tears down the current stream and opens a new one. Needed after
  // starting a run, because the server closes the stream as soon as the run is not Running.
  const connect = React.useCallback(() => setGeneration((value) => value + 1), []);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let previousStartedAt: string | null = null;
    let accumulated: MigrationFailure[] = [];
    // Guards the resync reconnect below so a persistent count mismatch cannot loop forever.
    let hasResynced = false;

    const run = async () => {
      try {
        const response = await fetchWithMsal(progressUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Kunne ikke hente status (${response.status})`);
        }

        if (cancelled) {
          return;
        }

        setError(null);
        setFailures([]);

        await readSseStream<ProgressSnapshot>(
          response,
          (payload) => {
            if (cancelled) {
              return;
            }
            setSnapshot(payload);

            if (payload.startedAt !== previousStartedAt) {
              // A new run started on this still-open connection - drop the previous run's
              // accumulated failures rather than merging them with the new run's.
              previousStartedAt = payload.startedAt;
              hasResynced = false;
              accumulated = payload.failures;
            } else if (payload.failures.length > 0) {
              accumulated = [...accumulated, ...payload.failures];
            }
            setFailures(accumulated);

            if (!hasResynced && accumulated.length !== payload.failureCount) {
              hasResynced = true;
              connect();
            }
          },
          controller.signal,
        );
      } catch (streamError) {
        if (!cancelled && !controller.signal.aborted) {
          setError(streamError instanceof Error ? streamError.message : String(streamError));
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [generation, connect]);

  return { snapshot, failures, error, connect };
}
