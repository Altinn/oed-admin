import { useQuery } from "@tanstack/react-query";
import { fetchWithMsal } from "../utils/msalUtils";

// Mirrors OptionValue from GET /api/maintenance/estatecount/options.
export interface OptionValue {
  value: string;
  label: string;
}

export interface EstateCountOptions {
  caseStatuses: OptionValue[];
  heirRoles: OptionValue[];
}

export const estateCountKeys = {
  all: ["estateCount"] as const,
  options: () => [...estateCountKeys.all, "options"] as const,
};

// The options are compiled into the server, so they never go stale within a session.
export const useEstateCountOptionsQuery = () => {
  return useQuery<EstateCountOptions>({
    queryKey: estateCountKeys.options(),
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetchWithMsal("/api/maintenance/estatecount/options");
      if (!response.ok) {
        throw new Error("Kunne ikke hente filtervalg for telling");
      }
      return response.json();
    },
  });
};
