import {
  Heading,
  Skeleton,
  Table,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "../../utils/formatters";

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
    <>
      <Heading
        level={2}
        data-size="sm"
        style={{ marginBottom: "var(--ds-size-2)" }}
      >
        Oppgaveliste
      </Heading>
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>ID</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Opprettet</Table.HeaderCell>
            <Table.HeaderCell>Planlagt</Table.HeaderCell>
            <Table.HeaderCell>Utført</Table.HeaderCell>
            <Table.HeaderCell>Forsøk</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {data.tasks.map((task) => (
            <Table.Row key={task.id}>
              <Table.Cell>{task.id}</Table.Cell>
              <Table.Cell>{task.type}</Table.Cell>
              <Table.Cell>{task.status}</Table.Cell>
              <Table.Cell>
                {task.created ? formatDateTime(task.created) : "-"}
              </Table.Cell>
              <Table.Cell>
                {task.scheduled ? formatDateTime(task.scheduled) : "-"}
              </Table.Cell>
              <Table.Cell>
                {task.executed ? formatDateTime(task.executed) : "-"}
              </Table.Cell>
              <Table.Cell>{task.attempts}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  );
}
