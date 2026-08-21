import React from "react";
import {
  Breadcrumbs,
  Button,
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
import { useMigrationProgress, type MigrationFailure } from "./useMigrationProgress";

const migrationUrl = "/api/maintenance/declarationpdfmigration";
const failurePageSize = 100;

export default function DeclarationPdfMigration() {
  const { snapshot, failures, error, connect } = useMigrationProgress();
  const [statusText, setStatusText] = React.useState<string>("");
  const [reasonFilter, setReasonFilter] = React.useState<string>("");
  const [visibleFailures, setVisibleFailures] = React.useState<number>(failurePageSize);

  const isRunning = snapshot?.status === "Running";

  const handleStart = async (formData: FormData) => {
    const rawLimit = formData.get("limit")?.toString().trim();
    const postData = {
      limit: rawLimit ? Number(rawLimit) : null,
      overwrite: formData.get("overwrite") ? true : false,
      dryRun: formData.get("dryRun") ? true : false,
    };

    setStatusText("Starter...");
    const response = await fetchWithMsal(migrationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postData),
    });

    if (response.status === 202) {
      setStatusText(`Migrering startet: ${JSON.stringify(postData)}`);
      setVisibleFailures(failurePageSize);
      setReasonFilter("");
      // The stream closes whenever the run is not Running, so reopen it now that one is.
      connect();
    } else if (response.status === 409) {
      setStatusText("En migrering kjører allerede.");
    } else if (response.status === 400) {
      setStatusText("Ugyldige parametere. Antall dødsbo må være større enn 0.");
    } else {
      setStatusText(`Kunne ikke starte migrering (${response.status}).`);
    }
  };

  const handleCancel = async () => {
    setStatusText("Avbryter...");
    const response = await fetchWithMsal(migrationUrl, { method: "DELETE" });
    setStatusText(
      response.status === 202 ? "Avbrudd forespurt." : "Fant ingen kjørende migrering.",
    );
  };

  const reasons = Array.from(new Set(failures.map((failure) => failure.reason))).sort();
  const filtered: MigrationFailure[] = reasonFilter
    ? failures.filter((failure) => failure.reason === reasonFilter)
    : failures;

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
        Migrering av skifteerklæring (PDF)
      </Heading>
      <Paragraph>
        Kopierer skifteerklæringen (PDF) fra oed-declaration-instansen til oed-instansen for alle
        dødsbo med innsendt skifteerklæring. Kjøringen er trygg å gjenta: bo som allerede er
        migrert rapporteres som <code>AlreadyMigrated</code> uten at noe skrives på nytt.
      </Paragraph>

      <form action={handleStart}>
        <Fieldset>
          <Fieldset.Legend>Start en kjøring</Fieldset.Legend>
          <Field>
            <Label htmlFor="limit">Maks antall dødsbo (tomt = alle)</Label>
            <Input id="limit" name="limit" type="number" min={1} />
          </Field>
          <Switch
            label="Tørrkjøring"
            description="Tell opp hvor mange dødsbo som velges, uten å kalle oed-tjenesten."
            defaultChecked={false}
            value="dryRun"
            name="dryRun"
          />
          <Switch
            label="Overskriv"
            description="Erstatt PDF-en på oed-instansen dersom den allerede finnes. Brukes kun for å reparere en feilaktig kopi."
            defaultChecked={false}
            value="overwrite"
            name="overwrite"
          />
          <Button type="submit" disabled={isRunning}>
            Start migrering
          </Button>
        </Fieldset>
      </form>

      {isRunning && (
        <Button variant="secondary" data-color="danger" onClick={handleCancel}>
          Avbryt kjøringen
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

      {snapshot && (
        <>
          <Heading level={2} data-size="md">
            Status: <Tag data-color={isRunning ? "info" : "neutral"}>{snapshot.status}</Tag>
          </Heading>
          {snapshot.error && <Paragraph data-color="danger">Feil: {snapshot.error}</Paragraph>}
          <Paragraph>
            {snapshot.processed} av {snapshot.total} behandlet
            {snapshot.dryRun ? " (tørrkjøring)" : ""}
          </Paragraph>
          <progress value={snapshot.processed} max={Math.max(snapshot.total, 1)} />

          <Table data-size="sm">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Utfall</Table.HeaderCell>
                <Table.HeaderCell>Antall</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {Object.entries(snapshot.outcomes).map(([key, count]) => (
                <Table.Row key={key}>
                  <Table.Cell>{key}</Table.Cell>
                  <Table.Cell>{count}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </>
      )}

      {failures.length > 0 && (
        <>
          <Heading level={2} data-size="md">
            Feil ({failures.length})
          </Heading>
          <Field>
            <Label htmlFor="reasonFilter">Filtrer på årsak</Label>
            <select
              id="reasonFilter"
              value={reasonFilter}
              onChange={(event) => {
                setReasonFilter(event.target.value);
                setVisibleFailures(failurePageSize);
              }}
            >
              <option value="">Alle</option>
              {reasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </Field>

          <Table data-size="sm">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Dødsbo</Table.HeaderCell>
                <Table.HeaderCell>Årsak</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Detaljer</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {filtered.slice(0, visibleFailures).map((failure, index) => (
                <Table.Row key={`${failure.estateId}-${failure.reason}-${index}`}>
                  <Table.Cell>
                    <Link to={`/estate/${failure.estateId}`}>{failure.estateId}</Link>
                  </Table.Cell>
                  <Table.Cell>{failure.reason}</Table.Cell>
                  <Table.Cell>{failure.status}</Table.Cell>
                  <Table.Cell>{failure.detail}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {filtered.length > visibleFailures && (
            <Button
              variant="tertiary"
              onClick={() => setVisibleFailures((value) => value + failurePageSize)}
            >
              Vis flere ({filtered.length - visibleFailures} igjen)
            </Button>
          )}
        </>
      )}
    </>
  );
}
