import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchWithMsal } from "../utils/msalUtils";
import { rangeParams, type DayRange } from "../components/statistics/statsFormat";

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

// Mirrors MonthEventsDto: what happened in each UTC month, each event counted in its own month
// whenever the estate was opened.
export interface EstateCompletionMonth {
  month: string;
  opened: number;
  declarationsSubmitted: number;
  probatesIssued: number;
}

export interface EstateCompletionResponse {
  cohorts: EstateCompletionCohort[];
  months: EstateCompletionMonth[];
}

export const estateCompletionKeys = {
  all: ["estateCompletion"] as const,
  list: (range: DayRange) => [...estateCompletionKeys.all, range.from, range.to] as const,
};

export const useEstateCompletionQuery = (range: DayRange) => {
  return useQuery<EstateCompletionResponse>({
    queryKey: estateCompletionKeys.list(range),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await fetchWithMsal(`/api/statistics/estatecompletion?${rangeParams(range)}`);
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
export type BacklogRange = "30d" | "90d" | "1y" | "sep27" | "all" | "custom";

export interface EstateBacklogPoint {
  periodStart: string; // yyyy-MM-dd, UTC
  ongoing: number;
}

export interface EstateBacklogResponse {
  points: EstateBacklogPoint[];
}

export const estateBacklogKeys = {
  all: ["estateBacklog"] as const,
  list: (resolution: BacklogResolution, range: BacklogRange, custom: DayRange) =>
    [...estateBacklogKeys.all, resolution, range, ...(range === "custom" ? [custom.from, custom.to] : [])] as const,
};

// Start of the selected range at UTC midnight; undefined means "all", which the server starts at
// the earliest declaration.
function rangeStart(range: Exclude<BacklogRange, "custom">): string | undefined {
  if (range === "all") return undefined;
  // The day before the "Ett skjema pr arving" release, so the chart shows the backlog either side of it.
  if (range === "sep27") return "2026-09-27T00:00:00.000Z";
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (range === "30d") start.setUTCDate(start.getUTCDate() - 30);
  else if (range === "90d") start.setUTCDate(start.getUTCDate() - 90);
  else start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start.toISOString();
}

// Mirrors GET /api/statistics/estatecreated. One entry per UTC day, oldest first, with no gaps;
// the last entry is today and is a partial day.
export interface EstateCreatedDay {
  day: string; // yyyy-MM-dd, UTC
  created: number;
}

export interface EstateCreatedResponse {
  days: EstateCreatedDay[];
}

export const estateCreatedKeys = {
  all: ["estateCreated"] as const,
  list: (range: DayRange) => [...estateCreatedKeys.all, range.from, range.to] as const,
};

// Takes whole UTC days, both ends inclusive, rather than timestamps.
export const useEstateCreatedQuery = (range: DayRange) => {
  return useQuery<EstateCreatedResponse>({
    queryKey: estateCreatedKeys.list(range),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const response = await fetchWithMsal(`/api/statistics/estatecreated?${params}`);
      if (!response.ok) {
        throw new Error("Kunne ikke hente statistikk for opprettede dødsbo");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useEstateBacklogQuery =(resolution: BacklogResolution, range: BacklogRange, custom: DayRange) => {
  return useQuery<EstateBacklogResponse>({
    queryKey: estateBacklogKeys.list(resolution, range, custom),
    queryFn: async () => {
      const params = new URLSearchParams({ resolution });
      if (range === "custom") {
        rangeParams(custom).forEach((value, key) => params.set(key, value));
      } else {
        const from = rangeStart(range);
        if (from) params.set("from", from);
      }
      const response = await fetchWithMsal(`/api/statistics/estatebacklog?${params}`);
      if (!response.ok) {
        throw new Error("Kunne ikke hente statistikk for åpne skifteerklæringer");
      }
      return response.json();
    },
    placeholderData: keepPreviousData,
    // The query scans every eligible estate, so avoid re-running it on every toggle/focus.
    staleTime: 5 * 60 * 1000,
  });
};

// The remaining statistics endpoints take an optional period and scan every estate in it, so they
// share a fetch helper and a five-minute staleTime.
async function fetchStatistics<T>(path: string, errorMessage: string, range?: DayRange): Promise<T> {
  const response = await fetchWithMsal(`/api/statistics/${path}${range ? `?${rangeParams(range)}` : ""}`);
  if (!response.ok) {
    throw new Error(errorMessage);
  }
  return response.json();
}

const STATISTICS_STALE_TIME = 5 * 60 * 1000;

// Mirrors GET /api/statistics/estateleadtimes. Durations in days; null when no estate has reached
// both ends of the measure.
export type LeadTimeMeasure =
  | "deathToCreated"
  | "createdToFirstHeir"
  | "declarationDuration"
  | "createdToDeclarationSubmitted"
  | "declarationSubmittedToProbate"
  | "createdToProbate";

export interface LeadTime {
  measure: LeadTimeMeasure;
  count: number;
  meanDays: number | null;
  medianDays: number | null;
  p75Days: number | null;
}

export interface LeadTimeMonth {
  month: string; // yyyy-MM, UTC
  estates: number;
  measures: LeadTime[];
}

// How many estates took each whole number of days; days with no estates are left out.
export interface LeadTimeDistribution {
  measure: LeadTimeMeasure;
  days: { days: number; count: number }[];
}

export interface EstateLeadTimesResponse {
  overall: LeadTime[];
  months: LeadTimeMonth[];
  distributions: LeadTimeDistribution[];
}

export const estateLeadTimesKeys = {
  all: ["estateLeadTimes"] as const,
  list: (range: DayRange) => [...estateLeadTimesKeys.all, range.from, range.to] as const,
};

export const useEstateLeadTimesQuery = (range: DayRange) =>
  useQuery<EstateLeadTimesResponse>({
    queryKey: estateLeadTimesKeys.list(range),
    placeholderData: keepPreviousData,
    queryFn: () => fetchStatistics("estateleadtimes", "Kunne ikke hente behandlingstider", range),
    staleTime: STATISTICS_STALE_TIME,
  });

// Mirrors GET /api/statistics/probatedeadlines. Open estates by distance to their probate
// deadline, plus the deadlines falling in each of the coming ISO weeks.
export type DeadlineBucket =
  | "overdueMoreThan30"
  | "overdue"
  | "within7"
  | "within30"
  | "within90"
  | "later"
  | "noDeadline";

export interface ProbateDeadlinesResponse {
  buckets: { bucket: DeadlineBucket; count: number }[];
  weeks: { weekStart: string; count: number }[]; // weekStart: yyyy-MM-dd, a Monday
}

export const probateDeadlinesKeys = { all: ["probateDeadlines"] as const };

export const useProbateDeadlinesQuery = () =>
  useQuery<ProbateDeadlinesResponse>({
    queryKey: probateDeadlinesKeys.all,
    queryFn: () => fetchStatistics("probatedeadlines", "Kunne ikke hente frister"),
    staleTime: STATISTICS_STALE_TIME,
  });

// Mirrors GET /api/statistics/estateoutcomes. Per monthly cohort; `results` splits the estates
// that are neither cancelled nor misposted by ProbateResult, null meaning no result yet.
export interface OutcomeMonth {
  month: string; // yyyy-MM, UTC
  total: number;
  cancelled: number;
  misposted: number;
  results: { result: string | null; count: number }[];
}

export interface EstateOutcomesResponse {
  months: OutcomeMonth[];
}

export const estateOutcomesKeys = {
  all: ["estateOutcomes"] as const,
  list: (range: DayRange) => [...estateOutcomesKeys.all, range.from, range.to] as const,
};

export const useEstateOutcomesQuery = (range: DayRange) =>
  useQuery<EstateOutcomesResponse>({
    queryKey: estateOutcomesKeys.list(range),
    placeholderData: keepPreviousData,
    queryFn: () => fetchStatistics("estateoutcomes", "Kunne ikke hente utfall", range),
    staleTime: STATISTICS_STALE_TIME,
  });
