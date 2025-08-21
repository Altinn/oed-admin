import React, { useEffect, useRef, useState } from "react";
import type { RequestBody, ResponseBody } from "../../types/IEstate";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { Button, Field, Fieldset, Heading, Search, Skeleton, ToggleGroup, ValidationMessage } from "@digdir/designsystemet-react";
import { GavelIcon, PersonGroupIcon, PersonIcon, RobotIcon, TagIcon } from "@navikt/aksel-icons";
import EstateCard from "../estateCard";

const estateKeys = {
  all: ['estates'] as const,
  search: (params: RequestBody, pageSize: number, page: number) => [...estateKeys.all, params, pageSize, page],
  searchWithInfiniteScroll: (params: RequestBody) => [...estateKeys.all, params],
}

const fetchEstates = async (pageParam : EstatePageParam) => {
  const response = await fetch(`/api/estate/search?pageSize=${pageParam.pageSize}&page=${pageParam.page}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pageParam.body),
    });

    if (!response.ok) {
      throw new Error("noe gikk galt");
    }

    return response.json();
};

type EstatePageParam = {
  body: RequestBody | undefined, 
  pageSize: number,
  page: number 
};

type SubmittedSearch = {
  type: string,
  query: string,
}

export default function EstateSearch() {
  const pageSize = 8;
  const [searchType, setSearchType] = useState("partyid");
  const [searchQuery, setSearchQuery] = useState<string>("1");
  const [submittedSearch, setSubmittedSearch] = useState<SubmittedSearch>();
  
  const listRef = useRef(null);

  const body: RequestBody = {
      Nin: submittedSearch?.type === "ssn" && submittedSearch?.query ? submittedSearch.query : undefined,
      HeirNin: submittedSearch?.type === "heir" && submittedSearch?.query ? submittedSearch.query : undefined,
      PartyId: submittedSearch?.type === "partyid" && submittedSearch?.query ? parseInt(submittedSearch.query) : undefined,
      CaseNumber: submittedSearch?.type === "casenumber" && submittedSearch?.query ? submittedSearch.query : undefined,
      Name: submittedSearch?.type === "name" && submittedSearch?.query ? submittedSearch.query : undefined,
    };
 
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status
  } = useInfiniteQuery<ResponseBody, Error, InfiniteData<ResponseBody, unknown>, readonly unknown[], EstatePageParam>({
    retry: false,
    enabled: submittedSearch !== undefined,
    queryKey: estateKeys.searchWithInfiniteScroll(body),
    queryFn: ({ pageParam }) => fetchEstates(pageParam),
    initialPageParam: { body: body, pageSize: pageSize, page: 1 } as EstatePageParam,
    getNextPageParam: (lastPage) => { 
      if (!lastPage?.estates) return null;
      if (lastPage.estates.length < pageSize) return null;
      return { body, pageSize: lastPage?.pageSize || pageSize, page: lastPage ? lastPage.page + 1 : 1 } as EstatePageParam 
    },
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.0 } 
    );

    if (listRef.current) {
      observer.observe(listRef.current);
    }

    return () => {
      if (listRef.current) {
        observer.unobserve(listRef.current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSearch = async () => {
    await setSubmittedSearch({type: searchType, query: searchQuery});
  };

  const handleReset = () => {
    setSearchQuery("");
    setSubmittedSearch(undefined);
  };

  const getInputPattern = (searchType: string): string => {
    switch (searchType) {
      case "ssn":
      case "heir":
        return "^([0-9]{6}|[0-9]{11})$";
      case "partyid":
        return "^[0-9]+$";
      default:
        return "^.*$";
    }
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
              <ToggleGroup.Item value="casenumber">
                <GavelIcon aria-hidden />
                Saksnummer
              </ToggleGroup.Item>
              <ToggleGroup.Item value="name">
                <TagIcon aria-hidden />
                Navn
              </ToggleGroup.Item>
              <ToggleGroup.Item value="heir">
                <PersonGroupIcon aria-hidden />
                Arving
              </ToggleGroup.Item>
            </ToggleGroup>
          </Field>

          <Field>
            <Search data-size="lg" className="search-field">
              <Search.Input
                aria-label="Søk"
                onChange={(e) => setSearchQuery(e.target.value)}
                pattern={getInputPattern(searchType)}
              />
              <Search.Clear onClick={handleReset} />
              <Search.Button />
            </Search>
          </Field>
        </Fieldset>
      </form>

      <section className="card-grid">
        {error && (
          <ValidationMessage>
            Det oppstod en feil under henting av skifteerklæring:
            {error.message}
          </ValidationMessage>
        )}
        
        {isFetching && !isFetchingNextPage && (
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

        {status === "success" && data?.pages.length > 0 &&  data?.pages[0]?.estates?.length > 0 && (
          <>
           <Heading
              level={2}
              data-size="xs"
              style={{ padding: "1rem 0" }}
            >
              Søkeresultater
            </Heading>
            <ul>
              {data?.pages && data.pages.map((group, i) => 
                <React.Fragment key={i}> 
                  {group?.estates && group?.estates?.length > 0 && (
                    <>
                      {group.estates.map((estate, index) => (
                        <li key={index}>
                          <EstateCard estate={estate} />
                        </li>
                      ))}
                    </>
                  )}
                </React.Fragment>          
              )}
            </ul>
          </>
        )}
      </section>
      <div ref={listRef} style={{marginTop: "2rem"}}>
        {hasNextPage && (
          <Button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetching}>
            {isFetchingNextPage
              ? 'Laster flere...'
              : hasNextPage
                ? 'Last flere'
                : 'Ikke mer å laste'}
          </Button >
        )}
      </div>
    </>
  );
}