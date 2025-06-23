import { useQuery } from "@tanstack/react-query";
import TaskList from "../taskList";
import type { TaskResponse, TaskStatus } from "../../types/IEstate";

interface Props {
  status: TaskStatus;
}

export default function Tasks({ status }: Props) {
  const { data, isLoading, error } = useQuery<TaskResponse>({
    queryKey: ["tasks", status ],
    queryFn: async () => {
      const response = await fetch(`/api/tasks?status=${status}`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    },
  });

  return <TaskList data={data} isLoading={isLoading} error={error} />;
}
