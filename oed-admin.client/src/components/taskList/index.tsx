import {
  Badge,
  Dialog,
  Heading,
  Skeleton,
  Table,
  Tag,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "../../utils/formatters";
import { CodeIcon } from "@navikt/aksel-icons";

interface Props {
  estateId: string;
}

interface TaskResponse {
  tasks: Array<{
    id: string;
    type: string;
    jsonPayload?: string;
    created: string;
    scheduled?: string;
    executed?: string;
    lastAttempt?: string;
    lastError?: string;
    attempts: number;
    estateSsn?: string;
    status: TaskStatus;
  }>;
}

type TaskStatus =
  | "Scheduled"
  | "Executed"
  | "Retrying"
  | "DeadLetterQueue"
  | "Unknown";

export default function TaskList({ estateId }: Props) {
  const { data, isLoading, error } = useQuery<TaskResponse>({
    queryKey: ["tasks", estateId],
    queryFn: async () => {
      const response = await fetch(`/api/estate/${estateId}/tasks`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    },
  });

  const formatTaskType = (type: string) => {
    const parts = type.split(".");
    return parts.slice(-1);
  };

  const getTaskStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      Executed: "success",
      Failed: "danger",
      Scheduled: "warning",
      InProgress: "info",
    };
    return statusColors[status] || "neutral";
  };

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
        {data.tasks.map((task) => (
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
                      style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
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
  );
}
