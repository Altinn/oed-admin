import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  Heading,
  Skeleton,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { CodeIcon } from "@navikt/aksel-icons";
import { fetchWithMsal } from "../../utils/msalUtils";
import Instance from "../instance";
import type { AltinnInstance, Signee } from "./types";
import { toInstanceProxyUrl, toProxyUrl } from "./urls";

export default function SubAppInstanceCell({ signee }: { signee: Signee }) {
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
