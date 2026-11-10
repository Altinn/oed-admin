import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Heading,
  List,
  Paragraph,
  Skeleton,
  ToggleGroup,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { fetchWithMsal, hasRole } from "../../utils/msalUtils";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo } from "@azure/msal-browser";
import { GavelSoundBlockIcon } from "@navikt/aksel-icons";
import { Bar } from "../statistics/panels";
import { formatCount, numCellStyle } from "../statistics/statsFormat";

// Number of district courts (tingretter) in Norway.
const totalDistrictCourts = 28;

interface DistrictCourtSummaryResponse {
  districtCourtName: string;
  numberOfCases?: number;
}

type CourtSortOrder = "count" | "name";

// Drops the "tingrett" suffix, and for the bilingual Sámi court keeps only the Norwegian part after " - ".
// The full name stays available as a tooltip.
const shortCourtName = (name: string) =>
  (name.split(" - ").at(-1) ?? name).replace(/ tingrett$/i, "");

const byName = (a: DistrictCourtSummaryResponse, b: DistrictCourtSummaryResponse) =>
  shortCourtName(a.districtCourtName).localeCompare(shortCourtName(b.districtCourtName), "nb");

const byCountThenName = (a: DistrictCourtSummaryResponse, b: DistrictCourtSummaryResponse) =>
  (b.numberOfCases ?? 0) - (a.numberOfCases ?? 0) || byName(a, b);

// Copies before sorting so the query cache's array is left untouched.
const sortCourts = (courts: DistrictCourtSummaryResponse[], order: CourtSortOrder) =>
  [...courts].sort(order === "count" ? byCountThenName : byName);

// Same layout as the week list on Statistikk → Frister: name, bar scaled to the busiest court, count.
function CaseCountBars({ courts }: { courts: DistrictCourtSummaryResponse[] }) {
  const [sortOrder, setSortOrder] = useState<CourtSortOrder>("count");
  const sortedCourts = sortCourts(courts, sortOrder);
  const counts = courts.map((court) => court.numberOfCases ?? 0);
  const max = Math.max(0, ...counts);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const rowStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(10rem, 16rem) 1fr 3.5rem",
    alignItems: "center",
    gap: "var(--ds-size-2)",
  } as const;

  return (
    <>
      <ToggleGroup
        data-size="sm"
        data-toggle-group="Sortering"
        value={sortOrder}
        onChange={(value) => setSortOrder(value as CourtSortOrder)}
        style={{ marginBottom: "var(--ds-size-3)" }}
      >
        <ToggleGroup.Item value="count">Antall</ToggleGroup.Item>
        <ToggleGroup.Item value="name">Navn</ToggleGroup.Item>
      </ToggleGroup>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--ds-size-2)" }}>
        {sortedCourts.map((court) => (
          <li key={court.districtCourtName} style={rowStyle}>
            <span title={court.districtCourtName}>{shortCourtName(court.districtCourtName)}</span>
            <Bar fraction={max === 0 ? 0 : (court.numberOfCases ?? 0) / max} />
            <strong style={numCellStyle}>{formatCount(court.numberOfCases ?? 0)}</strong>
          </li>
        ))}
        <li style={{ ...rowStyle, marginTop: "var(--ds-size-4)" }}>
          <strong>Totalt antall saker</strong>
          <span />
          <strong style={numCellStyle}>{formatCount(total)}</strong>
        </li>
        {/* "x av 28" is wider than the count column, so this row sizes its last column to the content. */}
        <li style={{ ...rowStyle, gridTemplateColumns: "minmax(10rem, 16rem) 1fr auto" }}>
          <strong>Totalt antall tingretter</strong>
          <span />
          <strong style={{ ...numCellStyle, whiteSpace: "nowrap" }}>{`${formatCount(courts.length)} av ${totalDistrictCourts}`}</strong>
        </li>
      </ol>
    </>
  );
}

export default function DistrictCourts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["districtCourts"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await fetchWithMsal("/api/districtcourts");
      if (!response.ok) {
        throw new Error("Failed to fetch district courts");
      }
      return response.json();
    },
  });
  const { instance } = useMsal();
  const account = instance.getActiveAccount() as AccountInfo;
  const isAdmin = hasRole(account, "Admin");

  return (
    <>
      <Heading
        level={2}
        data-size="sm"
        style={{ marginBottom: "var(--ds-size-2)" }}
      >
        Tingretter
      </Heading>
      {isLoading && (
        <Skeleton variant="rectangle" aria-label="Henter tingretter" />
      )}
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av tingretter:
          {error.message}
        </ValidationMessage>
      )}

      {data?.connectedDistrictCourts && (
        <Paragraph style={{ marginBottom: "var(--ds-size-3)" }}>
          {/* Read users get no case counts, so their line counts courts instead. */}
          {isAdmin
            ? "Antall bo per tingrett"
            : `${data.connectedDistrictCourts.length} tingretter er koblet til Digitalt dødsbo.`}
        </Paragraph>
      )}

      {/* Admins get case counts and see them as bars; Read users get the names only. */}
      {data?.connectedDistrictCourts && isAdmin && (
        <CaseCountBars courts={data.connectedDistrictCourts} />
      )}

      {data?.connectedDistrictCourts && !isAdmin && (
        // The gavel replaces the bullet, matching the icon on the tab.
        <List.Unordered data-size="md" style={{ listStyle: "none", paddingLeft: 0 }}>
          {data.connectedDistrictCourts?.map(
            (court: DistrictCourtSummaryResponse) => (
              <List.Item key={court.districtCourtName} className="flex-row">
                <GavelSoundBlockIcon aria-hidden />
                {court.districtCourtName}
              </List.Item>
            ),
          )}
          {isAdmin && (
            <List.Item
              data-size="lg"
              className="flex-row"
              style={{ marginTop: "var(--ds-size-8)" }}
            >
              Totalt antall saker:{" "}
              <Badge
                count={data.connectedDistrictCourts?.reduce(
                  (total: number, court: DistrictCourtSummaryResponse) =>
                    total + (court.numberOfCases || 0),
                  0,
                )}
              />
            </List.Item>
          )}
        </List.Unordered>
      )}
    </>
  );
}
