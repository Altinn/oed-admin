import { useQuery } from "@tanstack/react-query";
import { Details, Heading, Paragraph, Skeleton, ValidationMessage } from "@digdir/designsystemet-react";
import { FileJsonIcon } from "@navikt/aksel-icons";
import { fetchWithMsal } from "../../utils/msalUtils";
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';

interface Props {
  estateId: string;
  caseId?: string;
}

export default function EstateDaObject({ estateId, caseId }: Props) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["daobject", estateId, caseId],
    queryFn: async () => {
      const response = await fetchWithMsal(`/api/estate/${estateId}/daobject`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ caseId: caseId }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch object");
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
              DA Source Object
      </Heading>
      <Paragraph style={{marginBottom: 'var(--ds-size-5)'}}>
              Her vises nåværende informasjon om dette boet slik det er representert i DA sitt api.
      </Paragraph>

      {isLoading && 
        <Skeleton variant="rectangle" aria-label="Henter DA object" />
      }
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av DA object:
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
              <JSONPretty id="json-pretty" data={data?.daObject}></JSONPretty>
            </pre>
          </Details.Content>
        </Details>
      )}      
    </>
  );
}