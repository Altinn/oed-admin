import {
  ValidationMessage,
  Table,
  Tag,
  Skeleton,
} from "@digdir/designsystemet-react";
import { useQuery } from "@tanstack/react-query";
import type { RoleAssignmentsResponse } from "../../../types/IEstate";
import { formatDateTime, formatRoleCode } from "../../../utils/formatters";

interface Props {
  estateId: string;
}

export default function RoleTable({ estateId }: Props) {
  const { data, isLoading, error } = useQuery<RoleAssignmentsResponse>({
    queryKey: ["estateRoles", estateId],
    queryFn: async () => {
      const response = await fetch(`/api/estate/${estateId}/roleassignments`);
      if (!response.ok) {
        throw new Error("Failed to fetch estate roles");
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
        Det oppstod en feil under henting av roller: {error.message}
      </ValidationMessage>
    );
  }

  if (!data || data.roleAssignments.length === 0) {
    return (
      <ValidationMessage data-color="info">
        Ingen roller funnet for dette boet.
      </ValidationMessage>
    );
  }

  return (
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>SSN</Table.HeaderCell>
          <Table.HeaderCell>Rolle</Table.HeaderCell>
          <Table.HeaderCell>Opprettet</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {data.roleAssignments.map((role) => (
          <Table.Row key={role.id}>
            <Table.Cell>{role.recipientSsn}</Table.Cell>
            <Table.Cell>
              <Tag>{formatRoleCode(role.roleCode)}</Tag>
            </Table.Cell>
            <Table.Cell>
              {role.created ? formatDateTime(role.created) : "-"}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
