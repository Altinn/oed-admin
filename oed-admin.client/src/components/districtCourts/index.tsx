import { useQuery } from "@tanstack/react-query";
import { Heading, Paragraph, Skeleton, ValidationMessage } from "@digdir/designsystemet-react";
import { fetchWithMsal } from "../../utils/msalUtils";

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
          {data.connectedDistrictCourts.map((court: string) => (
            <div key={court}>
              <Paragraph>{court}</Paragraph>
            </div>
          ))}
        </>
      )}
    </>
  );
}