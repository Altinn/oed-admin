import { fetchWithMsal } from "../../utils/msalUtils";

// oed-admin's /api/maintenance/oedmodel endpoints (Altinn/oed#1923). They answer 200 whatever oed said, with oed's own
// status in `status` (0 when oed never answered), so a 403 or 502 from oed is never mistaken for one from oed-admin.

export const phases = ["Storage", "Migrating", "Database"] as const;
export type Phase = (typeof phases)[number];

export interface OedModelPhaseState {
  phase: string;
  reason: string;
  changed: string;
  changedBy: string;
  cachedOnThisPod: string | null;
}

export interface OedAdminProblem {
  title: string | null;
  detail: string | null;
  errors: Record<string, string[]> | null;
}

export interface PhaseResult {
  status: number;
  phase: OedModelPhaseState | null;
  problem: OedAdminProblem | null;
}

export interface OedModelCopy {
  outcome: string;
  failure: string | null;
  failureReason: string | null;
  droppedElements: string[];
  storageLastChanged: string | null;
  created: string | null;
}

export interface CopyResult {
  status: number;
  copy: OedModelCopy | null;
  problem: OedAdminProblem | null;
  retryAfterSeconds: number | null;
}

const baseUrl = "/api/maintenance/oedmodel";

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(
      response.status === 400
        ? "oed-admin avviste forespørselen (400)."
        : `oed-admin svarte ${response.status}.`,
    );
  }
  return (await response.json()) as T;
};

export const phaseQueryKey = ["oedmodel", "phase"] as const;

export const getPhase = async (): Promise<PhaseResult> =>
  readJson<PhaseResult>(await fetchWithMsal(`${baseUrl}/phase`));

export const setPhase = async (phase: Phase, reason: string): Promise<PhaseResult> =>
  readJson<PhaseResult>(
    await fetchWithMsal(`${baseUrl}/phase`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, reason }),
    }),
  );

export const copyEstate = async (partyId: number, instanceGuid: string): Promise<CopyResult> =>
  readJson<CopyResult>(
    await fetchWithMsal(`${baseUrl}/estates/${partyId}/${instanceGuid}/copy`, { method: "POST" }),
  );

