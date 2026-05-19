import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Details,
  Heading,
  Paragraph,
  Popover,
  Skeleton,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { FileJsonIcon } from "@navikt/aksel-icons";
import { fetchWithMsal } from "../../utils/msalUtils";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";
import { useState } from "react";

interface Props {
  estateId: string;
  caseId?: string;
}

export default function EstateDaObject({ estateId, caseId }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["daobject", estateId, caseId],
    queryFn: async () => {
      const response = await fetchWithMsal(`/api/estate/${estateId}/daobject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ caseId: caseId }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch object");
      }
      return response.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithMsal(
        `/api/estate/${estateId}/daobject/sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ caseId: caseId }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to sync object");
      }
    },
  });

  return (
    <>
      <Heading
        level={2}
        data-size="sm"
        style={{ marginBottom: "var(--ds-size-2)" }}
      >
        DA Source Object
      </Heading>
      <Paragraph style={{ marginBottom: "var(--ds-size-5)" }}>
        Her vises nåværende informasjon om dette boet slik det er representert i
        DA sitt api.
      </Paragraph>

      {isLoading && (
        <Skeleton variant="rectangle" aria-label="Henter DA object" />
      )}
      {error && (
        <ValidationMessage>
          Det oppstod en feil under henting av DA object:
          {error.message}
        </ValidationMessage>
      )}

      {data && (
        <>
          <Details defaultOpen={true}>
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
                <JSONPretty id="json-pretty" data={data?.daObject}></JSONPretty>
              </pre>
            </Details.Content>
          </Details>
          <Popover.TriggerContext>
            <Popover.Trigger
              style={{ marginTop: "var(--ds-size-4)" }}
              loading={syncMutation.isPending}
              onClick={() => setPopoverOpen(true)}
            >
              Synkroniser med DA
            </Popover.Trigger>
            <Popover
              data-color="warning"
              open={popoverOpen}
              onClose={() => setPopoverOpen(false)}
            >
              <Paragraph>
                Er du sikker på at du vil trigge en manuell synkronisering med
                DA?
              </Paragraph>
              <div
                style={{ marginTop: "var(--ds-size-2)" }}
                className="flex-row"
              >
                <Button
                  data-size="sm"
                  onClick={() => {
                    setPopoverOpen(false);
                    syncMutation.mutate();
                  }}
                  loading={syncMutation.isPending}
                >
                  Ja, synkroniser
                </Button>
                <Button
                  data-size="sm"
                  variant="tertiary"
                  onClick={() => setPopoverOpen(false)}
                >
                  Avbryt
                </Button>
              </div>
            </Popover>
          </Popover.TriggerContext>
        </>
      )}
    </>
  );
}
