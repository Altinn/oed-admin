import { useQuery } from "@tanstack/react-query";
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
