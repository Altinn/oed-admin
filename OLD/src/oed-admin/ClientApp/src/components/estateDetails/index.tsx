import {
  Breadcrumbs,
  Divider,
  Heading,
  Label,
  Paragraph,
  Skeleton,
} from "@digdir/designsystemet-react";
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

  const { deceasedName, deceasedNin, deceasedPartyId, dateOfDeath } =
    (data?.estate as Estate) || {};

  return (
    <>
      <Breadcrumbs>
        <Breadcrumbs.Link aria-label="Tilbake til Nivå 3" href="#" asChild>
          <Link to="/" aria-label="Tilbake til forsiden">
            Tilbake til oversikt
          </Link>
        </Breadcrumbs.Link>
      </Breadcrumbs>

      {isLoading && (
        <>
          <Heading data-size="xl">
            <Skeleton variant="text" width={32} />
          </Heading>
          <Paragraph>
            <Skeleton variant="text" width={320} />
          </Paragraph>
          <Paragraph>
            <Skeleton variant="text" width={240} />
          </Paragraph>
        </>
      )}

      {error && (
        <Paragraph>
          Kunne ikke hente detaljer for dødsbo: {error.message}
        </Paragraph>
      )}
      {data?.estate?.length === 0 && (
        <Paragraph>Ingen dødsbo funnet med ID: {id}</Paragraph>
      )}
      {data?.estate && (
        <>
          <Heading level={1} data-size="xl">
            Dødsbo etter {deceasedName}
          </Heading>
          <Paragraph>
            Her kan du se detaljer om dødsboet til den avdøde personen. Du kan
            også navigere tilbake til oversikten for å se andre dødsbo.
          </Paragraph>

          <section>
            <Heading
              level={2}
              data-size="md"
              style={{ marginBottom: "var(--ds-size-2)" }}
            >
              Detaljer
            </Heading>

            <Divider />
            <Paragraph className="flex-between ">
              <Label>Party ID</Label>
              {deceasedPartyId}
            </Paragraph>
            <Divider />
            <Paragraph className="flex-between ">
              <Label>Fødselsnummer</Label>
              {deceasedNin}
            </Paragraph>
            <Divider />
            <Paragraph className="flex-between ">
              <Label>Navn</Label>
              {deceasedName}
            </Paragraph>
            <Divider />
            <Paragraph className="flex-between ">
              <Label>Dato for dødsfall</Label>
              {new Intl.DateTimeFormat("nb").format(new Date(dateOfDeath))}
            </Paragraph>
            <Divider />
          </section>
        </>
      )}
    </>
  );
}
