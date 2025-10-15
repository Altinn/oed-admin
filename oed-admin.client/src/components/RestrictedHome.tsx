import React from "react";
import { Field, Fieldset, Heading, Search } from "@digdir/designsystemet-react";
import EstateRestrictedCard from "./estateRestrictedCard";

const RestrictedHome = () => {
  const handleSearch = () => {
    // TODO: Implement search functionality with only one search result
  };

  const handleReset = () => {
    const searchInput = document.getElementById(
      "search-input"
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.value = "";
    }
  };

  // TODO: Replace with real search result
  const testEstate = {
    id: "1",
    deceasedName: "Ola Nordmann",
    dateOfDeath: "2023-01-01",
    deceasedPartyId: 123456789,
    deceasedNin: "01010112345",
    caseStatus: "MOTTATT",
    status: "FirstHeirReceived",
    districtCourtName: "Oslo tingrett",
    caseNumber: "23-123456",
    instanceId: "instance-1",
    created: "2023-01-01T00:00:00Z",
    firstHeirReceived: "2023-01-02T00:00:00Z",
  };

  return (
    <div style={{ width: "100%", maxWidth: "600px", margin: "auto" }}>
      <Heading level={1} data-size="xl" style={{ paddingBottom: 'var(--ds-size-3)'}}>
        Søk etter dødsbo
      </Heading>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <Fieldset data-color="neutral" className="search-fieldset">
          <Fieldset.Description>
            Du kan søke etter dødsbo ved å bruke fødselsnummer (11 siffer) til den avdøde.
          </Fieldset.Description>

          <Field>
            <Search data-size="lg" className="search-field">
              <Search.Input
                id="search-input"
                aria-label="Søk"
                pattern="\d{11}"
              />
              <Search.Clear onClick={handleReset} />
              <Search.Button />
            </Search>
          </Field>
        </Fieldset>
      </form>
      <section style={{ marginTop: "2rem" }}>
        <Heading level={2} data-size="md" style={{ paddingBottom: 'var(--ds-size-2)'}}>
          Søkeresultat
        </Heading>
        <EstateRestrictedCard estate={testEstate}  />
      </section>
    </div>
  );
};

export default RestrictedHome;
