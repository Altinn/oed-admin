import { Field, Fieldset, Heading, Link, Search } from "@digdir/designsystemet-react";
import EstateRestrictedCard from "./estateRestrictedCard";
import { fetchWithMsal, hasRole } from "../utils/msalUtils";
import type { MinimalEstate, MinimalSearchResponse } from "../types/IEstate";
import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo } from "@azure/msal-browser";

const RestrictedHome = () => {
  const [estate, setEstate] = useState<MinimalEstate>();
  const [loadingEstate, setLoadingEstate] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const { instance } = useMsal();
  const account = instance.getActiveAccount() as AccountInfo;
  const isAdmin = hasRole(account, "Admin");

  const handleSearch = async () => {
    // TODO: Implement search functionality with only one search result
    const searchInput = document.getElementById(
      "search-input"
    ) as HTMLInputElement;
    if (searchInput.value.length === 11) {
      setLoadingEstate(true);
      setHasSearched(true);
      const response = await fetchWithMsal(`/api/estate/minimalsearch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nin: searchInput.value }),
      });

      if (!response.ok) {
        setLoadingEstate(false);
        throw new Error("noe gikk galt");
      }

      const data = await response.json() as MinimalSearchResponse;
      if (data.estate) {
        data.estate.heirs.map(heir => heir.birthdate = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short' })
          .format(new Date(heir.birthdate)));
        setEstate(data.estate);
      }
      setLoadingEstate(false);
    }
  };

  const handleReset = () => {
    const searchInput = document.getElementById(
      "search-input"
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.value = "";
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "600px", margin: "auto" }}>
      <Heading level={1} data-size="xl" style={{ paddingBottom: 'var(--ds-size-3)' }}>
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
            <br />
            {isAdmin && <Link href="/">Tilbake til admin siden</Link>}
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
        <Heading level={2} data-size="md" style={{ paddingBottom: 'var(--ds-size-2)' }}>
          Søkeresultat
        </Heading>
        {loadingEstate && !estate && <p>Søker etter dødsbo...</p>}
        {hasSearched && !loadingEstate && !estate && <p>Ingen gyldig søkeresultat.</p>}
        {estate && <EstateRestrictedCard estate={estate!} />}
      </section>
    </div>
  );
};

export default RestrictedHome;
