import { useQuery } from "@tanstack/react-query";
import TaskList from "../taskList";
import type { TaskResponse } from "../../types/IEstate";

interface Props {
  estateId: string;
}

export default function EstateTasks({ estateId }: Props) {
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

  return <TaskList data={data} isLoading={isLoading} error={error} />;
}
