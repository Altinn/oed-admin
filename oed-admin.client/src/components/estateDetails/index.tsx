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
  InformationSquareIcon,
  KeyVerticalIcon,
  ParagraphIcon,
  ShieldCheckmarkIcon,
  TasklistIcon,
} from "@navikt/aksel-icons";
import "./style.css";
import EstateRoles from "../estateRoles";
import EstateEvents from "../estateEvents";
import type { Estate } from "../../types/IEstate";
import { SuperAdmin } from "../superAdmins";
import EstateTasks from "../estateTasks";
import {
  formatDateTimeLocal,
  isValidDate,
  isValidDateTime,
} from "../../utils/formatters";
import EstateInstance from "../estateInstance";
import EstateSigneeStatus from "../estateSigneeStatus";
import EstateDaObject from "../estateDaObject";
import { fetchWithMsal } from "../../utils/msalUtils";
import EstateSearchRoles from "../estateSearchRoles";
import EstateCorrespondences from "../estateCorrespondences";

interface EstateDetailsResponse {
  estate: Estate;
}

export default function EstateDetails() {
  const location = useLocation();
  const id = location.pathname.split("/").pop() || "";

  const { data, isLoading, error } = useQuery<EstateDetailsResponse>({
    queryKey: ["estate", id],
    queryFn: async () => {
      const response = await fetchWithMsal(`/api/estate/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch estate details");
      }
      return response.json();
    },
  });

  const formatValue = (
    val: unknown,
  ): { type: "datetime-local" | "date" | "text"; value: string } => {
    if (isValidDateTime(val)) {
      return {
        type: "datetime-local",
        value: formatDateTimeLocal(new Date(val)),
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
          <Tabs.Tab value="authzroles">
            <ShieldCheckmarkIcon />
            Authz
          </Tabs.Tab>
          <Tabs.Tab value="instance">
            <DatabaseIcon />
            Instans
          </Tabs.Tab>
          <Tabs.Tab value="signeestatus">
            <DocPencilIcon />
            Skjemaer
          </Tabs.Tab>
          <Tabs.Tab value="daobject">
            <ParagraphIcon />
            DA Source
          </Tabs.Tab>
          <Tabs.Tab value="events">
            <EnvelopeClosedIcon />
            Eventer
          </Tabs.Tab>
          <Tabs.Tab value="tasks">
            <TasklistIcon />
            Oppgaveliste
          </Tabs.Tab>
          <Tabs.Tab value="correspondences">
            <EnvelopeClosedIcon />
            Korrespondanse
          </Tabs.Tab>
          <Tabs.Tab value="super-admin">
            <KeyVerticalIcon />
            Super-admin
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details">
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

        <Tabs.Panel value="roles">
          <EstateRoles estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="authzroles">
          <EstateSearchRoles estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="instance">
          <EstateInstance estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="signeestatus">
          <EstateSigneeStatus estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="daobject">
          <EstateDaObject estateId={id} caseId={data?.estate.caseId} />
        </Tabs.Panel>
        <Tabs.Panel value="events">
          <EstateEvents estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="tasks">
          <EstateTasks estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="correspondences">
          <EstateCorrespondences estateId={id} />
        </Tabs.Panel>
        <Tabs.Panel value="super-admin">
          <SuperAdmin estateId={id} instanceId={data?.estate.instanceId} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
