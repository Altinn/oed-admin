import {
  Heading,
  Paragraph,
  Tabs,
} from "@digdir/designsystemet-react";
import {
  KeyVerticalIcon,
  CircleBrokenIcon,
  ExclamationmarkTriangleIcon,
  MagnifyingGlassIcon,
  TasklistIcon,
  BroadcastIcon,
  GavelSoundBlockIcon,
  PadlockLockedIcon
} from "@navikt/aksel-icons";
import Tasks from "./tasks";
import EstateSearch from "./estateSearch";
import { SuperAdmins } from "./superAdmins";
import SecretExpiration from "./secretExpiration";
import EventSubs from "./eventsubs";
import DistrictCourts from "./districtCourts";

export default function Home() {
  return (
    <>
      <Tabs defaultValue="search" style={{ width: "100%" }}>
        <Tabs.List style={{ marginBottom: "var(--ds-size-4)" }}>
          <Tabs.Tab value="search">
            <MagnifyingGlassIcon /> Søk etter dødsbo
          </Tabs.Tab>
          <Tabs.Tab value="tasks">
            <TasklistIcon /> Task Queue
          </Tabs.Tab>
          <Tabs.Tab value="superadmins">
            <KeyVerticalIcon /> Super admins
          </Tabs.Tab>
          <Tabs.Tab value="secrets">
            <PadlockLockedIcon /> Hemmeligheter
          </Tabs.Tab>
          <Tabs.Tab value="event-sub">
            <BroadcastIcon /> Event subscriptions
          </Tabs.Tab>
          <Tabs.Tab value="districtcourts">
            <GavelSoundBlockIcon /> Tingretter
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="search" id="tab-search">
          <EstateSearch />
        </Tabs.Panel>
        <Tabs.Panel value="tasks" id="tab-tasks">
          <Tabs defaultValue="dlq">
            <Tabs.List style={{ marginBottom: "var(--ds-size-4)" }}>
              <Tabs.Tab value="dlq">
                <ExclamationmarkTriangleIcon /> Dead Letter Queue
              </Tabs.Tab>
              <Tabs.Tab value="retrying">
                <CircleBrokenIcon /> Retrying
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="dlq" id="tab-tasks-dlq">
              <section id="dead-letter-queue">
                <Heading
                  level={2}
                  data-size="sm"
                  style={{ paddingBottom: "var(--ds-size-2)" }}
                >
                  Dead Letter Queue
                </Heading>
                <Paragraph style={{ marginBottom: '2rem' }}>
                  Oppgaver i denne listen har feilet maksimalt antall ganger og de vil ikke bli forsøkt igjen automatisk. Når grunnen til at de feiler er løst kan de reschedules manuelt.
                </Paragraph>
                <Tasks status="DeadLetterQueue" />
              </section>
            </Tabs.Panel>
            <Tabs.Panel value="retrying" id="tab-tasks-retrying">
              <section id="retrying-tasks">
                <Heading
                  level={2}
                  data-size="sm"
                  style={{ paddingBottom: "var(--ds-size-2)" }}
                >
                  Retrying
                </Heading>
                <Paragraph style={{ marginBottom: '2rem' }}>
                  Oppgaver i denne listen har feilet, men de har enda ikke nådd maksimalt antall forsøk og de vil derfor automatisk bli forsøkt igjen senere.
                </Paragraph>

                <Tasks status="Retrying" />
              </section>
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>
        <Tabs.Panel value="superadmins" id="tab-superadmins">
          <SuperAdmins />
        </Tabs.Panel>
        <Tabs.Panel value="secrets" id="tab-secrets">
          <SecretExpiration />
        </Tabs.Panel>
        <Tabs.Panel value="event-sub" id="tab-event-sub">
          <EventSubs />
        </Tabs.Panel>
        <Tabs.Panel value="districtcourts" id="tab-districtcourts">
          <DistrictCourts />
        </Tabs.Panel>
      </Tabs>      
    </>
  );
}
