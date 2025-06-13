import { Breadcrumbs, Heading, Paragraph } from "@digdir/designsystemet-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Estate } from "../../types/IEstate";

export default function EstateDetails() {
  const location = useLocation();
  const id = location.pathname.split("/").pop() || "";

  const getEstateData = async (id: string) => {
    try {
      const response = await fetch(`/api/estate/${id}`);
      if (!response.ok) {
        console.error("Error fetching estate data:", response.statusText);
        return null;
      }
      return response.json();
    } catch (error) {
      console.error("Error fetching estate data:", error);
      return null;
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["estateDetails", id],
    queryFn: () => getEstateData(id),
    enabled: !!id, // Only run the query if id is available
  });
  const { estate } = data;
  const { deceasedName } = (estate as Estate) || {};

  return (
    <>
      <Breadcrumbs>
        <Breadcrumbs.Link aria-label="Tilbake til Nivå 3" href="#" asChild>
          <Link to="/" aria-label="Tilbake til forsiden">
            Tilbake til oversikt
          </Link>
        </Breadcrumbs.Link>
      </Breadcrumbs>

      {isLoading && <Paragraph>Henter detaljer for dødsbo...</Paragraph>}
      {error && (
        <Paragraph>
          Kunne ikke hente detaljer for dødsbo: {error.message}
        </Paragraph>
      )}
      {!estate && <Paragraph>Ingen dødsbo funnet med ID: {id}</Paragraph>}
      {estate && (
        <>
          <Heading level={1} data-size="xl">
            Dødsbo etter {deceasedName}
          </Heading>
          <Paragraph>
            Her kan du se detaljer om dødsboet til den avdøde personen. Du kan
            også navigere tilbake til oversikten for å se andre dødsbo.
          </Paragraph>

          <section></section>
        </>
      )}
    </>
  );
}
