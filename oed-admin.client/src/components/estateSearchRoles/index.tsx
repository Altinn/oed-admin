import { useQuery } from "@tanstack/react-query";
import {
  Details,
  Heading,
  Paragraph,
  Skeleton,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { FileJsonIcon } from "@navikt/aksel-icons";
import { fetchWithMsal } from "../../utils/msalUtils";

interface Props {
  estateId: string;
}

export default function EstateSearchRoles({ estateId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["roleinformation", estateId],
    queryFn: async () => {
      const response = await fetchWithMsal(
        `/api/estate/${estateId}/searchroles`,
      );
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
        Roller
      </Heading>
      <Paragraph style={{ marginBottom: "var(--ds-size-5)" }}>
        Her vises roller fra oed-authz roles/search slik de returneres til
        eksterne konsumenter
      </Paragraph>

      {isLoading && (
        <Skeleton variant="rectangle" aria-label="Henter rolleinformasjon" />
      )}
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av rolleinformasjon:
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
              {JSON.stringify(data.roleInformation, null, 2)}
            </pre>
          </Details.Content>
        </Details>
      )}
    </>
  );
}
