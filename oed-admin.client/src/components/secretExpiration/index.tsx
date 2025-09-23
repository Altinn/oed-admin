import { useQuery } from "@tanstack/react-query";
import { Heading, Table, Skeleton } from "@digdir/designsystemet-react";
import { formatDateTimeLocal, isValidDate, isValidDateTime } from "../../utils/formatters";

interface KvSecret {
    vaultName: string,
    name: string,
    created: string,
    validFrom: string,
    expires: string

}

export default function SecretExpiration() {
    // const data = [] as Array<KvSecret>;
    const { data,isLoading, error } = useQuery({
        queryKey: ["secretExpiration"],
        queryFn: async () => {
            const response = await fetch("/api/secrets");
            if (!response.ok) {
                throw new Error("Failed to fetch instance");
            }
            return response.json();
        },
    });

    return (
        <>
            <Heading level={2} data-size="xl">
                Secrets
            </Heading>
            {isLoading && (
                <Skeleton variant="rectangle" aria-label="Henter verdier" />
            )}
            {error &&(
                <h3>Feil!!!!</h3>
            )}
            {data &&(
            <Table>
                <Table.Head>
                    <Table.Row>
                        <Table.HeaderCell>Vault name</Table.HeaderCell>
                        <Table.HeaderCell>Key</Table.HeaderCell>
                        <Table.HeaderCell>Created</Table.HeaderCell>
                        <Table.HeaderCell>Expiration</Table.HeaderCell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {data && data.map((secret: KvSecret, i: number) => (
                        <Table.Row key={i}>
                            <Table.Cell>{secret.vaultName.replace("https://", "").replace(".vault.azure.net/", "")}</Table.Cell>
                            <Table.Cell>{secret.name}</Table.Cell>
                            <Table.Cell>{formatDateTimeLocal(new Date(secret.created)).split("T")[0]}</Table.Cell>
                            <Table.Cell>{formatDateTimeLocal(new Date(secret.expires)).split("T")[0]}</Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
            )}
        </>
    );
}