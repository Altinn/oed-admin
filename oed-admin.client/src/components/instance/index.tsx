import { Details, Heading } from "@digdir/designsystemet-react";
import { CodeIcon, FileJsonIcon } from "@navikt/aksel-icons";
import { prettifyXml } from "../../utils/formatters";

interface Props {
  data: { 
    instance: unknown, 
    instanceData: string
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
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {JSON.stringify(data?.instance, null, 2)}
          </pre>
        </Details.Content>
      </Details>
      <Details>
        <Details.Summary>
          <CodeIcon />
          Data
        </Details.Summary>
        <Details.Content data-size="sm">          
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {prettifyXml(data?.instanceData)}
          </pre>
        </Details.Content>
      </Details>
    </>
  );
}