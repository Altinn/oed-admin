import React, { useState } from "react";
import {
  Field,
  Fieldset,
  Heading,
  Search,
  ToggleGroup,
} from "@digdir/designsystemet-react";
import DeceasedCard from "./deceasedCard";
import { PersonIcon, RobotIcon } from "@navikt/aksel-icons";

export default function Home() {
  const [searchType, setSearchType] = useState<string>("partyid");

  const deceasedJson = [
    {
      name: "Ola Nordmann",
      partyId: "123456789",
      ssn: "01010112345",
      deathDate: new Date(),
      status: "Opprettet",
    },
    {
      name: "Kari Nordmann",
      partyId: "987654321",
      ssn: "02020298765",
      deathDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      status: "Erklæring opprettet",
    },
    {
      name: "Per Hansen",
      partyId: "1122334455",
      ssn: "03030311223",
      deathDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      status: "Erklæring innsendt",
    },
    {
      name: "Anne Jensen",
      partyId: "5566778899",
      ssn: "04040455667",
      deathDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      status: "Skifteattest mottatt",
    },
  ];

  return (
    <>
      <Heading level={2} data-size="xl">
        Søk etter dødsbo
      </Heading>

      <Fieldset data-color="neutral" className="search-fieldset">
        <Fieldset.Legend>
          Søk etter dødsbo med partyid eller fødselsnummer
        </Fieldset.Legend>
        <Fieldset.Description>
          Du kan søke etter dødsbo ved å bruke enten party ID eller
          fødselsnummer. Velg ønsket søkemodus og skriv inn søketermen i feltet
          under.
        </Fieldset.Description>

        <Field>
          <ToggleGroup
            value={searchType}
            defaultValue="partyid"
            name="toggle-group-search"
            onChange={setSearchType}
          >
            <ToggleGroup.Item value="partyid">
              <RobotIcon aria-hidden /> Party ID
            </ToggleGroup.Item>
            <ToggleGroup.Item value="ssn">
              <PersonIcon aria-hidden />
              Fødselsnummer
            </ToggleGroup.Item>
          </ToggleGroup>
        </Field>

        <Field>
          <Search data-size="lg" className="search-field">
            <Search.Input aria-label="Søk" />
            <Search.Clear />
            <Search.Button />
          </Search>
        </Field>
      </Fieldset>

      <section className="card-grid">
        <Heading
          level={2}
          data-size="sm"
          style={{ paddingBottom: "var(--ds-size-2)" }}
        >
          Søkeresultater
        </Heading>
        <ul>
          {deceasedJson.map((deceased, index) => (
            <li key={index}>
              <DeceasedCard deceased={deceased} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
