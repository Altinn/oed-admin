import type { OptionValue } from "../../queries/estateCountQueries";
import type { EstateCountFailure, EstateCountSnapshot, EstateMatch } from "./useEstateCountProgress";

// Norwegian Excel uses comma as the decimal separator and only splits CSV on semicolons. The BOM
// makes it read the file as UTF-8, so æøå survive.
const separator = ";";
const bom = "﻿";

// Quotes a field when it contains a separator, quote or line break, and defuses values Excel
// would otherwise evaluate as a formula (CSV injection) by prefixing an apostrophe.
const field = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const row = (values: string[]) => values.map(field).join(separator);

// "2026-10-28T13:14:15Z" -> "2026-10-28T1314", in the browser's time zone.
const fileTimestamp = (iso: string | null) => {
  const date = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}`;
};

export const csvFileName = (snapshot: EstateCountSnapshot) => {
  const filters = snapshot.filters;
  const parts = ["telling-dodsbo"];
  if (filters) {
    parts.push(filters.createdFrom, filters.createdTo);
    if (filters.caseStatuses.length > 0) parts.push(`status-${filters.caseStatuses.join("+")}`);
    if (filters.groupByHeirRoles) parts.push("gruppert");
  }
  parts.push(`kjort-${fileTimestamp(snapshot.startedAt)}`);
  return `${parts.join("_")}.csv`;
};

/**
 * One row per estate: the hits (already sorted by case number) followed by the estates that
 * could not be checked. A grouped count gets one column per heir role that occurs, sorted by
 * label, with "x" where the estate has a heir with that role - so Excel's filter can answer
 * "estates with at least one of these roles", which the per-role counts on the page cannot.
 */
export const buildCsv = (
  snapshot: EstateCountSnapshot,
  sortedMatches: EstateMatch[],
  failures: EstateCountFailure[],
  heirRoleOptions: OptionValue[] | undefined,
) => {
  const grouped = snapshot.filters?.groupByHeirRoles ?? false;
  const roleColumns = grouped
    ? Object.keys(snapshot.heirRoleCounts)
        .map((role) => ({
          role,
          // A role missing from the options list keeps its raw value as the header.
          label: heirRoleOptions?.find((option) => option.value === role)?.label ?? role,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "nb"))
    : [];

  const lines = [
    row(["Saksnummer", "Dødsbo-ID", "Status", "Detaljer", ...roleColumns.map((column) => column.label)]),
    ...sortedMatches.map((match) =>
      row([
        match.caseNumber ?? "",
        match.estateId,
        "OK",
        "",
        ...roleColumns.map((column) => (match.heirRoles.includes(column.role) ? "x" : "")),
      ]),
    ),
    ...failures.map((failure) =>
      row([
        "",
        failure.estateId,
        `Kunne ikke sjekkes: ${failure.reason}`,
        failure.detail ?? "",
        ...roleColumns.map(() => ""),
      ]),
    ),
  ];

  // CRLF is what Excel writes and expects.
  return bom + lines.join("\r\n") + "\r\n";
};

export const downloadCsv = (fileName: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Deferred: revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
