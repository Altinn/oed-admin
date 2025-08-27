import { Dialog, Heading, Skeleton, Table, Tag, ValidationMessage, type TableHeaderCellProps } from "@digdir/designsystemet-react";
import { useQuery } from "@tanstack/react-query";
import type { AltinnEvent, EstateEventsResponse } from "../../types/IEstate";
import { formatDateTime } from "../../utils/formatters";
import { CodeIcon } from "@navikt/aksel-icons";
import { useState } from "react";

interface Props {
  estateId: string;
}

export default function EstateEvents({ estateId }: Props) {
  const [sortField, setSortField] = useState<keyof AltinnEvent | null>(
    "time"
  );
  const [sortDirection, setSortDirection] =
    useState<TableHeaderCellProps["sort"]>(undefined);

  const { data, isLoading, error } = useQuery<EstateEventsResponse>({
    queryKey: ["events", estateId],
    queryFn: async () => {
      const response = await fetch(`/api/estate/${estateId}/events`);
      if (!response.ok) {
        throw new Error("Failed to fetch instance");
      }
      return response.json();
    },
  });

  const handleSort = (field: keyof AltinnEvent) => {
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

  const formatEventType = (type: string) => {
    const parts = type.split(".");
    return parts.slice(-1);
  };
  
  const altinnEvents = data?.events 
  ? JSON.parse(data?.events) as AltinnEvent[] 
  : [];

  const sortedData = [...(altinnEvents || [])].sort((a, b) => {
    if (sortField === null) return 0;
    const aValue = a[sortField] ?? "";
    const bValue = b[sortField] ?? "";
    if (aValue < bValue) return sortDirection === "ascending" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "ascending" ? 1 : -1;
    return 0;
  });

  if (isLoading) {
    return <Skeleton aria-label="Henter eventer" />;
  }

  if (error) {
    return (
      <ValidationMessage>
        Det oppstod en feil under henting av eventer
      </ValidationMessage>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <ValidationMessage data-color="info">
        Ingen eventer funnet.
      </ValidationMessage>
    );
  }

  return (
    <>
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell 
              sort={sortField === "time" 
                ? sortDirection 
                : "none"}
              onClick={() => handleSort("time")}>
                Tidspunkt
            </Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Resource</Table.HeaderCell>
            <Table.HeaderCell>Data</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          { sortedData.map(event => (
            <Table.Row key={event.id}>
              <Table.Cell>
                {event.time ? formatDateTime(event.time) : "-"}
              </Table.Cell>
              <Table.Cell>
                <Tag > 
                  {event.type ? formatEventType(event.type) : "-"}
                </Tag>                    
              </Table.Cell>
              <Table.Cell>
                {event.resource ? event.resource : "-"}
              </Table.Cell>
              <Table.Cell>
                <Dialog.TriggerContext>
                  <Dialog.Trigger
                    variant="tertiary"
                    data-size="lg"
                    disabled={!event.data}
                  >
                    <CodeIcon />
                  </Dialog.Trigger>
                  {event.data && (
                    <Dialog style={{ maxWidth: 1200 }} data-size="sm" closedby="any">
                      <Heading
                        level={3}
                        style={{ marginBottom: "var(--ds-size-2)" }}
                      >
                        Eventdata
                      </Heading>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                        }}
                      >
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                  </Dialog>
                )}
                </Dialog.TriggerContext>                  
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  );
}
