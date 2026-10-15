import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Heading,
  List,
  Paragraph,
  Skeleton,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { fetchWithMsal, hasRole } from "../../utils/msalUtils";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo } from "@azure/msal-browser";
import { GavelSoundBlockIcon } from "@navikt/aksel-icons";
import { Bar } from "../statistics/panels";
import { formatCount, numCellStyle } from "../statistics/statsFormat";

interface DistrictCourtSummaryResponse {
  districtCourtName: string;
  numberOfCases?: number;
}

// Same layout as the week list on Statistikk → Frister: name, bar scaled to the busiest court, count.
function CaseCountBars({ courts }: { courts: DistrictCourtSummaryResponse[] }) {
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
    <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--ds-size-2)" }}>
      {courts.map((court) => (
        <li key={court.districtCourtName} style={rowStyle}>
          <span>{court.districtCourtName}</span>
          <Bar fraction={max === 0 ? 0 : (court.numberOfCases ?? 0) / max} />
          <strong style={numCellStyle}>{formatCount(court.numberOfCases ?? 0)}</strong>
        </li>
      ))}
      <li style={{ ...rowStyle, marginTop: "var(--ds-size-4)" }}>
        <strong>Totalt antall saker</strong>
        <span />
        <strong style={numCellStyle}>{formatCount(total)}</strong>
      </li>
    </ol>
  );
}

export default function DistrictCourts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["districtCourts"],
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
