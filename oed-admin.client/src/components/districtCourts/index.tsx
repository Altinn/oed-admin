import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Heading,
  List,
  Skeleton,
  ValidationMessage,
} from "@digdir/designsystemet-react";
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
      {isLoading && (
        <Skeleton variant="rectangle" aria-label="Henter tingretter" />
      )}
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av tingretter:
          {error.message}
        </ValidationMessage>
      )}

      {data && (
        <List.Unordered data-size="md">
          {data.map((court: DistrictCourtSummaryResponse) => (
            <List.Item key={court.districtCourtName} className="flex-row">
              {court.districtCourtName}
              <Badge
                data-color="neutral"
                count={court.numberOfCases}
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
            </List.Item>
          ))}
          {isAdmin && (
            <List.Item
              data-size="lg"
              className="flex-row"
              style={{ marginTop: "var(--ds-size-8)" }}
            >
              Totalt antall saker:{" "}
              <Badge
                count={data.reduce(
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
