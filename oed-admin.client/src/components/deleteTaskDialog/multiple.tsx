import React from "react";
import { Button, Dialog, Heading, Paragraph, Popover } from "@digdir/designsystemet-react";
import { TrashIcon } from "@navikt/aksel-icons";

interface Props {
  taskIds: Array<string>,
  onConfirm: () => void
};

export default function DeleteMultipleDialog({ taskIds, onConfirm }: Props) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const label = `Slett ${taskIds.length} oppgave(r)`;

  return (
    <Dialog.TriggerContext>
      <Dialog.Trigger data-color="danger" disabled={taskIds.length < 1}>
        <TrashIcon title="Slett oppgaver" />
        Slett
      </Dialog.Trigger>
      <Dialog ref={dialogRef} closedby='any'>
        <Heading style={{marginBottom: 'var(--ds-size-2)'}}>
          {label}
        </Heading>
        <div style={{display: 'flex', gap: 'var(--ds-size-4)', marginTop: 'var(--ds-size-4)'}}>
          <Popover.TriggerContext>
            <Popover.Trigger data-color='danger' aria-label={label}>
              <TrashIcon/>
              {label}
            </Popover.Trigger>
            <Popover data-color='danger'>
              <Paragraph>{`Er du sikker på at du vil slette ${taskIds.length} oppgave(r)? Dette kan ikke angres.`}</Paragraph>
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
