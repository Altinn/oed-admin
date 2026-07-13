import { useState } from "react";
import { Button, ValidationMessage } from "@digdir/designsystemet-react";
import { FilePdfIcon } from "@navikt/aksel-icons";
import { fetchWithMsal } from "../../utils/msalUtils";
import type { Signee } from "./types";
import { toProxyUrl } from "./urls";

export default function ReceiptCell({ signee }: { signee: Signee }) {
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
