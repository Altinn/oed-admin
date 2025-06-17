import { useState } from "react";
import {
  Field,
  Fieldset,
  Heading,
  Search,
  Skeleton,
  ToggleGroup,
} from "@digdir/designsystemet-react";
import EstateCard from "./estateCard";
import { PersonIcon, RobotIcon } from "@navikt/aksel-icons";
import { useMutation } from "@tanstack/react-query";
import type { RequestBody, ResponseBody } from "../types/IEstate";

const getEstateData = async (body: RequestBody) => {
  try {
    const response = await fetch("/api/estate/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("noe gikk galt");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching estate data:", error);
  }
};

export default function Home() {
  const [searchType, setSearchType] = useState("partyid");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [data, setData] = useState<ResponseBody | null>(null);

  const mutation = useMutation({
    mutationKey: ["estates"],
    mutationFn: getEstateData,
  });

  const handleSearch = async () => {
    const body: RequestBody = {
      Nin: searchType === "ssn" ? searchQuery : undefined,
      PartyId: searchType === "partyid" ? parseInt(searchQuery) : undefined,
    };

    const result = await mutation.mutateAsync(body);
    if (result) {
      setData(result);
    }
  };

  const handleReset = () => {
    setSearchQuery("");
    setData(null);
  };

  return (
    <>
      <Heading level={2} data-size="xl">
        Søk etter dødsbo
      </Heading>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <Fieldset data-color="neutral" className="search-fieldset">
          <Fieldset.Legend>
            Søk etter dødsbo med partyid eller fødselsnummer
          </Fieldset.Legend>
          <Fieldset.Description>
            Du kan søke etter dødsbo ved å bruke enten party ID eller
            fødselsnummer. Velg ønsket søkemodus og skriv inn søketermen i
            feltet under.
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
              <Search.Input
                aria-label="Søk"
                onChange={(e) => setSearchQuery(e.target.value)}
                pattern="^[0-9]+$"
              />
              <Search.Clear onClick={handleReset} />
              <Search.Button />
            </Search>
          </Field>
        </Fieldset>
      </form>

      <section className="card-grid">
        {mutation.isPending && (
          <>
            <Heading
              data-size="xs"
              style={{ marginBottom: "var(--ds-size-4)" }}
            >
              <Skeleton variant="text" width={30} />
            </Heading>
            <ul>
              {Array.from({ length: 3 }).map((_, index) => (
                <li key={index}>
                  <Skeleton variant="rectangle" height={240} />
                </li>
              ))}
            </ul>
          </>
        )}

        {data && data?.estates?.length > 0 && (
          <>
            <Heading
              level={2}
              data-size="xs"
              style={{ paddingBottom: "var(--ds-size-2)" }}
            >
              Søkeresultater
            </Heading>

            <ul>
              {data?.estates.map((estate, index) => (
                <li key={index}>
                  <EstateCard estate={estate} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
