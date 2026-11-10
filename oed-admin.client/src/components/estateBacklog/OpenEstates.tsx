import { useEffect, useRef } from "react";
import { Button, Heading, Paragraph, Skeleton, ValidationMessage } from "@digdir/designsystemet-react";
import EstateCard from "../estateCard";
import { useOpenDeclarationEstatesQuery } from "../../queries/statisticsQueries";

// The estates behind the backlog count, in the same card grid as the estate search. `to` is the
// moment they must have been open at; undefined means now.
export default function OpenEstates({ to }: { to?: string }) {
  const { data, error, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage } =
    useOpenDeclarationEstatesQuery(to);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Loads the next page when the bottom of the grid scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const estates = data?.pages.flatMap((page) => page.estates) ?? [];

  return (
    <>
      <section className="card-grid">
        <Heading level={3} data-size="xs" style={{ padding: "1rem 0" }}>
          Dødsbo med åpen skifteerklæring
        </Heading>

        {error && (
          <ValidationMessage>Det oppstod en feil under henting av dødsbo: {error.message}</ValidationMessage>
        )}

        {isLoading && (
          <ul>
            {Array.from({ length: 3 }).map((_, index) => (
              <li key={index}>
                <Skeleton variant="rectangle" height={240} />
              </li>
            ))}
          </ul>
        )}

        {data && estates.length === 0 && <Paragraph>Ingen dødsbo.</Paragraph>}

        {estates.length > 0 && (
          <ul>
            {estates.map((estate) => (
              <li key={estate.id}>
                <EstateCard estate={estate} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <div ref={sentinelRef} style={{ marginTop: "2rem" }}>
        {hasNextPage && (
          <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Laster flere..." : "Last flere"}
          </Button>
        )}
      </div>
    </>
  );
}
