import {
  Heading,
  ValidationMessage,
  Table,
  Tag,
  Skeleton,
  type TableHeaderCellProps,
} from "@digdir/designsystemet-react";
import type {
  RoleAssignmentLog,
  RoleAssignmentLogResponse,
} from "../../types/IEstate";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime, formatRoleCode } from "../../utils/formatters";
import { useState } from "react";
import { EnterIcon, LeaveIcon } from "@navikt/aksel-icons";

interface Props {
  estateId: string;
}

export default function RoleLogTable({ estateId }: Props) {
  const [sortField, setSortField] = useState<keyof RoleAssignmentLog | null>(
    "timestamp"
  );
  const [sortDirection, setSortDirection] =
    useState<TableHeaderCellProps["sort"]>(undefined);

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

  const handleSort = (field: keyof RoleAssignmentLog) => {
    if (sortField === field && sortDirection === "descending") {
      setSortField(null);
      setSortDirection(undefined);
    } else {
      setSortField(field);
      setSortDirection(
        sortField === field && sortDirection === "ascending"
          ? "descending"
          : "ascending"
      );
    }
  };
  const sortedData = [...(data?.roleAssignmentLog || [])].sort((a, b) => {
    if (sortField === null) return 0;
    const aValue = a[sortField] ?? "";
    const bValue = b[sortField] ?? "";
    if (aValue < bValue) return sortDirection === "ascending" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "ascending" ? 1 : -1;
    return 0;
  });

  if (isLoading) {
    return <Skeleton aria-label="Henter roller" />;
  }

  if (error) {
    return (
      <ValidationMessage>
        Det oppstod en feil under henting av rollehistorikk
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
        style={{ marginTop: "var(--ds-size-2)" }}
      >
        Historikk
      </Heading>

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell
              sort={sortField === "timestamp" ? sortDirection : "none"}
              onClick={() => handleSort("timestamp")}
            >
              Tidspunkt
            </Table.HeaderCell>
            <Table.HeaderCell>SSN</Table.HeaderCell>
            <Table.HeaderCell>Rolle</Table.HeaderCell>
            <Table.HeaderCell>Begrunnelse</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sortedData.map((log) => (
            <Table.Row key={log.id}>
              <Table.Cell>
                <div className="flex-row">
                  {log.action === "GRANT" ? (
                    <EnterIcon
                      color="var(--ds-color-success-base-default)"
                      fontSize={"var(--ds-font-size-6)"}
                      aria-label="Tilgang gitt"
                    />
                  ) : (
                    <LeaveIcon
                      color="var(--ds-color-danger-base-default)"
                      fontSize={"var(--ds-font-size-6)"}
                      aria-label="Tilgang fjernet"
                    />
                  )}
                  {formatDateTime(log.timestamp)}
                </div>
              </Table.Cell>
              <Table.Cell>{log.recipientSsn}</Table.Cell>
              <Table.Cell>
                <Tag
                  data-color={
                    formatRoleCode(log.roleCode) === "superadmin"
                      ? "brand1"
                      : "accent"
                  }
                >
                  {formatRoleCode(log.roleCode)}
                </Tag>
              </Table.Cell>

              <Table.Cell>{log.justification || "-"}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  );
}
