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
import type { Task, TaskResponse, TaskStatus } from "../../types/IEstate";
import RescheduleDialog from "../rescheduleTaskDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskKeys } from "../../queries/taskQueries";

interface Props {
  data?: TaskResponse | null;
  isLoading: boolean;
  error: Error | null;
}

interface PatchTaskResponse {
  Task: Task
}

export default function TaskList({ data, isLoading, error }: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState<TaskStatus | "All">("All");

  const rescheduleMutationFn = async ({taskId, scheduled, attempts} : {taskId: string, scheduled: string, attempts: number}): Promise<PatchTaskResponse> => {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskId, scheduled, attempts }),
    });

    if (!response.ok) {
      throw new Error("Failed to rescehdule task");
    }
    return response.json(); 
  }

  const rescheduleMutation = useMutation({
    mutationFn: (data: {taskId: string, scheduled: string, attempts: number}) => 
      rescheduleMutationFn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.all,
      });
    },
    onError: (error) => {
      console.error("Error reschdeduling task:", error);
    },
  });

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
        Ingen oppgaver funnet.
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
            <Table.HeaderCell>Dødsbo</Table.HeaderCell>
            <Table.HeaderCell>JSON</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
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
                {task.estateSsn ? task.estateSsn : "-"}
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
              <Table.Cell>
                <RescheduleDialog task={task} onChange={(val) => rescheduleMutation.mutate({taskId: task.id, scheduled: val, attempts: 0})}/>                          
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </section>
  );
}
