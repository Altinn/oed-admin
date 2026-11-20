import React from "react";
import { Breadcrumbs, Divider, Heading, Paragraph } from "@digdir/designsystemet-react";
import { Link, useSearchParams } from "react-router-dom";
import PhaseSection from "./PhaseSection";
import CopySection from "./CopySection";
import RunsSection from "./RunsSection";

/**
 * «OED_M-migrering» (Altinn/oed#1923 §4). Calls oed's admin endpoints through oed-admin and shows their answers; the
 * rules live in oed.
 */
export default function OedModelMigration() {
  const [searchParams] = useSearchParams();
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  // A run item's "Kopier …" fills in the copy form; the key remounts it with that instance.
  const [copyInstanceId, setCopyInstanceId] = React.useState(searchParams.get("instanceId") ?? "");
  const copyRef = React.useRef<HTMLDivElement>(null);

  const copyInstance = (instanceId: string) => {
    setCopyInstanceId(instanceId);
    copyRef.current?.scrollIntoView?.({ behavior: "smooth" });
  };

  return (
    <>
      <Breadcrumbs>
        <Breadcrumbs.Link href="#" asChild>
          <Link to="/" aria-label="Tilbake til forsiden">
            Tilbake til oversikt
          </Link>
        </Breadcrumbs.Link>
      </Breadcrumbs>

      <Heading level={1} data-size="xl">
        OED_M-migrering
      </Heading>
      <Paragraph>
        Flytter dødsboenes OED_M fra Storage til databasen i oed (Altinn/oed#1884). oed bestemmer hva
        som er lov; denne siden viser bare svarene. Ingenting her kan rulles tilbake ved å endre fasen.
      </Paragraph>

      <PhaseSection onShowRun={setSelectedRunId} />
      <Divider style={{ margin: "var(--ds-size-8) 0" }} />
      <RunsSection selectedRunId={selectedRunId} onShowRun={setSelectedRunId} onCopyInstance={copyInstance} />
      <Divider style={{ margin: "var(--ds-size-8) 0" }} />
      <div ref={copyRef}>
        <CopySection key={copyInstanceId} initialInstanceId={copyInstanceId} />
      </div>
    </>
  );
}
