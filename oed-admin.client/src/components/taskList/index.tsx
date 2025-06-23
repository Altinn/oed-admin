import React from "react";
import {
  Badge,
  Chip,
  Dialog,
  Heading,
  Label,
  Skeleton,
  Table,
  Tag,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { formatDateTime } from "../../utils/formatters";
import { CodeIcon } from "@navikt/aksel-icons";
import type { TaskResponse, TaskStatus } from "../../types/IEstate";

interface Props {
  data?: TaskResponse | null;
  isLoading: boolean;
  error: Error | null;
}

export default function TaskList({ data, isLoading, error }: Props) {
  const [filter, setFilter] = React.useState<TaskStatus | "All">("All");

  const formatTaskType = (type: string) => {
    const parts = type.split(".");
    return parts.slice(-1);
  };

  const getTaskStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      Executed: "success",
      Error: "danger",
      Scheduled: "warning",
      InProgress: "info",
    };
    return statusColors[status] || "neutral";
  };

  const uniqueStatuses = Array.from(
    new Set(data?.tasks.map((task) => task.status))
  );

  const handleChangeChip = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(event.target.value as TaskStatus | "All");
    console.log("Selected filter:", event.target.value);
  };

  const filteredTasks = data?.tasks.filter(
    (task) => filter === "All" || task.status === filter
  );

  if (isLoading) {
    return <Skeleton aria-label="Henter oppgaver" />;
  }

  if (error) {
    return (
      <ValidationMessage>
        Det oppstod en feil under henting av oppgaver
      </ValidationMessage>
    );
  }

  if (!data || data.tasks.length === 0) {
    return (
      <ValidationMessage data-color="info">
        Ingen oppgaver funnet for dette boet.
      </ValidationMessage>
    );
  }

  return (
    <section className="flex-col">
      {uniqueStatuses.length > 1 && (
        <>
          <Label
            style={{ marginRight: "var(--ds-size-2)" }}
            htmlFor="task-status"
          >
            Filtrer oppgaver
          </Label>

          <div className="flex-row">
            <Chip.Radio
              name="task-status"
              defaultChecked
              value="All"
              onChange={(e) => {
                handleChangeChip(e);
              }}
            >
              All
            </Chip.Radio>
            {uniqueStatuses.map((status) => (
              <Chip.Radio
                key={status}
                name="task-status"
                value={status}
                onChange={(e) => {
                  handleChangeChip(e);
                }}
              >
                {status}
              </Chip.Radio>
            ))}
          </div>
        </>
      )}
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Opprettet</Table.HeaderCell>
            <Table.HeaderCell>Planlagt</Table.HeaderCell>
            <Table.HeaderCell>Utført</Table.HeaderCell>
            <Table.HeaderCell>JSON</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {filteredTasks?.map((task) => (
            <Table.Row key={task.id}>
              <Table.Cell>
                <Badge
                  count={task.attempts}
                  variant="tinted"
                  data-color={task.attempts > 1 ? "warning" : "neutral"}
                  style={{
                    fontVariant: "tabular-nums",
                    marginRight: "var(--ds-size-2)",
                  }}
                />
                {formatTaskType(task.type)}
              </Table.Cell>
              <Table.Cell>
                <Tag data-color={getTaskStatusColor(task.status)}>
                  {task.status}
                </Tag>
              </Table.Cell>
              <Table.Cell>
                {task.created ? formatDateTime(task.created) : "-"}
              </Table.Cell>
              <Table.Cell>
                {task.scheduled ? formatDateTime(task.scheduled) : "-"}
              </Table.Cell>
              <Table.Cell>
                {task.executed ? formatDateTime(task.executed) : "-"}
              </Table.Cell>
              <Table.Cell>
                <Dialog.TriggerContext>
                  <Dialog.Trigger
                    variant="tertiary"
                    data-size="lg"
                    disabled={!task.jsonPayload}
                  >
                    <CodeIcon />
                  </Dialog.Trigger>
                  {task.jsonPayload && (
                    <Dialog style={{ maxWidth: 1200 }} data-size="sm">
                      <Heading
                        level={3}
                        style={{ marginBottom: "var(--ds-size-2)" }}
                      >
                        JSON Payload
                      </Heading>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                        }}
                      >
                        {JSON.stringify(JSON.parse(task.jsonPayload), null, 2)}
                      </pre>
                    </Dialog>
                  )}
                </Dialog.TriggerContext>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </section>
  );
}
