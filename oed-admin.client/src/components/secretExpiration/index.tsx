import { useQuery } from "@tanstack/react-query";
import { Heading, Table, Skeleton } from "@digdir/designsystemet-react";
import { formatDateTimeLocal } from "../../utils/formatters";
import { fetchWithMsal } from "../../utils/msalUtils";

interface KvSecret {
  vaultName: string;
  name: string;
  created: string;
  validFrom: string;
  expires: string;
}

export default function SecretExpiration() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["secretExpiration"],
    queryFn: async () => {
      const response = await fetchWithMsal("/api/secrets");
      if (!response.ok) {
        throw new Error("Failed to fetch instance");
      }
      return response.json();
    },
  });

  function isExpiringSoonOrExpired(dateString?: string): boolean {
    if (!dateString) return false;

    const now = new Date();
    const expiry = new Date(dateString);

    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    return diffDays < 7; // enten passert (negativ) eller < 7 dager frem i tid
  }

  return (
    <>
      <Heading level={2} data-size="xl">
        Secrets
      </Heading>
      {isLoading && (
        <Skeleton variant="rectangle" aria-label="Henter verdier" />
      )}
      {error && (
        <>
          <h3>Det har oppstått en feil!</h3>
        </>
      )}
      {data && (
        <>
          <div>
            Liste over hemmeligheter med utløpsdato og der utløpte eller snart
            utløpte hemmeligheter vises i{" "}
            <span style={{ backgroundColor: "#ffe5e5", color: "red" }}>rødt</span>.
          </div>
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Vault navn</Table.HeaderCell>
                <Table.HeaderCell>Nøkkel</Table.HeaderCell>
                <Table.HeaderCell>Opprettet</Table.HeaderCell>
                <Table.HeaderCell>Utløp</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {data.map((secret: KvSecret, i: number) => {
                const isCritical = isExpiringSoonOrExpired(secret.expires);

                return (
                  <Table.Row
                    key={i}
                    style={{
                      backgroundColor: isCritical ? "#ffe5e5" : undefined, // lys rød bakgrunn
                      color: isCritical ? "red" : undefined, // tekst i rødt
                    }}
                  >
                    <Table.Cell>
                      {secret.vaultName
                        .replace("https://", "")
                        .replace(".vault.azure.net/", "")}
                    </Table.Cell>
                    <Table.Cell>{secret.name}</Table.Cell>
                    <Table.Cell>
                      {
                        formatDateTimeLocal(new Date(secret.created)).split(
                          "T"
                        )[0]
                      }
                    </Table.Cell>
                    <Table.Cell>
                      {
                        formatDateTimeLocal(new Date(secret.expires)).split(
                          "T"
                        )[0]
                      }
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </>
      )}
    </>
  );
}
