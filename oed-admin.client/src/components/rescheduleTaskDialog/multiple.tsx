import React from "react";
import { Button, Dialog, Heading, Paragraph, Popover, Textfield } from "@digdir/designsystemet-react";
import { CalendarIcon } from "@navikt/aksel-icons";
import { formatDateTimeLocal, isValidDateTime } from "../../utils/formatters";

interface Props {
  taskIds: Array<string>,
  onChange: (isoString: string) => void
};

export default function RescheduleMultipleDialog({ taskIds, onChange }: Props) {
  const [value, setValue] = React.useState<string>(formatDateTimeLocal(new Date()));
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  return (
    <Dialog.TriggerContext>
      <Dialog.Trigger disabled={taskIds.length < 1}>
          <CalendarIcon title="Reschedule tasks" />
          Reschedule
      </Dialog.Trigger>
      <Dialog ref={dialogRef} closedby='any'>
        <Heading style={{marginBottom: 'var(--ds-size-2)'}}>
          {`Reschedule ${taskIds.length} task(s)`}
        </Heading>
        <Textfield
          // @ts-expect-error We want the native "autofocus" and Reacts onMount smartness (see https://react.dev/reference/react-dom/components/input#input)
          autofocus='true' 
          label='Planlagt tidspunkt' 
          type='datetime-local'
          value={value} onChange={e => isValidDateTime(e.target.value) && setValue(e.target.value)} />
        <div style={{display: 'flex', gap: 'var(--ds-size-4)', marginTop: 'var(--ds-size-4)'}}>
          <Popover.TriggerContext>
            <Popover.Trigger data-color='danger' aria-label='Reschedule tasks'>
              <CalendarIcon/>
              {`Reschedule ${taskIds.length} task(s)`} 
            </Popover.Trigger>
            <Popover data-color='danger'>
              <Paragraph>Er du sikker på at du vil oppdatere planlagt tidspunkt til (UTC) {new Date(value as string).toISOString()}</Paragraph>
              <div style={{
                display: 'flex',
                gap: 'var(--ds-size-2)',
                marginTop: 'var(--ds-size-2)'
              }}>
                <Button data-size='sm' onClick={() => {
                  if (onChange) {
                    onChange(new Date(value as string).toISOString());
                  }              
                  dialogRef.current?.close();
                }}>
                  Ja, oppdater</Button>
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