const instanceIdPattern =
  /^\s*(\d+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i;

/** `{partyId}/{instanceGuid}`, as Storage and the estate view write it. */
export const parseInstanceId = (
  value: string,
): { partyId: number; instanceGuid: string } | null => {
  const match = instanceIdPattern.exec(value);
  if (!match) return null;
  const partyId = Number(match[1]);
  return partyId > 0 ? { partyId, instanceGuid: match[2].toLowerCase() } : null;
};

// --- Sweep and verify runs (Altinn/oed#1902, #1923 §4.3) ---

export type RunMode = "sweep" | "verify";

export interface RunParameters {
  limit: number | null;
  ratePerSecond: number;
  maxParallelism: number;
  sampleSize: number | null;
}

export interface RunReport {
  outcomes: Record<string, number>;
  failuresByReason: Record<string, number>;
  duplicateOwnerCount: number;
  duplicateOwnerPartyIds: number[];
  databaseCreatedRows: number;
  sampled: number;
  ready: boolean | null;
}

export interface MigrationRun {
  id: string;
  /** "Sweep" or "Verify". */
  mode: string;
  /** Queued, Running, Completed, Cancelled, Failed or Abandoned. */
  status: string;
  requestedBy: string;
  cancelRequestedBy: string | null;
  continuesRunId: string | null;
  created: string;
  started: string | null;
  finished: string | null;
  heartbeat: string | null;
  parameters: RunParameters;
  progress: { listed: number; processed: number; toProcess: number };
  failureReason: string | null;
  ready: boolean | null;
  report: RunReport | null;
}

export interface RunResult {
  status: number;
  run: MigrationRun | null;
  problem: OedAdminProblem | null;
  activeRunId: string | null;
}

export interface RunItem {
  run: {
    instanceGuid: string;
    instanceOwnerPartyId: number;
    outcome: string | null;
    failure: string | null;
    reason: string | null;
    droppedElements: string[];
    storageLastChanged: string | null;
    attempts: number;
    updated: string;
  };
  estateId: string | null;
}

export interface RunItemsResult {
  status: number;
  items: RunItem[] | null;
  page: number | null;
  pageSize: number | null;
  total: number | null;
  problem: OedAdminProblem | null;
}

export interface RunStart {
  mode: RunMode;
  limit: number | null;
  ratePerSecond: number | null;
  maxParallelism: number | null;
  sampleSize: number | null;
}

/** How often an active run is read again. oed's worker writes progress every 15 s. */
export const runPollMs = 15_000;

export const isActiveStatus = (status: string | undefined) => status === "Queued" || status === "Running";

export const runQueryKeys = {
  active: ["oedmodel", "runs", "active"] as const,
  latestVerify: ["oedmodel", "runs", "latest-verify"] as const,
  run: (runId: string) => ["oedmodel", "runs", runId] as const,
  allItems: (runId: string) => ["oedmodel", "runs", runId, "items"] as const,
  items: (runId: string, outcome: string, page: number) => ["oedmodel", "runs", runId, "items", outcome, page] as const,
};

/** The copy mutation's key, so a run's items can tell when a copy is in flight. */
export const copyMutationKey = ["oedmodel", "copy"] as const;

/** oed took the start or cancel: any 2xx that carries the run (oed answers 202 today). */
export const isAccepted = (result: RunResult) => result.status >= 200 && result.status < 300 && result.run !== null;

/** oed was unreachable or failed (0 or 5xx), as opposed to answering. */
export const isOedUnavailable = (status: number) => status === 0 || status >= 500;

/**
 * For a polled GET: throws when oed was unavailable, so TanStack keeps the last good answer and polls again, instead
 * of replacing a running run with an empty result and stopping. Never used for a start or cancel.
 */
export const throwIfUnavailable = (result: RunResult, describe: (status: number) => string): RunResult => {
  if (isOedUnavailable(result.status)) throw new Error(describe(result.status));
  return result;
};

export const getActiveRun = async (): Promise<RunResult> =>
  readJson<RunResult>(await fetchWithMsal(`${baseUrl}/runs/active`));

export const getLatestVerifyRun = async (): Promise<RunResult> =>
  readJson<RunResult>(await fetchWithMsal(`${baseUrl}/runs/latest-verify`));

export const getRun = async (runId: string): Promise<RunResult> =>
  readJson<RunResult>(await fetchWithMsal(`${baseUrl}/runs/${runId}`));

export const startRun = async (start: RunStart): Promise<RunResult> =>
  readJson<RunResult>(
    await fetchWithMsal(`${baseUrl}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(start),
    }),
  );

export const cancelRun = async (runId: string): Promise<RunResult> =>
  readJson<RunResult>(await fetchWithMsal(`${baseUrl}/runs/${runId}/cancel`, { method: "POST" }));

export const runItemsPageSize = 100;

export const getRunItems = async (runId: string, outcome: string, page: number): Promise<RunItemsResult> => {
  // Leave outcome out rather than send it empty: oed refuses `outcome=`.
  const query = new URLSearchParams({ page: String(page), pageSize: String(runItemsPageSize) });
  if (outcome) query.set("outcome", outcome);
  return readJson<RunItemsResult>(await fetchWithMsal(`${baseUrl}/runs/${runId}/items?${query}`));
};

/** The outcome names of each mode, as oed's report lists them (docs/oed-model-migration.md §5.4–5.5). */
export const runOutcomes: Record<string, string[]> = {
  Sweep: ["Copied", "AlreadyMigrated", "SkippedSoftDeleted", "NoOedElement", "InstanceNotFound", "NotAllowed", "Failed", "Busy"],
  Verify: ["Ok", "Missing", "Broken", "Mismatch", "SampleMismatch", "NotLive"],
};

// --- Soft-deleting the estates a sweep can never copy, TT02 only (Altinn/oed#1905) ---

export interface OedModelOrphanSoftDelete {
  /** SoftDeleted, AlreadyDeleted, NotAnOrphan, InstanceNotFound, NotAllowed or StorageError. */
  outcome: string;
  /** With NotAnOrphan: the first rule that failed. With StorageError: the exception type. */
  reason: string | null;
  created: string | null;
  lastChanged: string | null;
}

export interface OrphanSoftDeleteResult {
  status: number;
  result: OedModelOrphanSoftDelete | null;
  problem: OedAdminProblem | null;
  retryAfterSeconds: number | null;
}

export const softDeleteOrphan = async (partyId: number, instanceGuid: string): Promise<OrphanSoftDeleteResult> =>
  readJson<OrphanSoftDeleteResult>(
    await fetchWithMsal(`${baseUrl}/estates/${partyId}/${instanceGuid}/soft-delete-orphan`, { method: "POST" }),
  );

/** Every item of a run with this outcome, page by page. Throws if oed doesn't answer a page: never a short list. */
export const getAllRunItems = async (runId: string, outcome: string): Promise<RunItem[]> => {
  const all: RunItem[] = [];
  for (let page = 1; ; page++) {
    const answer = await getRunItems(runId, outcome, page);
    if (answer.status !== 200 || answer.items === null) {
      throw new Error(`oed svarte ${answer.status} på side ${page} av kjøringens dødsbo.`);
    }
    all.push(...answer.items);
    if (answer.items.length < runItemsPageSize) return all;
  }
};

/** A sweep run's item the sweep could never copy: Failed with NoDeceasedInfo. */
export const isOrphanCandidate = (run: MigrationRun, item: RunItem) =>
  run.mode === "Sweep" && item.run.outcome === "Failed" && item.run.failure === "NoDeceasedInfo";

/** Only against TT02. oed refuses everywhere else as well. */
export const orphanDeleteEnabled = () => import.meta.env.VITE_ENVIRONMENT === "staging";

/** An answer every following call would get too: oed unreachable, oed-admin's token refused, or not TT02. */
export const stopsTheLoop = (answer: OrphanSoftDeleteResult) => [0, 401, 403, 409].includes(answer.status);
