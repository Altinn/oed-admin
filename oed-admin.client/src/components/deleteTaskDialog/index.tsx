import React from "react";
import { Button, Dialog, Heading, Paragraph, Popover } from "@digdir/designsystemet-react";
import { TrashIcon } from "@navikt/aksel-icons";
import type { Task } from "../../types/IEstate";
import { formatDateTime } from "../../utils/formatters";

interface Props {
  task: Task,
  onConfirm: () => void
};

export default function DeleteTaskDialog({ task, onConfirm }: Props) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const taskType = task.type.split(".").slice(-1)[0];

  return (
    <Dialog.TriggerContext>
      <Dialog.Trigger variant="tertiary" data-color="danger" disabled={!!task.executed}>
        <TrashIcon title="Slett oppgave" />
      </Dialog.Trigger>
      <Dialog ref={dialogRef} closedby='any'>
        <Heading style={{marginBottom: 'var(--ds-size-2)'}}>
          Slett oppgave
        </Heading>
        <Paragraph>
          {taskType} · {task.status}
          {task.scheduled ? ` · planlagt ${formatDateTime(task.scheduled)}` : ""}
        </Paragraph>
        <div style={{display: 'flex', gap: 'var(--ds-size-4)', marginTop: 'var(--ds-size-4)'}}>
          <Popover.TriggerContext>
            <Popover.Trigger data-color='danger' aria-label='Slett oppgave'>
              <TrashIcon/>Slett oppgave
            </Popover.Trigger>
            <Popover data-color='danger'>
              <Paragraph>Er du sikker på at du vil slette oppgaven? Dette kan ikke angres.</Paragraph>
              <div style={{
                display: 'flex',
                gap: 'var(--ds-size-2)',
                marginTop: 'var(--ds-size-2)'
              }}>
                <Button data-size='sm' onClick={() => {
                  onConfirm();
                  dialogRef.current?.close();
                }}>
                  Ja, slett</Button>
                <Button data-size='sm' variant='tertiary' onClick={() => dialogRef.current?.close()}>
                  Avbryt
                </Button>
              </div>
            </Popover>
          </Popover.TriggerContext>
          <Button variant='secondary' onClick={() => dialogRef.current?.close()}>
            Avbryt
          </Button>
        </div>
      </Dialog>
    </Dialog.TriggerContext>
  )
};
