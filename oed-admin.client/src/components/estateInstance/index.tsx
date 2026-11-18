import { useQuery } from "@tanstack/react-query";
import Instance from "../instance";
import { Heading, Link as DsLink, Paragraph, Skeleton, ValidationMessage } from "@digdir/designsystemet-react";
import { Link } from "react-router-dom";
import { fetchWithMsal } from "../../utils/msalUtils";

interface Props {
  estateId: string;
  instanceId?: string | null;
}

export default function EstateInstance({ estateId, instanceId }: Props) {
    const { data, isLoading, error } = useQuery({
    queryKey: ["instance", estateId],
    queryFn: async () => {
      const response = await fetchWithMsal(`/api/estate/${estateId}/instance`);
      if (!response.ok) {
        throw new Error("Failed to fetch instance");
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
        Oed instans
      </Heading>
      {instanceId && (
        <Paragraph data-size="sm">
          <DsLink asChild>
            <Link to={`/maintenance/oedmodel?instanceId=${encodeURIComponent(instanceId)}`}>
              Kopier OED_M for denne instansen til databasen …
            </Link>
          </DsLink>
        </Paragraph>
      )}
      {isLoading && 
        <Skeleton variant="rectangle" aria-label="Henter instans" />
      }
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av instans:
          {error.message}
        </ValidationMessage>
      )}

      {data && (
        <Instance data={data} />
      )}      
    </>    
  );
}