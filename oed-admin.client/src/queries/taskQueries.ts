import { useQuery } from "@tanstack/react-query";
import type { TaskResponse, TaskStatus } from "../types/IEstate";

export const taskKeys = {
  all: ['tasks'] as const,
  allWithPagination: (pageSize: number, page: number) => [...taskKeys.all, pageSize, page],
  byStatus: (status: TaskStatus) => [...taskKeys.all, status],
  byStatusWithPaging: (status: TaskStatus, pageSize: number, page: number) => [...taskKeys.all, status, pageSize, page],
  byEstate: (estateId: string) => [...taskKeys.all, 'estates', estateId],
}

export const useTaskQueryByStatus = (status: TaskStatus, pageSize: number, page: number) => {
  return useQuery<TaskResponse>({
    queryKey: taskKeys.byStatusWithPaging(status, pageSize, page),
    queryFn: async () => {
      const response = await fetch(`/api/tasks?status=${status}&pageSize=${pageSize}&page=${page}`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    },
  })
};


export const useTaskQueryByEstate = (estateId: string) => {
  return useQuery<TaskResponse>({
    queryKey: taskKeys.byEstate(estateId),
    queryFn: async () => {
      const response = await fetch(`/api/estate/${estateId}/tasks`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    },
  })
};
