import { useQuery } from "@tanstack/react-query";
import { Details, Heading, Paragraph, Skeleton, ValidationMessage } from "@digdir/designsystemet-react";
import { FileJsonIcon } from "@navikt/aksel-icons";
import { fetchWithMsal } from "../../utils/msalUtils";
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';

interface Props {
  estateId: string;
}

export default function EstateProbateInformation({ estateId }: Props) {
  //const { data, isLoading, error } = useQuery({
  //  queryKey: ["probateinformation", estateId],
  //  queryFn: async () => {
  //    const response = await fetchWithMsal(`/api/estate/${estateId}/probateinformation`);
  //    if (!response.ok) {
  //      throw new Error("Failed to fetch instance");
  //    }
  //    return response.json();
  //  },
  //});

  function DataDetails({version}: {version: number}) {
      const { data, isLoading, error } = useQuery({
          queryKey: ["probateinformationq", estateId, version],
          queryFn: async () => {
              const response = await fetchWithMsal(`/api/estate/${estateId}/probateinformation?version=${version}`);
              if (!response.ok) {
                  throw new Error(`Failed to fetch instance version ${version}`);
              }
              return response.json();
          },
      });

      if (isLoading) return <Skeleton variant="rectangle" aria-label={`Henter probateinformation version ${version}`} />;

      if (error) return (
        <ValidationMessage>
          Det oppstod en feil under henting av probateinformation:
          {error.message}
        </ValidationMessage>
      )

      if (data) return (
        <Details>
          <Details.Summary>
              <FileJsonIcon />
                  Data v{version}
          </Details.Summary>
          <Details.Content data-size="sm">
              <JSONPretty id="json-pretty" data={data?.probateInformation}></JSONPretty>
          </Details.Content>
        </Details>
      );
  }

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

      <>
        <DataDetails version={1} />
        <DataDetails version={2} />
      </>
    </>
  );
}