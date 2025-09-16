import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumbs,
  Divider,
  Fieldset,
  Heading,
  Paragraph,
  Skeleton,
  Tabs,
  Textfield,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import {
  DatabaseIcon,
  DocPencilIcon,
  EnvelopeClosedIcon,
  GavelIcon,
  InformationSquareIcon,
  KeyVerticalIcon,
  ShieldCheckmarkIcon,
  TasklistIcon,
} from "@navikt/aksel-icons";
import "./style.css";
import EstateRoles from "../estateRoles";
import EstateEvents from "../estateEvents";
import type { Estate } from "../../types/IEstate";
import { SuperAdmin } from "../superAdmins";
import EstateTasks from "../estateTasks";
import { formatDateTimeLocal, isValidDate, isValidDateTime } from "../../utils/formatters";
import EstateInstance from "../estateInstance";
import EstateDeclaration from "../estateDeclaration";
import EstateProbateInformation from "../estateProbateInformation";

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

  const formatValue = (val: unknown): { type: string; value: string } => {
    if (isValidDateTime(val)) {
      return {
        type: "datetime-local",
        value: formatDateTimeLocal(new Date(val))
      };
    }

    if (isValidDate(val)) {
      return {
        type: "date",
        value: new Date(val).toISOString().slice(0, 10),
      };
    }

    return { type: "text", value: String(val ?? "-") };
  };

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
        Dødsbo etter {data?.estate.deceasedName || "ukjent"}
      </Heading>
      <Paragraph>
        Her kan du se detaljer om dødsboet til den avdøde personen. Du kan også
        navigere tilbake til oversikten for å se andre dødsbo.
      </Paragraph>
      <Tabs defaultValue="details" style={{ width: "100%" }}>
        <Tabs.List style={{ marginBottom: "var(--ds-size-4)" }}>
          <Tabs.Tab value="details">
            <InformationSquareIcon /> Detaljer
          </Tabs.Tab>
          <Tabs.Tab value="roles">
            <ShieldCheckmarkIcon />
            Roller
          </Tabs.Tab>
          <Tabs.Tab value="instance">
            <DatabaseIcon />
            Instans
          </Tabs.Tab>
          <Tabs.Tab value="declaration">
            <DocPencilIcon />
            Skifteerklæring
          </Tabs.Tab>
          <Tabs.Tab value="probateinformation">
            <GavelIcon />
            DA Probate Information
          </Tabs.Tab>
          <Tabs.Tab value="events">
            <EnvelopeClosedIcon />
            Eventer
          </Tabs.Tab>
          <Tabs.Tab value="tasks">
            <TasklistIcon />
            Oppgaveliste
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

              <Fieldset data-size="sm">
                {Object.entries(data.estate).map(([key, value]) => {
                  return (
                    <Textfield
                      label={key}
                      key={key}
                      type={formatValue(value).type}
                      value={formatValue(value).value}
                    />
                  );
                })}
              </Fieldset>
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="roles" id="tab-roles">
          <EstateRoles estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="instance" id="tab-instance">
          <EstateInstance estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="declaration" id="tab-declaration">
          <EstateDeclaration estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="probateinformation" id="tab-probateinformation">
          <EstateProbateInformation estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="events" id="tab-events">
          <EstateEvents estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="tasks" id="tab-tasks">
          <EstateTasks estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="super-admin" id="tab-super-admin">
          <SuperAdmin estateId={id} instanceId={data?.estate.instanceId} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
