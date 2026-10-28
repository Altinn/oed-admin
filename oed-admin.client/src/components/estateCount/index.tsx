import React from "react";
import {
  Breadcrumbs,
  Button,
  Details,
  Dialog,
  EXPERIMENTAL_Suggestion as Suggestion,
  Field,
  Fieldset,
  Heading,
  Input,
  Label,
  Paragraph,
  Switch,
  Table,
  Tag,
} from "@digdir/designsystemet-react";
import { Link } from "react-router-dom";
import { fetchWithMsal } from "../../utils/msalUtils";
import CopyToClipboard from "../copyToClipboard";
import { DownloadIcon } from "@navikt/aksel-icons";
import { buildCsv, csvFileName, downloadCsv } from "./exportCsv";
import { useEstateCountOptionsQuery, type OptionValue } from "../../queries/estateCountQueries";
import {
  useEstateCountProgress,
  type EstateCountFilters,
  type EstateMatch,
  type RunStatus,
} from "./useEstateCountProgress";

const countUrl = "/api/maintenance/estatecount";
const pageSize = 100;

const statusLabels: Record<RunStatus, string> = {
  Idle: "Ikke startet",
  Running: "Kjører",
  Completed: "Fullført",
  Cancelled: "Avbrutt – delvis resultat",
  // A faulted run keeps the hits found before it stopped, just like a cancelled one.
  Faulted: "Feilet – delvis resultat",
};

// Today's date in the browser's time zone, as yyyy-MM-dd for <input type="date">.
const today = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("nb-NO");
const formatTimestamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString("nb-NO") : "–");

// Hoisted: localeCompare with explicit locale options builds a new collator per call, which made
// sorting 20 000 hits take over a second.
const caseNumberCollator = new Intl.Collator("nb", { numeric: true });

// By case number, estates without one last (ordered by id) - spec decision 17.
const byCaseNumber = (a: EstateMatch, b: EstateMatch) => {
  if (a.caseNumber && b.caseNumber) {
    return caseNumberCollator.compare(a.caseNumber, b.caseNumber);
  }
  if (a.caseNumber) return -1;
  if (b.caseNumber) return 1;
  if (a.estateId === b.estateId) return 0;
  return a.estateId < b.estateId ? -1 : 1;
};

type SuggestionItem = { label: string; value: string };

// A filterable multi-select (chips for the selected values), so the 41 heir roles don't push
// "Start telling" off screen. Controlled, so a failed start keeps the selection.
function MultiSelect({
  label,
  options,
  selected,
  onSelectedChange,
}: {
  label: string;
  options: OptionValue[];
  selected: SuggestionItem[];
  onSelectedChange: (items: SuggestionItem[]) => void;
}) {
  return (
    <Field>
      <Label>{label}</Label>
      <Field.Description>Ingen valgt = alle</Field.Description>
      <Suggestion multiple selected={selected} onSelectedChange={onSelectedChange}>
        <Suggestion.Input />
        <Suggestion.Clear aria-label={`Fjern alle valg for ${label.toLowerCase()}`} />
        <Suggestion.List>
          <Suggestion.Empty>Ingen treff</Suggestion.Empty>
          {options.map((option) => (
            <Suggestion.Option key={option.value} value={option.value} label={option.label}>
              {option.label}
            </Suggestion.Option>
          ))}
        </Suggestion.List>
      </Suggestion>
    </Field>
  );
}

const labelsFor = (values: string[], options: OptionValue[] | undefined) =>
  values.length === 0
    ? "Alle"
    : values.map((value) => options?.find((option) => option.value === value)?.label ?? value).join(", ");

// A linked list of hits with its own copy button and paging. Used once per heir-role group and
// once for all hits, so each keeps its own "Vis flere" position. Expects an already sorted list -
// the page sorts once, so the groups never re-sort on a progress tick.
function HitList({ matches: sorted, copyLabel }: { matches: EstateMatch[]; copyLabel: string }) {
  const [visible, setVisible] = React.useState<number>(pageSize);
  const copyValue = React.useMemo(
    () => sorted.map((match) => match.caseNumber ?? match.estateId).join("\n"),
    [sorted],
  );

  return (
    <>
      <CopyToClipboard value={copyValue} displayValue={`${copyLabel} (${sorted.length})`} />
      <ul>
        {sorted.slice(0, visible).map((match) => (
          <li key={match.estateId}>
            <Link to={`/estate/${match.estateId}`}>{match.caseNumber ?? match.estateId}</Link>
          </li>
        ))}
      </ul>
      {sorted.length > visible && (
        <Button variant="tertiary" onClick={() => setVisible((value) => value + pageSize)}>
          Vis flere ({sorted.length - visible} igjen)
        </Button>
      )}
    </>
  );
}

