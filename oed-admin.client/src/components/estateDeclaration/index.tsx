import { useQuery } from "@tanstack/react-query";
import Instance from "../instance";
import { Heading, Skeleton, ValidationMessage } from "@digdir/designsystemet-react";
import { fetchWithMsal } from "../../utils/msalUtils";

interface Props {
  estateId: string;
}

export default function EstateDeclaration({ estateId }: Props) {
    const { data, isLoading, error } = useQuery({
    queryKey: ["declarationinstance", estateId],
    queryFn: async () => {
      const response = await fetchWithMsal(`/api/estate/${estateId}/declarationinstance`);
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
        Skifteerklæring
      </Heading>
      {isLoading && 
        <Skeleton variant="rectangle" aria-label="Henter skifteerklæring" />
      }
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av skifteerklæring:
          {error.message}
        </ValidationMessage>
      )}

      {data && (
        <Instance data={data} />
      )}      
    </>
  );
}