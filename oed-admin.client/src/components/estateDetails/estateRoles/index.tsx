import {
  Spinner,
  Table,
  Tag,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

interface Props {
  estateId: string;
}

interface RoleAssignment {
  id: number;
  roleCode: string;
  estateSsn: string;
  heirSsn?: string;
  recipientSsn: string;
  created: string;
  justification?: string;
}

interface RoleAssignmentsResponse {
  roleAssignments: RoleAssignment[];
}

export default function EstateRoles({ estateId }: Props) {
  const location = useLocation();
  const id = estateId || location.pathname.split("/").pop() || "";

  const { data, isLoading, error } = useQuery<RoleAssignmentsResponse>({
    queryKey: ["estateRoles", id],
    queryFn: async () => {
      const response = await fetch(`/api/estate/${id}/roleassignments`);
      if (!response.ok) {
        throw new Error("Failed to fetch estate roles");
      }
      return response.json();
    },
  });

  const formatRoleCode = (roleCode: string) => {
    return roleCode.split(":").pop();
  };

  if (isLoading) {
    return <Spinner data-size="md" aria-label="Henter roller" />;
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
    <>
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
                {new Intl.DateTimeFormat("nb").format(new Date(role.created))}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  );
}
