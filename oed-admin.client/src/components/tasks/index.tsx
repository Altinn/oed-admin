import TaskList from "../taskList";
import type { TaskResponse, TaskStatus } from "../../types/IEstate";
import { Pagination, Paragraph, usePagination } from "@digdir/designsystemet-react";
import { useState } from "react";
import { useTaskQueryByStatus } from "../../queries/taskQueries";

interface Props {
  status: TaskStatus;
}

export default function Tasks({ status }: Props) {
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const { data, isLoading, error } = useTaskQueryByStatus(status, 500, 1);
  const { pages, nextButtonProps, prevButtonProps } = usePagination({
    currentPage,
    setCurrentPage,
    totalPages: Math.ceil((data?.tasks?.length || 0) / pageSize),
    showPages: Math.min(Math.ceil((data?.tasks?.length || 0) / pageSize), 10),
  });

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(data?.tasks.length || 0, startIndex + pageSize);
  const tasksToDisplay = { tasks: data?.tasks?.slice(startIndex, endIndex) || [] } as TaskResponse;

  return (
    <>
      {data?.tasks && data.tasks?.length > 0 && (
        <Paragraph style={{marginBottom: '1rem'}}>Viser oppgave {startIndex + 1} - {endIndex} av totalt {data?.tasks?.length || 0} oppgave(r)</Paragraph>
      )}
      <TaskList data={tasksToDisplay} isLoading={isLoading} error={error} />
      
      {data?.tasks && data.tasks?.length > pageSize && (
        <Pagination  style={{marginTop: '1rem'}} aria-label='Sidenavigering'>
          <Pagination.List>
            <Pagination.Item>
              <Pagination.Button aria-label='Forrige side' {...prevButtonProps}>
                Forrige
              </Pagination.Button>
            </Pagination.Item>
            {pages.map(({ page, itemKey, buttonProps }) => (
              <Pagination.Item key={itemKey}>
                {typeof page === 'number' && <Pagination.Button aria-label={`Side ${page}`} {...buttonProps}>
                    {page}
                  </Pagination.Button>}
              </Pagination.Item>              
            ))}
              <Pagination.Item>
                <Pagination.Button aria-label='Neste side' {...nextButtonProps}>
                  Neste
                </Pagination.Button>
              </Pagination.Item>
          </Pagination.List>
        </Pagination>
      )}
    </>
  );
}
