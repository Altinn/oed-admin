import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  Heading,
  Skeleton,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";
import { fetchWithMsal } from "../../utils/msalUtils";
import BracesIcon from "../icons/BracesIcon";
import {
  isDeclarationSubApp,
  type HeirDeclarationResponse,
  type ProbateInformationResponse,
  type Signee,
} from "./types";
import { toSubAppInstanceGuid } from "./urls";

// Shows the payload DA receives when it fetches this heir's declaration. The backend derives the
// deceased instance from the estate row; the heir side needs the subApp, the heir's partyId, and
// the heir's subapp instance guid (parsed from subAppInstanceUrl).
export default function HeirDeclarationCell({
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

  const isDeclaration = isDeclarationSubApp(signee);

  const url = isDeclaration
    ? `/api/estate/${estateId}/probateinformation`
    : signee.subApp && heirInstanceGuid
      ? `/api/estate/${estateId}/heirdeclaration/${signee.partyId}` +
        `/${encodeURIComponent(signee.subApp)}/${heirInstanceGuid}`
      : null;

  const queryKey = isDeclaration
    ? ["probateinformation", estateId]
    : ["heir-declaration", estateId, signee.partyId];

  const { data, isLoading, error } = useQuery<
    HeirDeclarationResponse | ProbateInformationResponse
  >({
    queryKey,
    queryFn: async () => {
      const response = await fetchWithMsal(url!);
      if (!response.ok) {
        throw new Error("Failed to fetch heir declaration");
      }
      return response.json();
    },
    enabled: enabled && !!url,
  });

  const declaration = isDeclaration
    ? (data as ProbateInformationResponse | undefined)?.probateInformation
    : (data as HeirDeclarationResponse | undefined)?.heirDeclaration;

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
        <BracesIcon />
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
          <JSONPretty id="json-pretty" data={declaration} />
        )}
      </Dialog>
    </>
  );
}
