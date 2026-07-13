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
import { CodeIcon, FilePdfIcon, GavelIcon } from "@navikt/aksel-icons";
import Instance from "../instance";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";

interface Props {
  estateId: string;
}
interface DataElement {
  id: string;
  contentType: string | null;
  selfLinks: { apps: string | null; platform: string | null } | null;
}
interface AltinnInstance {
  data: DataElement[] | null;
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
interface HeirDeclarationResponse {
  heirDeclaration: unknown;
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

// The heir's subapp instance guid is the last path segment of subAppInstanceUrl (Altinn Storage):
// .../storage/api/v1/instances/{ownerPartyId}/{instanceGuid}
const toSubAppInstanceGuid = (subAppInstanceUrl: string): string | null => {
  try {
    return new URL(subAppInstanceUrl).pathname.split("/").at(-1) || null;
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

  const { data, isLoading, error } = useQuery<{ instance: AltinnInstance }>({
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

  // The instance's data array holds both the PDF receipt and the XML submission,
  // so pick by content type rather than position. selfLinks.apps is null when the
  // element came from platform storage, which is why we read selfLinks.platform.
  const platformUrl = data?.instance?.data?.find((dataElement) =>
    dataElement.contentType?.toLowerCase().includes("xml"),
  )?.selfLinks?.platform;
  const xmlProxyUrl = platformUrl ? toProxyUrl(platformUrl) : null;

  const {
    data: xml,
    isLoading: isXmlLoading,
    error: xmlError,
  } = useQuery<string>({
    queryKey: ["instance-data", xmlProxyUrl],
    queryFn: async () => {
      const response = await fetchWithMsal(xmlProxyUrl!);
      if (!response.ok) {
        throw new Error("Failed to fetch instance data");
      }
      return response.text();
    },
    enabled: !!xmlProxyUrl,
  });

  if (!proxyUrl) {
    return <>-</>;
  }

  // Without the xmlProxyUrl guard an instance carrying no xml element would keep
  // isXmlLoading true forever, since that query never becomes enabled.
  const isPending = isLoading || (!!xmlProxyUrl && isXmlLoading);
  const failed = error ?? xmlError;

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
        aria-label="Vis subapp-instans"
      >
        <CodeIcon />
      </Button>
      <Dialog
        ref={dialogRef}
        // Pin the height so expanding a pane scrolls inside the dialog instead of
        // resizing it. .ds-dialog is vertically centred (inset: 0; margin: auto),
        // so a content-driven height makes the whole box move as panes open.
        style={{ maxWidth: 1200, height: "var(--dsc-dialog-max-height)" }}
        data-size="sm"
        closedby="any"
      >
        <Heading level={3} style={{ marginBottom: "var(--ds-size-2)" }}>
          SubApp instans
        </Heading>
        {isPending && (
          <Skeleton variant="rectangle" aria-label="Henter instans" />
        )}
        {failed && (
          <ValidationMessage>Kunne ikke hente instans.</ValidationMessage>
        )}
        {!isPending && !failed && data && (
          <Instance data={{ instance: data.instance, instanceData: xml }} />
        )}
      </Dialog>
    </>
  );
}

// Shows the payload DA receives when it fetches this heir's declaration. The backend derives the
// deceased instance from the estate row; the heir side needs the subApp, the heir's partyId, and
// the heir's subapp instance guid (parsed from subAppInstanceUrl).
function HeirDeclarationCell({
  estateId,
  signee,
}: {
  estateId: string;
  signee: Signee;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [enabled, setEnabled] = useState(false);

  const heirInstanceGuid = signee.subAppInstanceUrl
    ? toSubAppInstanceGuid(signee.subAppInstanceUrl)
    : null;
  const url =
    signee.subApp && heirInstanceGuid
      ? `/api/estate/${estateId}/heirdeclaration/${signee.partyId}` +
        `/${encodeURIComponent(signee.subApp)}/${heirInstanceGuid}`
      : null;

  const { data, isLoading, error } = useQuery<HeirDeclarationResponse>({
    queryKey: ["heir-declaration", estateId, signee.partyId],
    queryFn: async () => {
      const response = await fetchWithMsal(url!);
      if (!response.ok) {
        throw new Error("Failed to fetch heir declaration");
      }
      return response.json();
    },
    enabled: enabled && !!url,
  });

  if (!url) {
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
        aria-label="Vis DA-erklæring"
      >
        <GavelIcon />
      </Button>
      <Dialog
        ref={dialogRef}
        // Pin the height so expanding content scrolls inside the dialog instead of resizing it.
        style={{ maxWidth: 1200, height: "var(--dsc-dialog-max-height)" }}
        data-size="sm"
        closedby="any"
      >
        <Heading level={3} style={{ marginBottom: "var(--ds-size-2)" }}>
          DA-erklæring
        </Heading>
        {isLoading && (
          <Skeleton variant="rectangle" aria-label="Henter DA-erklæring" />
        )}
        {error && (
          <ValidationMessage>Kunne ikke hente DA-erklæring.</ValidationMessage>
        )}
        {!isLoading && !error && data && (
          <JSONPretty id="json-pretty" data={data.heirDeclaration} />
        )}
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
