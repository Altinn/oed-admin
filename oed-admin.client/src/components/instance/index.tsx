import { Details, Paragraph } from "@digdir/designsystemet-react";
import { CodeIcon, FileJsonIcon } from "@navikt/aksel-icons";
import XmlView from "./XmlView";
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';

interface Props {
  data: {
    instance: unknown,
    instanceData?: string | null,
    // The estate's oed.estate_model row as JSON. Once an estate has one, its oed element in
    // Storage is a frozen copy and is not sent.
    model?: string | null
  };
}

export default function Instance({ data }: Props) {
  return (
    <>
      <Details>
        <Details.Summary>
          <FileJsonIcon />
          Instans
        </Details.Summary>
        <Details.Content data-size="sm">
          <JSONPretty id="json-pretty" data={data?.instance}></JSONPretty>
        </Details.Content>
      </Details>
      <Details>
        <Details.Summary>
          <CodeIcon />
          Data
        </Details.Summary>
        <Details.Content data-size="sm">
          {data?.model ? (
            <>
              <Paragraph data-size="sm">Fra databasen (oed.estate_model).</Paragraph>
              <JSONPretty data={data.model}></JSONPretty>
            </>
          ) : data?.instanceData ? (
            <XmlView xml={data.instanceData} />
          ) : (
            <Paragraph>Ingen data.</Paragraph>
          )}
        </Details.Content>
      </Details>
    </>
  );
}