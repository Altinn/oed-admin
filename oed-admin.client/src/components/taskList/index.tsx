import React from "react";
import {
  Alert,
  Badge,
  Checkbox,
  Chip,
  Dialog,
  Heading,
  Label,
  Paragraph,
  Skeleton,
  Table,
  Tag,
  useCheckboxGroup,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { formatDateTime } from "../../utils/formatters";
import { CodeIcon } from "@navikt/aksel-icons";
import type { Task, TaskResponse, TaskStatus } from "../../types/IEstate";
import RescheduleDialog from "../rescheduleTaskDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskKeys } from "../../queries/taskQueries";
import RescheduleMultipleDialog from "../rescheduleTaskDialog/multiple";
import DeleteTaskDialog from "../deleteTaskDialog";
import DeleteMultipleDialog from "../deleteTaskDialog/multiple";
import { fetchWithMsal } from "../../utils/msalUtils";
import { ExclamationmarkTriangleIcon } from "@navikt/aksel-icons";
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';

interface Props {
  data?: TaskResponse | null;
  isLoading: boolean;
  error: Error | null;
}

interface PatchTaskResponse {
  Task: Task;
}

interface PatchTasksResponse {
  updatedCount: number;
}

interface DeleteTasksResponse {
  deletedCount: number;
}

interface DeleteResult {
  color: "success" | "warning" | "danger";
  message: string;
}

export default function TaskList({ data, isLoading, error }: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState<TaskStatus | "All">("All");
  const [deleteResult, setDeleteResult] = React.useState<DeleteResult | null>(null);

  const {
    getCheckboxProps,
    value: selectedTasks,
    setValue: setSelectedTasks,
  } = useCheckboxGroup({
    name: "tasklist-checkbox-group",
  });

  const rescheduleMutationFn = async ({
    taskId,
    scheduled,
    attempts,
  }: {
    taskId: string;
    scheduled: string;
    attempts: number;
  }): Promise<PatchTaskResponse> => {
    const response = await fetchWithMsal(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskId, scheduled, attempts }),
    });

    if (!response.ok) {
      throw new Error("Failed to rescehdule task");
    }
    return response.json();
  };

  const rescheduleMultipleMutationFn = async ({
    taskIds,
    scheduled,
    attempts,
  }: {
    taskIds: Array<string>;
    scheduled: string;
    attempts: number;
  }): Promise<PatchTasksResponse> => {
    const response = await fetchWithMsal(`/api/tasks`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskIds, scheduled, attempts }),
    });

    if (!response.ok) {
      throw new Error("Failed to rescehdule task");
    } else {
      setSelectedTasks([]);
    }
    return response.json();
  };

  const rescheduleMutation = useMutation({
    mutationFn: (data: {
      taskId: string;
      scheduled: string;
      attempts: number;
    }) => rescheduleMutationFn(data),
    onMutate: () => setDeleteResult(null),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.all,
      });
    },
    onError: (error) => {
      console.error("Error reschdeduling task:", error);
    },
  });

  const rescheduleMultipleMutation = useMutation({
    mutationFn: (data: {
      taskIds: Array<string>;
      scheduled: string;
      attempts: number;
    }) => rescheduleMultipleMutationFn(data),
    onMutate: () => setDeleteResult(null),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.all,
      });
    },
    onError: (error) => {
      console.error("Error reschdeduling tasks:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string): Promise<DeleteResult> => {
      const response = await fetchWithMsal(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (response.status === 409) {
        return { color: "warning", message: "Oppgaven ble utført før den kunne slettes." };
      }
      if (response.status === 404) {
        return { color: "warning", message: "Oppgaven finnes ikke lenger." };
      }
      if (!response.ok) {
        throw new Error("Failed to delete task");
      }
      return { color: "success", message: "1 oppgave slettet." };
    },
    onMutate: () => setDeleteResult(null),
    onSuccess: (result, taskId) => {
      setSelectedTasks((prev) => prev.filter((id) => id !== taskId));
      setDeleteResult(result);
      queryClient.invalidateQueries({
        queryKey: taskKeys.all,
      });
    },
    onError: (error) => {
      console.error("Error deleting task:", error);
      setDeleteResult({ color: "danger", message: "Det oppstod en feil under sletting av oppgaven." });
    },
  });

  const deleteMultipleMutation = useMutation({
    mutationFn: async (taskIds: Array<string>): Promise<DeleteResult> => {
      const response = await fetchWithMsal(`/api/tasks`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete tasks");
      }

      const { deletedCount }: DeleteTasksResponse = await response.json();
      const requested = taskIds.length;
      if (deletedCount === requested) {
        return { color: "success", message: `${deletedCount} oppgave(r) slettet.` };
      }
      return {
        color: "warning",
        message: `${deletedCount} av ${requested} oppgave(r) slettet. ${requested - deletedCount} var allerede utført eller finnes ikke lenger.`,
      };
    },
    onMutate: () => setDeleteResult(null),
    onSuccess: (result) => {
      setSelectedTasks([]);
      setDeleteResult(result);
      queryClient.invalidateQueries({
        queryKey: taskKeys.all,
      });
    },
    onError: (error) => {
      console.error("Error deleting tasks:", error);
      setDeleteResult({ color: "danger", message: "Det oppstod en feil under sletting av oppgavene." });
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
    new Set(data?.tasks.map((task) => task.status)),
  );

  const handleChangeChip = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(event.target.value as TaskStatus | "All");
    setDeleteResult(null);
  };

  // Deleting can remove every task with the chosen status. Fall back to "All" rather than
  // leaving an empty table whose filter chips may no longer be rendered.
  const effectiveFilter: TaskStatus | "All" =
    filter === "All" || uniqueStatuses.includes(filter) ? filter : "All";

  const filteredTasks = data?.tasks.filter(
    (task) => effectiveFilter === "All" || task.status === effectiveFilter,
  );

  // The checkbox group keeps ids that are no longer rendered (another page, another status
  // filter, or deleted since). Batch actions must only act on what the user can see.
  const visibleSelectedTasks = selectedTasks.filter((id) =>
    filteredTasks?.some((task) => task.id === id && !task.executed),
  );

  const resultAlert = deleteResult && (
    <Alert data-color={deleteResult.color} data-size="sm" style={{ marginBottom: "var(--ds-size-4)" }}>
      <Paragraph>{deleteResult.message}</Paragraph>
    </Alert>
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
      <>
        {resultAlert}
        <ValidationMessage data-color="info">
          Ingen oppgaver funnet.
        </ValidationMessage>
      </>
    );
  }

  return (
    <section className="flex-col">
      <div className="flex-row" style={{ justifyContent: "space-between" }}>
        {uniqueStatuses.length > 1 && (
          <div>
            <Label
              style={{ marginRight: "var(--ds-size-2)" }}
              htmlFor="task-status"
            >
              Filtrer oppgaver
            </Label>

            <div className="flex-row">
              <Chip.Radio
                name="task-status"
                checked={effectiveFilter === "All"}
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
                  checked={effectiveFilter === status}
                  value={status}
                  onChange={(e) => {
                    handleChangeChip(e);
                  }}
                >
                  {status}
                </Chip.Radio>
              ))}
            </div>
          </div>
        )}
        {visibleSelectedTasks.length > 0 && (
          <div>
            <Label
              style={{ marginRight: "var(--ds-size-2)" }}
              htmlFor="task-status"
            >
              Batch actions
            </Label>

            <div className="flex-row">
              <Paragraph>{`${visibleSelectedTasks.length} oppgave(r) valgt`}</Paragraph>
              <RescheduleMultipleDialog
                taskIds={visibleSelectedTasks}
                onChange={(val) =>
                  rescheduleMultipleMutation.mutate({
                    taskIds: visibleSelectedTasks,
                    scheduled: val,
                    attempts: 0,
                  })
                }
              />
              <DeleteMultipleDialog
                taskIds={visibleSelectedTasks}
                onConfirm={() => deleteMultipleMutation.mutate(visibleSelectedTasks)}
              />
            </div>
          </div>
        )}
      </div>
      {resultAlert}
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>
              <Checkbox
                aria-label="Velg alle"
                {...getCheckboxProps({ allowIndeterminate: true })}
              />
            </Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Opprettet</Table.HeaderCell>
            <Table.HeaderCell>Planlagt</Table.HeaderCell>
            <Table.HeaderCell>Utført</Table.HeaderCell>
            <Table.HeaderCell>Dødsbo</Table.HeaderCell>
            <Table.HeaderCell>JSON</Table.HeaderCell>
            <Table.HeaderCell>Error</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {filteredTasks?.map((task) => (
            <Table.Row key={task.id}>
              <Table.Cell>
                <Checkbox
                  aria-label={`Velg ${task.id}`}
                  {...getCheckboxProps(task.id)}
                  readOnly={
                    filteredTasks.find((item) => item.id == task.id)?.executed
                      ? true
                      : false
                  }
                />
              </Table.Cell>
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
              <Table.Cell>{task.estateSsn ? task.estateSsn : "-"}</Table.Cell>
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
                    <Dialog
                      style={{ maxWidth: 1200 }}
                      data-size="sm"
                      closedby="any"
                    >
                      <Heading
                        level={3}
                        style={{ marginBottom: "var(--ds-size-2)" }}
                      >
                        JSON Payload
                      </Heading>
                      <JSONPretty id="json-pretty" data={task.jsonPayload}></JSONPretty>
                    </Dialog>
                  )}
                </Dialog.TriggerContext>
              </Table.Cell>
              <Table.Cell>
                <Dialog.TriggerContext>
                  <Dialog.Trigger variant="tertiary" disabled={!task.lastError}>
                    <ExclamationmarkTriangleIcon />
                  </Dialog.Trigger>
                  {task.lastError && (
                    <Dialog
                      style={{ maxWidth: 1200 }}
                      data-size="sm"
                      closedby="any"
                    >
                      <Heading
                        level={3}
                        style={{ marginBottom: "var(--ds-size-2)" }}
                      >
                        Last error
                      </Heading>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                        }}
                      >
                        {task.lastError}
                      </pre>
                    </Dialog>
                  )}
                </Dialog.TriggerContext>
              </Table.Cell>
              <Table.Cell>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-size-1)" }}>
                  <RescheduleDialog
                    task={task}
                    onChange={(val) =>
                      rescheduleMutation.mutate({
                        taskId: task.id,
                        scheduled: val,
                        attempts: 0,
                      })
                    }
                  />
                  <DeleteTaskDialog
                    task={task}
                    onConfirm={() => deleteMutation.mutate(task.id)}
                  />
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </section>
  );
}
