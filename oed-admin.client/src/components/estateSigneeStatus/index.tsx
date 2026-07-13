import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Heading,
  Paragraph,
  Skeleton,
  Table,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { fetchWithMsal } from "../../utils/msalUtils";
import { formatDateTime } from "../../utils/formatters";
import HeirDeclarationCell from "./HeirDeclarationCell";
import ReceiptCell from "./ReceiptCell";
import SubAppInstanceCell from "./SubAppInstanceCell";
import {
  DECLARATION_SUBAPP,
  isDeclarationSubApp,
  type SigneeStatusResponse,
} from "./types";

interface Props {
  estateId: string;
}

export default function EstateSigneeStatus({ estateId }: Props) {
  const { data, isLoading, error } = useQuery<SigneeStatusResponse>({
    queryKey: ["signeestatus", estateId],
    queryFn: async () => {
      const response = await fetchWithMsal(
        `/api/estate/${estateId}/signeestatus`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch signee status");
      }
      return response.json();
    },
  });

  const signees = data?.signeeStatus?.signeeStatus;

  const hasDeclarationSubApp = !!signees?.some(isDeclarationSubApp);

  return (
    <>
      <Heading
        level={2}
        data-size="sm"
        style={{ marginBottom: "var(--ds-size-2)" }}
      >
        Skjemaer
      </Heading>
      <Paragraph style={{ marginBottom: "var(--ds-size-2)" }}>
        Her vises arvingenes skifteerklæringer for dette boet.
      </Paragraph>
      {hasDeclarationSubApp && (
        <Alert
          data-color="info"
          data-size="sm"
          style={{ marginBottom: "var(--ds-size-5)" }}
        >
          <Heading level={3} data-size="2xs">
            Viktig informasjon angående {DECLARATION_SUBAPP}
          </Heading>
          <Paragraph style={{ marginTop: "var(--ds-size-2)" }}>
            For subappen "oed-declaration" deler alle arvingene det samme
            skjemaet i altinn. Instans, PDF og DA-erklæring vil derfor vise
            samme informasjon for alle radene. Status viser likevel den enkelte
            arvingens utfyllingsstatus, mens Innsendt-datoen kun vises på raden
            til arvingen som faktisk sendte inn den felles erklæringen.
          </Paragraph>
          <Paragraph style={{ marginTop: "var(--ds-size-2)" }}>
            For alle andre subapper er skjemaet individuelt for hver
            arving.{" "}
          </Paragraph>
        </Alert>
      )}

      {isLoading && (
        <Skeleton variant="rectangle" aria-label="Henter skjemaer" />
      )}
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av skjemaer:
          {error.message}
        </ValidationMessage>
      )}

      {data && !signees?.length && (
        <ValidationMessage data-color="info">
          Fant ingen skjemaer for dette boet.
        </ValidationMessage>
      )}

      {signees && signees.length > 0 && (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>PartyId</Table.HeaderCell>
              <Table.HeaderCell>SubApp</Table.HeaderCell>
              <Table.HeaderCell>Skiftetype</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Innsendt</Table.HeaderCell>
              <Table.HeaderCell>Ekstra</Table.HeaderCell>
              <Table.HeaderCell>Instans</Table.HeaderCell>
              <Table.HeaderCell>PDF</Table.HeaderCell>
              <Table.HeaderCell>DA-erklæring</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {signees.map((signee) => (
              <Table.Row key={signee.partyId}>
                <Table.Cell>{signee.partyId}</Table.Cell>
                <Table.Cell>{signee.subApp ?? "-"}</Table.Cell>
                <Table.Cell>{signee.probateType ?? "-"}</Table.Cell>
                <Table.Cell>{signee.subAppStatus ?? "-"}</Table.Cell>
                <Table.Cell>
                  {signee.submitted ? formatDateTime(signee.submitted) : "-"}
                </Table.Cell>
                <Table.Cell>
                  {signee.extraInfo
                    ? Object.entries(signee.extraInfo).map(([key, value]) => (
                        <div key={key}>
                          {key}: {value}
                        </div>
                      ))
                    : "-"}
                </Table.Cell>
                <Table.Cell>
                  <SubAppInstanceCell signee={signee} />
                </Table.Cell>
                <Table.Cell>
                  <ReceiptCell signee={signee} />
                </Table.Cell>
                <Table.Cell>
                  <HeirDeclarationCell estateId={estateId} signee={signee} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </>
  );
}
