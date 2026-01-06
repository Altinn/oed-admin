import { useQuery } from "@tanstack/react-query";
import { Heading, Paragraph, Skeleton, ValidationMessage } from "@digdir/designsystemet-react";
import { fetchWithMsal, hasRole } from "../../utils/msalUtils";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo } from "@azure/msal-browser";

interface DistrictCourtSummaryResponse {
  districtCourtName: string;
  numberOfCases?: number;
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
      {isLoading &&
        <Skeleton variant="rectangle" aria-label="Henter tingretter" />
      }
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av tingretter:
          {error.message}
        </ValidationMessage>
      )}

      {data && data.connectedDistrictCourts && (
        <>
          {data.connectedDistrictCourts.map((court: DistrictCourtSummaryResponse) => (
            <div key={court.districtCourtName}>
              <Paragraph>{court.districtCourtName}{court.numberOfCases ? ` (${court.numberOfCases})` : null}</Paragraph>
            </div>
          ))}
          <br />
          <Paragraph>
            Totalt antall saker: {data.connectedDistrictCourts.reduce((total: number, court: DistrictCourtSummaryResponse) => total + (court.numberOfCases || 0), 0)}
          </Paragraph>
        </>
      )}
    </>
  );
}