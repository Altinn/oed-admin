import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumbs,
  Divider,
  Heading,
  Label,
  Paragraph,
  Skeleton,
  Tabs,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import {
  EnvelopeClosedIcon,
  InformationSquareIcon,
  KeyVerticalIcon,
  ShieldCheckmarkIcon,
} from "@navikt/aksel-icons";
import "./style.css";
import EstateRoles from "./estateRoles";
import EstateEvents from "./estateEvents";
import type { Estate } from "../../types/IEstate";
import SuperAdmin from "./superAdmin";

interface EstateDetailsResponse {
  estate: Estate;
}

export default function EstateDetails() {
  const location = useLocation();
  const id = location.pathname.split("/").pop() || "";

  const { data, isLoading, error } = useQuery<EstateDetailsResponse>({
    queryKey: ["estate", id],
    queryFn: async () => {
      const response = await fetch(`/api/estate/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch estate details");
      }
      return response.json();
    },
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

      <Heading level={1} data-size="xl">
        Dødsbo etter {deceasedName}
      </Heading>
      <Paragraph>
        Her kan du se detaljer om dødsboet til den avdøde personen. Du kan også
        navigere tilbake til oversikten for å se andre dødsbo.
      </Paragraph>
      <Tabs defaultValue="details" data-color="accent">
        <Tabs.List style={{ marginBottom: "var(--ds-size-4)" }}>
          <Tabs.Tab value="details">
            <InformationSquareIcon /> Detaljer
          </Tabs.Tab>
          <Tabs.Tab value="roles">
            <ShieldCheckmarkIcon />
            Roller
          </Tabs.Tab>
          <Tabs.Tab value="events">
            <EnvelopeClosedIcon />
            Eventer
          </Tabs.Tab>
          <Tabs.Tab value="super-admin">
            <KeyVerticalIcon />
            Super-admin
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" id="tab-details">
          {isLoading && <Skeleton aria-label="Henter roller" />}

          {error && (
            <ValidationMessage>
              Det oppstod en feil under henting av detaljer for boet:{" "}
              {error.message}
            </ValidationMessage>
          )}

          {data?.estate === null && (
            <ValidationMessage data-color="info">
              Fant ingen detaljer for dette boet.
            </ValidationMessage>
          )}

          {data?.estate && (
            <>
              <Heading
                level={2}
                data-size="sm"
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
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="roles" id="tab-roles">
          <EstateRoles estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="events" id="tab-events">
          <EstateEvents />
        </Tabs.Panel>
        <Tabs.Panel value="super-admin" id="tab-super-admin">
          <SuperAdmin estateId={id} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