// Key for estates where no heir has a role; never a real role value, which is a URN.
const noHeirRole = "";

// One row per heir role that occurs among the hits, plus "Uten arvingrolle" (decision 21). An
// estate with several roles appears in each of their groups; role counts come from the server so
// they are right even mid-resync.
function HeirRoleGroups({
  heirRoleCounts,
  sortedMatches,
  heirRoles,
}: {
  heirRoleCounts: Record<string, number>;
  sortedMatches: EstateMatch[];
  heirRoles: OptionValue[] | undefined;
}) {
  // Filtering an already sorted list keeps each group sorted. Only recomputed when the hit list
  // changes, not on every one-second progress tick.
  const membersByRole = React.useMemo(() => {
    const byRole = new Map<string, EstateMatch[]>();
    const add = (role: string, match: EstateMatch) => {
      const members = byRole.get(role);
      if (members) members.push(match);
      else byRole.set(role, [match]);
    };
    for (const match of sortedMatches) {
      if (match.heirRoles.length === 0) add(noHeirRole, match);
      for (const role of match.heirRoles) add(role, match);
    }
    return byRole;
  }, [sortedMatches]);

  const noRoleCount = membersByRole.get(noHeirRole)?.length ?? 0;
  const groups = [
    ...Object.entries(heirRoleCounts)
      .map(([role, count]) => ({
        role,
        count,
        // A role missing from the options list is shown by its raw value.
        label: heirRoles?.find((option) => option.value === role)?.label ?? role,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "nb")),
    ...(noRoleCount > 0 ? [{ role: noHeirRole, count: noRoleCount, label: "Uten arvingrolle" }] : []),
  ];

  return (
    <Table data-size="sm">
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Arvingrolle</Table.HeaderCell>
          <Table.HeaderCell>Treff</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {groups.map((group) => (
          <Table.Row key={group.role}>
            <Table.Cell>
              {group.count > 0 ? (
                <Details>
                  <Details.Summary>{group.label}</Details.Summary>
                  <Details.Content>
                    <HitList matches={membersByRole.get(group.role) ?? []} copyLabel="Kopier" />
                  </Details.Content>
                </Details>
              ) : (
                group.label
              )}
            </Table.Cell>
            <Table.Cell>{group.count}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function FilterSummary({
  filters,
  caseStatuses,
}: {
  filters: EstateCountFilters;
  caseStatuses: OptionValue[] | undefined;
}) {
  return (
    <Table data-size="sm">
      <Table.Body>
        <Table.Row>
          <Table.HeaderCell>Opprettet</Table.HeaderCell>
          <Table.Cell>
            {formatDate(filters.createdFrom)} – {formatDate(filters.createdTo)}
          </Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell>Saksstatus</Table.HeaderCell>
          <Table.Cell>{labelsFor(filters.caseStatuses, caseStatuses)}</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.HeaderCell>Gruppert etter arvingroller</Table.HeaderCell>
          <Table.Cell>{filters.groupByHeirRoles ? "Ja" : "Nei"}</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  );
}

export default function EstateCount() {
  const optionsQuery = useEstateCountOptionsQuery();
  const { snapshot, matches, failures, error, connect } = useEstateCountProgress();
  const [statusText, setStatusText] = React.useState<string>("");
  const [visibleFailures, setVisibleFailures] = React.useState<number>(pageSize);
  const [selectedCaseStatuses, setSelectedCaseStatuses] = React.useState<SuggestionItem[]>([]);
  const [groupByHeirRoles, setGroupByHeirRoles] = React.useState<boolean>(false);

  const isRunning = snapshot?.status === "Running";
  const hasResult = snapshot !== null && snapshot.status !== "Idle";
  const isGrouped = snapshot?.filters?.groupByHeirRoles ?? false;

  // Sorted once here, only when the hit list changes; every list on the page reuses it.
  const sortedMatches = React.useMemo(() => [...matches].sort(byCaseNumber), [matches]);

  const handleStart = async (formData: FormData) => {
    const postData = {
      createdFrom: formData.get("createdFrom")?.toString() ?? "",
      createdTo: formData.get("createdTo")?.toString() ?? "",
      caseStatuses: selectedCaseStatuses.map((item) => item.value),
      groupByHeirRoles,
    };

    setStatusText("Starter...");
    let response: Response;
    try {
      response = await fetchWithMsal(countUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
    } catch (startError) {
      setStatusText(`Kunne ikke starte telling: ${startError instanceof Error ? startError.message : String(startError)}`);
      return;
    }

    if (response.status === 202) {
      setStatusText("Telling startet.");
      setVisibleFailures(pageSize);
      // The stream closes whenever the count is not Running, so reopen it now that one is.
      connect();
    } else if (response.status === 409) {
      setStatusText("En telling kjører allerede.");
      // Someone else's count - reconnect so this page shows it instead of the previous result.
      connect();
    } else if (response.status === 400) {
      setStatusText("Ugyldige filtre. Sjekk at fra-dato ikke er etter til-dato.");
    } else {
      setStatusText(`Kunne ikke starte telling (${response.status}).`);
    }
  };

  const handleCancel = async () => {
    setStatusText("Avbryter...");
    try {
      const response = await fetchWithMsal(countUrl, { method: "DELETE" });
      setStatusText(response.status === 202 ? "Avbrudd forespurt." : "Fant ingen kjørende telling.");
    } catch (cancelError) {
      setStatusText(`Kunne ikke avbryte: ${cancelError instanceof Error ? cancelError.message : String(cancelError)}`);
    }
  };

  // A grouped count reads Storage for every estate and blocks everyone else's counts, so it is
  // confirmed first. The form data is held here while the dialog is open.
  const confirmDialogRef = React.useRef<HTMLDialogElement>(null);
  const pendingFormData = React.useRef<FormData | null>(null);

  // onSubmit rather than a form action: React resets an action form's fields when the action
  // finishes, which would wipe the dates and checkboxes after a 400 or 409.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (groupByHeirRoles) {
      pendingFormData.current = formData;
      confirmDialogRef.current?.showModal();
      return;
    }
    void handleStart(formData);
  };

  const handleConfirm = () => {
    // Taken before close(): the dialog's onClose clears it.
    const formData = pendingFormData.current;
    confirmDialogRef.current?.close();
    if (formData) {
      void handleStart(formData);
    }
  };

  const handleDecline = () => {
    confirmDialogRef.current?.close();
    pendingFormData.current = null;
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
        Telling av dødsbo
      </Heading>
      <Paragraph>
        Teller dødsbo som matcher filtrene, og viser saksnumrene. Opprettet-dato og saksstatus
        hentes fra databasen. Grupperes det etter arvingroller, hentes i tillegg skjemadataene til
        hvert dødsbo fra Altinn Storage, og da kan tellingen ta opptil en halvtime. Det kan bare kjøre én
        telling om gangen, og resultatet er synlig for alle administratorer.
      </Paragraph>

      {optionsQuery.isError && (
        <Paragraph data-color="danger">{(optionsQuery.error as Error).message}</Paragraph>
      )}

      <form onSubmit={handleSubmit}>
        <Fieldset>
          <Fieldset.Legend>Ny telling</Fieldset.Legend>

          <Field>
            <Label htmlFor="createdFrom">Opprettet fra</Label>
            <Input id="createdFrom" name="createdFrom" type="date" defaultValue={today()} required />
          </Field>
          <Field>
            <Label htmlFor="createdTo">Opprettet til</Label>
            <Input id="createdTo" name="createdTo" type="date" defaultValue={today()} required />
          </Field>

          <MultiSelect
            label="Saksstatus"
            options={optionsQuery.data?.caseStatuses ?? []}
            selected={selectedCaseStatuses}
            onSelectedChange={setSelectedCaseStatuses}
          />
          <Switch
            label="Grupper etter arvingroller"
            description="Henter skjemadataene til hvert dødsbo fra Altinn Storage. Kan ta opptil en halvtime."
            checked={groupByHeirRoles}
            onChange={(event) => setGroupByHeirRoles(event.target.checked)}
          />

          <Button type="submit" disabled={isRunning || !optionsQuery.data}>
            Start telling
          </Button>
        </Fieldset>
      </form>

      <Dialog ref={confirmDialogRef} closedby="any" onClose={() => (pendingFormData.current = null)}>
        <Heading level={2} data-size="sm" style={{ marginBottom: "var(--ds-size-2)" }}>
          Telling med gruppering etter arvingroller
        </Heading>
        <Paragraph>
          Skjemadataene til hvert dødsbo i utvalget hentes fra Altinn Storage, med to kall per
          dødsbo. Det gjør tellingen tung:
        </Paragraph>
        <ul>
          <li>
            For hele perioden fra 01.01.2024 og ingen saksstatus valgt er det rundt 20 000 dødsbo
            og 40 000 kall, og tellingen kan ta opptil en halvtime.
          </li>
          <li>Mens den kjører, kan ingen andre administratorer starte en telling.</li>
          <li>Resultatet, med saksnumrene, blir synlig for alle administratorer.</li>
          <li>
            Den kan avbrytes underveis, og da beholdes treffene så langt. Startes appen på nytt,
            går tellingen tapt.
          </li>
        </ul>
        <Paragraph>Avgrens perioden eller saksstatus for å gjøre tellingen raskere.</Paragraph>
        <div style={{ display: "flex", gap: "var(--ds-size-2)", marginTop: "var(--ds-size-4)" }}>
          <Button onClick={handleConfirm}>Start telling</Button>
          <Button variant="secondary" onClick={handleDecline}>
            Avbryt
          </Button>
        </div>
      </Dialog>

      {isRunning && (
        <Button variant="secondary" data-color="danger" onClick={handleCancel}>
          Avbryt
        </Button>
      )}

      <Paragraph>{statusText}</Paragraph>
      {error && (
        <>
          <Paragraph data-color="danger">Statusstrøm: {error}</Paragraph>
          <Button variant="secondary" onClick={connect}>
            Koble til på nytt
          </Button>
        </>
      )}

      {hasResult && snapshot && (
        <>
          <Heading level={2} data-size="md">
            Status:{" "}
            <Tag data-color={isRunning ? "info" : snapshot.status === "Faulted" ? "danger" : "neutral"}>
              {statusLabels[snapshot.status]}
            </Tag>
          </Heading>
          {snapshot.error && <Paragraph data-color="danger">Feil: {snapshot.error}</Paragraph>}

          <Paragraph>
            Startet av {snapshot.startedBy ?? "ukjent"} · {formatTimestamp(snapshot.startedAt)} –{" "}
            {formatTimestamp(snapshot.endedAt)}
          </Paragraph>
          {snapshot.filters && (
            <FilterSummary
              filters={snapshot.filters}
              caseStatuses={optionsQuery.data?.caseStatuses}
            />
          )}

          {isRunning && (
            <>
              <Paragraph>
                {snapshot.processed} av {snapshot.total} behandlet
              </Paragraph>
              <progress value={snapshot.processed} max={Math.max(snapshot.total, 1)} />
            </>
          )}

          <Heading level={2} data-size="lg">
            {snapshot.matchCount} treff
          </Heading>

          {/* Only once the count has ended, so the file is a complete record of the run. */}
          {!isRunning && (matches.length > 0 || failures.length > 0) && (
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  csvFileName(snapshot),
                  buildCsv(snapshot, sortedMatches, failures, optionsQuery.data?.heirRoles),
                )
              }
            >
              <DownloadIcon aria-hidden />
              Last ned som CSV
            </Button>
          )}

          {isGrouped && (
            <HeirRoleGroups
              heirRoleCounts={snapshot.heirRoleCounts}
              sortedMatches={sortedMatches}
              heirRoles={optionsQuery.data?.heirRoles}
            />
          )}

          {matches.length > 0 && (
            <Details>
              <Details.Summary>
                {isGrouped ? `Alle treff (${snapshot.matchCount} unike)` : "Vis saksnummer"}
              </Details.Summary>
              <Details.Content>
                <HitList matches={sortedMatches} copyLabel="Kopier alle" />
              </Details.Content>
            </Details>
          )}

          {failures.length > 0 && (
            <Details>
              <Details.Summary>{snapshot.failureCount} kunne ikke sjekkes</Details.Summary>
              <Details.Content>
                <Table data-size="sm">
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Dødsbo</Table.HeaderCell>
                      <Table.HeaderCell>Årsak</Table.HeaderCell>
                      <Table.HeaderCell>Detaljer</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {failures.slice(0, visibleFailures).map((failure) => (
                      <Table.Row key={failure.estateId}>
                        <Table.Cell>
                          <Link to={`/estate/${failure.estateId}`}>{failure.estateId}</Link>
                        </Table.Cell>
                        <Table.Cell>{failure.reason}</Table.Cell>
                        <Table.Cell>{failure.detail}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
                {failures.length > visibleFailures && (
                  <Button variant="tertiary" onClick={() => setVisibleFailures((value) => value + pageSize)}>
                    Vis flere ({failures.length - visibleFailures} igjen)
                  </Button>
                )}
              </Details.Content>
            </Details>
          )}
        </>
      )}
    </>
  );
}
