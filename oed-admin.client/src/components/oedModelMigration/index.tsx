import { Breadcrumbs, Divider, Heading, Paragraph } from "@digdir/designsystemet-react";
import { Link, useSearchParams } from "react-router-dom";
import PhaseSection from "./PhaseSection";
import CopySection from "./CopySection";

/**
 * «OED_M-migrering» (Altinn/oed#1923 §4). Calls oed's admin endpoints through oed-admin and shows their answers; the
 * rules live in oed. The runs section (§4.3) comes with Altinn/oed#1902.
 */
export default function OedModelMigration() {
  const [searchParams] = useSearchParams();

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

      <PhaseSection />
      <Divider style={{ margin: "var(--ds-size-8) 0" }} />
      <CopySection initialInstanceId={searchParams.get("instanceId") ?? ""} />
    </>
  );
}
