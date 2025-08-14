import { useQuery } from "@tanstack/react-query";
import { Details, Heading, Paragraph, Skeleton, ValidationMessage } from "@digdir/designsystemet-react";
import { FileJsonIcon } from "@navikt/aksel-icons";

interface Props {
  estateId: string;
}

export default function EstateProbateInformation({ estateId }: Props) {
    const { data, isLoading, error } = useQuery({
    queryKey: ["probateinformation", estateId],
    queryFn: async () => {
      const response = await fetch(`/api/estate/${estateId}/probateinformation`);
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
        ProbateInformation
      </Heading>
      <Paragraph style={{marginBottom: 'var(--ds-size-5)'}}>
        Her vises informasjon fra skifteerklæringen slik den presenters til DA / Tingretten
      </Paragraph>

      {isLoading && 
        <Skeleton variant="rectangle" aria-label="Henter probateinformation" />
      }
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av probateinformation:
          {error.message}
        </ValidationMessage>
      )}

      {data && (
        <Details>
          <Details.Summary>
            <FileJsonIcon />
            Data
          </Details.Summary>
          <Details.Content data-size="sm">
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {JSON.stringify(data?.probateInformation, null, 2)}
            </pre>
          </Details.Content>
        </Details>
      )}      
    </>
  );
}