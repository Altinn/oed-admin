import { Details, Paragraph } from "@digdir/designsystemet-react";
import { CodeIcon, FileJsonIcon } from "@navikt/aksel-icons";
import { prettifyXml } from "../../utils/formatters";
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';

interface Props {
  data: {
    instance: unknown,
    instanceData?: string | null
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
          {data?.instanceData ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {prettifyXml(data.instanceData)}
            </pre>
          ) : (
            <Paragraph>Ingen data.</Paragraph>
          )}
        </Details.Content>
      </Details>
    </>
  );
}