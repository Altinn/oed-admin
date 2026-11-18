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
