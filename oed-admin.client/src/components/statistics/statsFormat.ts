// Colours and number/date formatting shared by the statistics tabs. JSX-free so it can sit next to
// the panel components without tripping react-refresh's components-only rule.

export const ACCENT = "var(--ds-color-accent-base-default)";
export const TRACK = "var(--ds-color-neutral-background-tinted)";
export const MUTED = "var(--ds-color-neutral-text-subtle)";
export const WARNING = "var(--ds-color-warning-base-default)";
export const DANGER = "var(--ds-color-danger-base-default)";

// Darker at the baseline, lighter at the value end.
const shade = (color: string) => ({
  lo: `color-mix(in srgb, ${color} 75%, black)`,
  hi: `color-mix(in srgb, ${color} 65%, white)`,
});
export const gradient = (direction: "to right" | "to top", color = ACCENT) =>
  `linear-gradient(${direction}, ${shade(color).lo}, ${shade(color).hi})`;

const MONTH_FORMAT = new Intl.DateTimeFormat("nb-NO", { month: "short", year: "numeric", timeZone: "UTC" });
const DAY_FORMAT = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", timeZone: "UTC" });

export const formatCount = (value: number) => value.toLocaleString("nb-NO");

export const formatDecimal = (value: number) =>
  value.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatPercent = (value: number) => `${formatDecimal(value)} %`;

/** Days, or a dash when there is nothing to measure. */
export const formatDays = (value: number | null) => (value === null ? "–" : formatDecimal(value));

/** "okt. 2026" from "2026-10". */
export const formatMonth = (month: string) => MONTH_FORMAT.format(new Date(`${month}-01T00:00:00Z`));

/** "12. okt." from "2026-10-12". */
export const formatDay = (day: string) => DAY_FORMAT.format(new Date(`${day}T00:00:00Z`));

/** ISO 8601 week number of a yyyy-MM-dd UTC date (the week containing the Thursday decides the year). */
export function isoWeek(day: string): number {
  const thursday = new Date(`${day}T00:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/**
 * Monthly cohorts are counted by the month the estate was opened, so the newest ones have not had
 * time to reach the later steps. The statistics tabs mark this many trailing months as provisional.
 */
export const PROVISIONAL_MONTHS = 3;

export const numCellStyle ={ textAlign: "right", fontVariantNumeric: "tabular-nums" } as const;
