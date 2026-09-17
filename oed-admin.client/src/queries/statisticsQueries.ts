import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchWithMsal } from "../utils/msalUtils";

// Mirrors CohortDto from GET /api/statistics/estatecompletion. One entry per UTC month the
// estates were opened in; the rates are cohort rates, so an estate opened in July that reaches
// probate in October counts towards July.
export interface EstateCompletionCohort {
  month: string;
  opened: number;
  declarationSubmitted: number;
  probateIssued: number;
  pctDeclarationSubmitted: number;
  pctProbateIssued: number;
}

export interface EstateCompletionResponse {
  cohorts: EstateCompletionCohort[];
}

export const estateCompletionKeys = {
  all: ["estateCompletion"] as const,
};

export const useEstateCompletionQuery = () => {
  return useQuery<EstateCompletionResponse>({
    queryKey: estateCompletionKeys.all,
    queryFn: async () => {
      const response = await fetchWithMsal("/api/statistics/estatecompletion");
      if (!response.ok) {
        throw new Error("Kunne ikke hente statistikk for dødsbo");
      }
      return response.json();
    },
  });
};

// Mirrors GET /api/statistics/estatebacklog. One point per UTC day, ISO week or month, oldest
// first; `ongoing` is the number of estates with a declaration created and no probate issued at
// the end of that period (or as of now, for the current period).
export type BacklogResolution = "Day" | "Week" | "Month";
export type BacklogRange = "30d" | "90d" | "1y" | "all";

export interface EstateBacklogPoint {
  periodStart: string; // yyyy-MM-dd, UTC
  ongoing: number;
}

export interface EstateBacklogResponse {
  points: EstateBacklogPoint[];
}

export const estateBacklogKeys = {
  all: ["estateBacklog"] as const,
  list: (resolution: BacklogResolution, range: BacklogRange) =>
    [...estateBacklogKeys.all, resolution, range] as const,
};

// Start of the selected range at UTC midnight; undefined means "all", which the server starts at
// the earliest declaration.
function rangeStart(range: BacklogRange): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (range === "30d") start.setUTCDate(start.getUTCDate() - 30);
  else if (range === "90d") start.setUTCDate(start.getUTCDate() - 90);
  else start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start.toISOString();
}

export const useEstateBacklogQuery = (resolution: BacklogResolution, range: BacklogRange) => {
  return useQuery<EstateBacklogResponse>({
    queryKey: estateBacklogKeys.list(resolution, range),
    queryFn: async () => {
      const params = new URLSearchParams({ resolution });
      const from = rangeStart(range);
      if (from) params.set("from", from);
      const response = await fetchWithMsal(`/api/statistics/estatebacklog?${params}`);
      if (!response.ok) {
        throw new Error("Kunne ikke hente statistikk for pågående dødsbo");
      }
      return response.json();
    },
    placeholderData: keepPreviousData,
    // The query scans every eligible estate, so avoid re-running it on every toggle/focus.
    staleTime: 5 * 60 * 1000,
  });
};
