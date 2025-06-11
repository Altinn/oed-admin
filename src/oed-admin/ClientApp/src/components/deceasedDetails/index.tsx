import { Breadcrumbs, Heading, Paragraph } from "@digdir/designsystemet-react";
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function DeceasedDetails() {
  const deceased = useLocation().state?.deceased;

  return (
    <>
      <Breadcrumbs>
        <Breadcrumbs.Link aria-label="Tilbake til Nivå 3" href="#" asChild>
          <Link to="/" aria-label="Tilbake til forsiden">
            Tilbake til oversikt
          </Link>
        </Breadcrumbs.Link>
      </Breadcrumbs>

      <Heading level={1} data-size="xl">
        Dødsbo etter {deceased ? deceased.name : "Ukjent"}
      </Heading>
      <Paragraph>
        Her kan du se detaljer om dødsboet til den avdøde personen. Du kan også
        navigere tilbake til oversikten for å se andre dødsbo.
      </Paragraph>

      <section></section>
    </>
  );
}
