import TaskList from "../taskList";
import { Paragraph } from "@digdir/designsystemet-react";
import { useTaskQueryByEstate } from "../../queries/taskQueries";

interface Props {
  estateId: string;
}

export default function EstateTasks({ estateId }: Props) {
  const { data, isLoading, error } = useTaskQueryByEstate(estateId);

  return (
    <>
      <Paragraph style={{marginBottom: '1rem'}}>Totalt {data?.tasks?.length || 0} oppgave(r)</Paragraph>
      <TaskList data={data} isLoading={isLoading} error={error} />
    </>
  );
}
