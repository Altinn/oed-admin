import React from "react";
import {
  Button,
  Divider,
  Heading,
  Skeleton,
  Table,
  Tag,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { LeaveIcon } from "@navikt/aksel-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoleAssignmentsResponse } from "../../types/IEstate";
import { formatDateTime, formatRoleCode } from "../../utils/formatters";

export default function SuperAdmins() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<RoleAssignmentsResponse>({
    queryKey: ["superadmins"],
    queryFn: async () => {
      const response = await fetch(`/api/superadmins`);
      if (!response.ok) {
        throw new Error("Failed to fetch super admins");
      }
      return response.json();
    },
  });

  const superadminMutationFn = async (nin: string) => {
    const response = await fetch(`/api/superadmins/`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Nin": nin
      },
    });

    if (!response.ok) {
      const errorMessage = "Failed to remove admin access";
      throw new Error(errorMessage);
    }
    return response.json();
  };

  const removeMutation = useMutation({
    mutationKey: ["remove-superadmin"],
    mutationFn: (nin: string) =>
      superadminMutationFn(nin),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["superadmins"],
      });
    },
    onError: (error) => {
      console.error("Error removing admin access:", error);
    },
  });

  if (isLoading) {
    return <Skeleton aria-label="Henter roller" />;
  }

  if (error) {
    return (
      <ValidationMessage>
        Det oppstod en feil under henting av super admins
      </ValidationMessage>
    );
  }

  if (!data || data.roleAssignments.length === 0) {
    return (
      <ValidationMessage data-color="info">
        Ingen super admins funnet.
      </ValidationMessage>
    );
  }
  return (
    <>
      <Heading level={2} data-size="xl">
        Super admins
      </Heading>

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>SSN</Table.HeaderCell>
            <Table.HeaderCell>Rolle</Table.HeaderCell>
            <Table.HeaderCell>Opprettet</Table.HeaderCell>
            <Table.HeaderCell>Action</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {data.roleAssignments.map((role) => (
            <Table.Row key={role.id}>
              <Table.Cell>{role.recipientSsn}</Table.Cell>
              <Table.Cell>
                <Tag data-color="brand1">
                  {formatRoleCode(role.roleCode)}
                </Tag>
              </Table.Cell>
              <Table.Cell>
                {role.created ? formatDateTime(role.created) : "-"}
              </Table.Cell>
              <Table.Cell>
                <Button
                  variant="secondary"
                  onClick={() => removeMutation.mutate(role.recipientSsn)}
                >
                  <LeaveIcon />
                  Fjern tilgang
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  );
}
