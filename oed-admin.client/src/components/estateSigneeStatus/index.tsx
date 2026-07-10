import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  Heading,
  Paragraph,
  Skeleton,
  Table,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { fetchWithMsal } from "../../utils/msalUtils";
import { formatDateTime } from "../../utils/formatters";
import { CodeIcon, FileJsonIcon, FilePdfIcon } from "@navikt/aksel-icons";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";

interface Props {
  estateId: string;
}
interface Signee {
  partyId: number;
  probateType: string | null;
  subAppStatus: string | null;
  subAppInstanceUrl: string | null;
  receiptUrl: string | null;
  submitted: string | null;
  subApp: string | null;
  extraInfo: Record<string, string> | null;
}
interface SigneeStatusResponse {
  signeeStatus: { signeeStatus: Signee[] } | null;
}

// receiptUrl points at the Altinn apps host, which our msal token is not valid for.
// Its path carries the ids our own proxy endpoint needs:
// .../instances/{ownerPartyId}/{instanceGuid}/data/{dataGuid}
// Note ownerPartyId is the instance owner, not the signee's partyId.
const toProxyUrl = (receiptUrl: string): string | null => {
  try {
    const segments = new URL(receiptUrl).pathname.split("/");
    const dataGuid = segments.at(-1);
    const instanceGuid = segments.at(-3);
    const ownerPartyId = segments.at(-4);

    if (!dataGuid || !instanceGuid || !ownerPartyId) {
      return null;
    }
    return `/api/instances/${ownerPartyId}/${instanceGuid}/data/${dataGuid}`;
  } catch {
    return null;
  }
};

// subAppInstanceUrl points at Altinn Storage, which our msal token is not valid for.
// Its last two path segments are the ids our own proxy endpoint needs:
// .../storage/api/v1/instances/{ownerPartyId}/{instanceGuid}
// Note ownerPartyId is the instance owner, not the signee's partyId.
const toInstanceProxyUrl = (subAppInstanceUrl: string): string | null => {
  try {
    const segments = new URL(subAppInstanceUrl).pathname.split("/");
    const instanceGuid = segments.at(-1);
    const ownerPartyId = segments.at(-2);

    if (!instanceGuid || !ownerPartyId) {
      return null;
    }
    return `/api/instances/${ownerPartyId}/${instanceGuid}`;
  } catch {
    return null;
  }
};

function ReceiptCell({ signee }: { signee: Signee }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  const proxyUrl = signee.receiptUrl ? toProxyUrl(signee.receiptUrl) : null;

  if (!proxyUrl) {
    return <>-</>;
  }

  const download = async () => {
    setIsDownloading(true);
    setFailed(false);

    try {
      const response = await fetchWithMsal(proxyUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch receipt");
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `kvittering-${signee.partyId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setFailed(true);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Button
        variant="tertiary"
        data-size="lg"
        icon
        loading={isDownloading}
        disabled={isDownloading}
        onClick={download}
        aria-label="Last ned kvittering som PDF"
      >
        <FilePdfIcon />
      </Button>
      {failed && (
        <ValidationMessage data-size="sm">
          Kunne ikke hente kvittering.
        </ValidationMessage>
      )}
    </>
  );
}

function SubAppInstanceCell({ signee }: { signee: Signee }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [enabled, setEnabled] = useState(false);

  const proxyUrl = signee.subAppInstanceUrl
    ? toInstanceProxyUrl(signee.subAppInstanceUrl)
    : null;

  const { data, isLoading, error } = useQuery<{ instance: unknown }>({
    queryKey: ["instance", proxyUrl],
    queryFn: async () => {
      const response = await fetchWithMsal(proxyUrl!);
      if (!response.ok) {
        throw new Error("Failed to fetch instance");
      }
      return response.json();
    },
    enabled: enabled && !!proxyUrl,
  });

  if (!proxyUrl) {
    return <>-</>;
  }

  return (
    <>
      <Button
        variant="tertiary"
        data-size="lg"
        icon
        onClick={() => {
          setEnabled(true);
          dialogRef.current?.showModal();
        }}
        aria-label="Vis instans-JSON"
      >
        <FileJsonIcon />
      </Button>
      <Dialog
        ref={dialogRef}
        style={{ maxWidth: 1200 }}
        data-size="sm"
        closedby="any"
      >
        <Heading level={3} style={{ marginBottom: "var(--ds-size-2)" }}>
          Instans
        </Heading>
        {isLoading && (
          <Skeleton variant="rectangle" aria-label="Henter instans" />
        )}
        {error && (
          <ValidationMessage>Kunne ikke hente instans.</ValidationMessage>
        )}
        {data && <JSONPretty data={data.instance} />}
      </Dialog>
    </>
  );
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

  return (
    <>
      <Heading
        level={2}
        data-size="sm"
        style={{ marginBottom: "var(--ds-size-2)" }}
      >
        Signeringsstatus
      </Heading>
      <Paragraph style={{ marginBottom: "var(--ds-size-5)" }}>
        Her vises status for de som skal signere skifteerklæringen for dette
        boet.
      </Paragraph>

      {isLoading && (
        <Skeleton variant="rectangle" aria-label="Henter signeringsstatus" />
      )}
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av signeringsstatus:
          {error.message}
        </ValidationMessage>
      )}

      {data && !signees?.length && (
        <ValidationMessage data-color="info">
          Fant ingen signeringsstatus for dette boet.
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
              <Table.HeaderCell>PDF</Table.HeaderCell>
              <Table.HeaderCell>JSON</Table.HeaderCell>
              <Table.HeaderCell>Instans</Table.HeaderCell>
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
                  <ReceiptCell signee={signee} />
                </Table.Cell>
                <Table.Cell>
                  <Dialog.TriggerContext>
                    <Dialog.Trigger variant="tertiary" data-size="lg">
                      <CodeIcon />
                    </Dialog.Trigger>
                    <Dialog
                      style={{ maxWidth: 1200 }}
                      data-size="sm"
                      closedby="any"
                    >
                      <Heading
                        level={3}
                        style={{ marginBottom: "var(--ds-size-2)" }}
                      >
                        JSON Payload
                      </Heading>
                      <JSONPretty id="json-pretty" data={signee}></JSONPretty>
                    </Dialog>
                  </Dialog.TriggerContext>
                </Table.Cell>
                <Table.Cell>
                  <SubAppInstanceCell signee={signee} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </>
  );
}
