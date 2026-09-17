import { Heading, Paragraph, Tabs } from "@digdir/designsystemet-react";
import {
  BarChartIcon,
  CheckmarkCircleIcon,
  KeyVerticalIcon,
  CircleBrokenIcon,
  ExclamationmarkTriangleIcon,
  MagnifyingGlassIcon,
  TasklistIcon,
  BroadcastIcon,
  GavelSoundBlockIcon,
  PadlockLockedIcon,
  HourglassIcon,
} from "@navikt/aksel-icons";
import Tasks from "./tasks";
import EstateSearch from "./estateSearch";
import { SuperAdmins } from "./superAdmins";
import SecretExpiration from "./secretExpiration";
import EventSubs from "./eventsubs";
import DistrictCourts from "./districtCourts";
import QaDashboard from "./qaDashboard";
import EstateCompletion from "./estateCompletion";
import EstateBacklog from "./estateBacklog";
import { useLazyTabs } from "../utils/useLazyTabs";

function TaskQueue() {
  const tabs = useLazyTabs("dlq");

  return (
    <Tabs value={tabs.value} onChange={tabs.onChange}>
      <Tabs.List style={{ marginBottom: "var(--ds-size-4)" }}>
        <Tabs.Tab value="dlq">
          <ExclamationmarkTriangleIcon /> Dead Letter Queue
        </Tabs.Tab>
        <Tabs.Tab value="retrying">
          <CircleBrokenIcon /> Retrying
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="dlq">
        <section id="dead-letter-queue">
          <Heading
            level={2}
            data-size="sm"
            style={{ paddingBottom: "var(--ds-size-2)" }}
          >
            Dead Letter Queue
          </Heading>
          <Paragraph style={{ marginBottom: "2rem" }}>
            Oppgaver i denne listen har feilet maksimalt antall ganger og
            de vil ikke bli forsøkt igjen automatisk. Når grunnen til at
            de feiler er løst kan de reschedules manuelt.
          </Paragraph>
          {tabs.isVisited("dlq") && <Tasks status="DeadLetterQueue" />}
        </section>
      </Tabs.Panel>
      <Tabs.Panel value="retrying">
        <section id="retrying-tasks">
          <Heading
            level={2}
            data-size="sm"
            style={{ paddingBottom: "var(--ds-size-2)" }}
          >
            Retrying
          </Heading>
          <Paragraph style={{ marginBottom: "2rem" }}>
            Oppgaver i denne listen har feilet, men de har enda ikke nådd
            maksimalt antall forsøk og de vil derfor automatisk bli
            forsøkt igjen senere.
          </Paragraph>

          {tabs.isVisited("retrying") && <Tasks status="Retrying" />}
        </section>
      </Tabs.Panel>
    </Tabs>
  );
}

export default function Home() {
  const tabs = useLazyTabs("search");

  return (
    <>
      <Tabs
        value={tabs.value}
        onChange={tabs.onChange}
        style={{ width: "100%" }}
      >
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
          <Tabs.Tab value="qa">
            <BarChartIcon /> Kvalitet
          </Tabs.Tab>
          <Tabs.Tab value="completion">
            <CheckmarkCircleIcon /> Fullført
          </Tabs.Tab>
          <Tabs.Tab value="backlog">
            <HourglassIcon /> Åpne skifteerklæringer
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="search">
          {tabs.isVisited("search") && <EstateSearch />}
        </Tabs.Panel>
        <Tabs.Panel value="tasks">
          {tabs.isVisited("tasks") && <TaskQueue />}
        </Tabs.Panel>
        <Tabs.Panel value="superadmins">
          {tabs.isVisited("superadmins") && <SuperAdmins />}
        </Tabs.Panel>
        <Tabs.Panel value="secrets">
          {tabs.isVisited("secrets") && <SecretExpiration />}
        </Tabs.Panel>
        <Tabs.Panel value="event-sub">
          {tabs.isVisited("event-sub") && <EventSubs />}
        </Tabs.Panel>
        <Tabs.Panel value="districtcourts">
          {tabs.isVisited("districtcourts") && <DistrictCourts />}
        </Tabs.Panel>
        <Tabs.Panel value="qa">
          {tabs.isVisited("qa") && <QaDashboard />}
        </Tabs.Panel>
        <Tabs.Panel value="completion">
          {tabs.isVisited("completion") && <EstateCompletion />}
        </Tabs.Panel>
        <Tabs.Panel value="backlog">
          {tabs.isVisited("backlog") && <EstateBacklog />}
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
