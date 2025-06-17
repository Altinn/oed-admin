import {
  Heading,
  ValidationMessage,
  Table,
  Tag,
  Skeleton,
} from "@digdir/designsystemet-react";
import type { RoleAssignmentLogResponse } from "../../../types/IEstate";
import { useQuery } from "@tanstack/react-query";
import { formatDate, formatRoleCode } from "../../../utils/formatters";

interface Props {
  estateId: string;
}

export default function RoleLogTable({ estateId }: Props) {
  const { data, isLoading, error } = useQuery<RoleAssignmentLogResponse>({
    queryKey: ["estateRolesLog", estateId],
    queryFn: async () => {
      const response = await fetch(`/api/estate/${estateId}/roleassignmentlog`);
      if (!response.ok) {
        throw new Error("Failed to fetch role assignment log");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return <Skeleton aria-label="Henter roller" />;
  }

  if (error) {
    return (
      <ValidationMessage>
        Det oppstod en feil under henting av rollehistorikk: {error.message}
      </ValidationMessage>
    );
  }

  if (!data || data.roleAssignmentLog.length === 0) {
    return (
      <ValidationMessage data-color="info">
        Ingen rollehistorikk funnet for dette boet.
      </ValidationMessage>
    );
  }

  return (
    <>
      <Heading
        level={2}
        data-size="sm"
        style={{ marginTop: "var(--ds-size-3)" }}
      >
        Rollehistorikk
      </Heading>

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>SSN</Table.HeaderCell>
            <Table.HeaderCell>Rolle</Table.HeaderCell>
            <Table.HeaderCell>Handling</Table.HeaderCell>
            <Table.HeaderCell>Opprettet</Table.HeaderCell>
            <Table.HeaderCell>Begrunnelse</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {data.roleAssignmentLog.map((log) => (
            <Table.Row key={log.id}>
              <Table.Cell>{log.recipientSsn}</Table.Cell>
              <Table.Cell>
                <Tag>{formatRoleCode(log.roleCode)}</Tag>
              </Table.Cell>
              <Table.Cell>{log.action}</Table.Cell>
              <Table.Cell>{formatDate(log.timestamp)}</Table.Cell>
              <Table.Cell>{log.justification || "-"}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  );
}
