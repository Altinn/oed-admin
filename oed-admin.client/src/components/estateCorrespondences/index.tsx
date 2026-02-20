import { useQuery } from "@tanstack/react-query";
import { Dialog, Heading, Skeleton, Table, ValidationMessage } from "@digdir/designsystemet-react";
import { fetchWithMsal } from "../../utils/msalUtils";
import { formatDateTime } from "../../utils/formatters";
import { CodeIcon } from "@navikt/aksel-icons";

interface Props {
  estateId: string;
}
interface CorrespondenceContent {
  messageTitle: string;
}
interface CorrespondenceOverview {
  correspondenceId: string;
  recipient: string;
  statusText: string;
  statusChanged?: string;
  published?: string;
  content?: CorrespondenceContent;
}
interface CorrespondencesResponse {
  correspondences: CorrespondenceOverview[];
}
export default function EstateCorrespondences({ estateId }: Props) {
  const { data, isLoading, error } = useQuery<CorrespondencesResponse>({
    queryKey: ["correspondences", estateId],
    queryFn: async () => {
      const response = await fetchWithMsal(`/api/estate/${estateId}/correspondences`);
      if (!response.ok) {
        throw new Error("Failed to fetch correspondences");
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
        Korrespondanse
      </Heading>
      {isLoading &&
        <Skeleton variant="rectangle" aria-label="Henter korrespondanse" />
      }
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av korrespondanse:
          {error.message}
        </ValidationMessage>
      )}

      {data?.correspondences && (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Mottaker</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Endret status dato</Table.HeaderCell>
              <Table.HeaderCell>Publisert</Table.HeaderCell>
              <Table.HeaderCell>Meldingstittel</Table.HeaderCell>
              <Table.HeaderCell>JSON</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {data.correspondences?.map((correspondence) => (
              <Table.Row key={correspondence.correspondenceId}>
                <Table.Cell>{correspondence.recipient.split(":").pop()}</Table.Cell>
                <Table.Cell>{correspondence.statusText}</Table.Cell>
                <Table.Cell>{correspondence.statusChanged ? formatDateTime(correspondence.statusChanged) : "-"}</Table.Cell>
                <Table.Cell>{correspondence.published ? formatDateTime(correspondence.published) : "-"}</Table.Cell>
                <Table.Cell>{correspondence.content?.messageTitle}</Table.Cell>
                <Table.Cell>
                  <Dialog.TriggerContext>
                    <Dialog.Trigger
                      variant="tertiary"
                      data-size="lg"
                      disabled={!correspondence}
                    >
                      <CodeIcon />
                    </Dialog.Trigger>
                    {correspondence && (
                      <Dialog style={{ maxWidth: 1200 }} data-size="sm" closedby="any">
                        <Heading
                          level={3}
                          style={{ marginBottom: "var(--ds-size-2)" }}
                        >
                          JSON Payload
                        </Heading>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                          }}
                        >
                          {JSON.stringify(correspondence, null, 2)}
                        </pre>
                      </Dialog>
                    )}
                  </Dialog.TriggerContext>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </>
  );
}