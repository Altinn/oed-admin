import React from "react";
import { fetchWithMsal } from "../../utils/msalUtils";
import { readSseStream } from "../../utils/sseReader";

export type RunStatus = "Idle" | "Running" | "Completed" | "Cancelled" | "Faulted";

export type EstateMatch = {
  estateId: string;
  caseNumber: string | null;
  // Every heir role on this estate - the groups it appears in. Empty when the count is not
  // grouped, or when no heir has a role.
  heirRoles: string[];
};

export type EstateCountFailure = {
  estateId: string;
  reason: string;
  detail: string | null;
};

export type EstateCountFilters = {
  createdFrom: string;
  createdTo: string;
  caseStatuses: string[];
  groupByHeirRoles: boolean;
};

export type EstateCountSnapshot = {
  status: RunStatus;
  startedAt: string | null;
  endedAt: string | null;
  startedBy: string | null;
  filters: EstateCountFilters | null;
  total: number;
  processed: number;
  matchCount: number;
  failureCount: number;
  // Hits per heir role that occurs; empty when not grouped. Does not add up to matchCount: an
  // estate counts towards each of its roles, matchCount counts distinct estates.
  heirRoleCounts: Record<string, number>;
  matches: EstateMatch[];
  failures: EstateCountFailure[];
  error: string | null;
};

const progressUrl = "/api/maintenance/estatecount/progress";

/**
 * Holds the latest snapshot and the accumulated match and failure lists.
 *
 * Same protocol as useMigrationProgress: the server sends every match and failure on the first
 * snapshot of a connection and only the new ones afterwards, so both lists are appended - unless
 * snapshot.startedAt changes, which means a new count started on this still-open connection and
 * the previous count's lists must be dropped. matchCount and failureCount are authoritative: on
 * a mismatch the client reconnects once per connection to resynchronise.
 */
export function useEstateCountProgress() {
  const [snapshot, setSnapshot] = React.useState<EstateCountSnapshot | null>(null);
  const [matches, setMatches] = React.useState<EstateMatch[]>([]);
  const [failures, setFailures] = React.useState<EstateCountFailure[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [generation, setGeneration] = React.useState(0);

  // Bumping the generation tears down the current stream and opens a new one. Needed after
  // starting a count, because the server closes the stream as soon as the count is not Running.
  const connect = React.useCallback(() => setGeneration((value) => value + 1), []);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let isFirst = true;
    let previousStartedAt: string | null = null;
    let accumulatedMatches: EstateMatch[] = [];
    let accumulatedFailures: EstateCountFailure[] = [];
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

        await readSseStream<EstateCountSnapshot>(
          response,
          (payload) => {
            if (cancelled) {
              return;
            }
            setSnapshot(payload);

            if (isFirst || payload.startedAt !== previousStartedAt) {
              // First snapshot on this connection, or a new count started on it: the payload
              // carries the complete lists, so replace rather than append.
              isFirst = false;
              previousStartedAt = payload.startedAt;
              hasResynced = false;
              accumulatedMatches = payload.matches;
              accumulatedFailures = payload.failures;
            } else {
              if (payload.matches.length > 0) {
                accumulatedMatches = [...accumulatedMatches, ...payload.matches];
              }
              if (payload.failures.length > 0) {
                accumulatedFailures = [...accumulatedFailures, ...payload.failures];
              }
            }
            setMatches(accumulatedMatches);
            setFailures(accumulatedFailures);

            if (
              !hasResynced &&
              (accumulatedMatches.length !== payload.matchCount ||
                accumulatedFailures.length !== payload.failureCount)
            ) {
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

  return { snapshot, matches, failures, error, connect };
}
