import { Button, Dialog, Heading, Paragraph, Popover, Skeleton, Table, ValidationMessage } from "@digdir/designsystemet-react";
import { formatDateTime } from "../../utils/formatters";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckmarkIcon } from "@navikt/aksel-icons";
import { fetchWithMsal } from "../../utils/msalUtils";
import { TrashIcon } from "@navikt/aksel-icons";
import { useRef, useState } from "react";

interface IEventSubscriptionsResponse {
  count: number;
  subscriptions: Array<IEventSubscription>;
}

interface IEventSubscription {
  id: number;
  endPoint: string;
  resourceFilter: string;
  typeFilter: string;
  consumer: string;
  createdBy: string;
  created: string;
  validated: boolean;
}

export default function EventSubs() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<IEventSubscription | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<string>({
    queryKey: ["eventsubscriptions"],
    queryFn: async () => {
      const response = await fetchWithMsal(`/api/eventsubscriptions`);
      if (!response.ok) {
        throw new Error("Failed to fetch event subscriptions");
      }
      return response.json();
    }    
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetchWithMsal(`/api/eventsubscriptions/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error("Failed to delete event subscription");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["eventsubscriptions"],
      });
    },
    onError: (error) => {
      console.error(error);
    },
  });

  const subs = !data 
    ? null
    : JSON.parse(data) as IEventSubscriptionsResponse;

  const resourcesOfInterest = [
    "urn:altinn:resource:app_digdir_oed", 
    "urn:altinn:resource:app_digdir_oed-declaration", 
    "urn:altinn:resource:dodsbo-domstoladmin-api"];

  const filteredData = subs?.subscriptions.filter(s => resourcesOfInterest.includes(s.resourceFilter));
  
  if (isLoading) {
    return <Skeleton aria-label="Henter event subscriptions" />;
  }
  
  if (error) {
    return (
      <ValidationMessage>
        Det oppstod en feil under henting av event subscriptions
      </ValidationMessage>
    );
  }

  if (!subs || subs?.subscriptions?.length === 0) {
    <ValidationMessage data-color="info">
      Ingen event subscriptions funnet
    </ValidationMessage>
  }

  return (
    <>
      <Heading level={2} data-size="xl">
        Event subscriptions
      </Heading>

      <Popover id="confirm-popover">Content</Popover>
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Id</Table.HeaderCell>
            <Table.HeaderCell>Endpoint</Table.HeaderCell>
            <Table.HeaderCell>Resource filter</Table.HeaderCell>
            <Table.HeaderCell>Type filter</Table.HeaderCell>
            <Table.HeaderCell>Created at</Table.HeaderCell>
            <Table.HeaderCell>Validated</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {filteredData?.map(sub => (
            <Table.Row key = {sub.id}>
              <Table.Cell>{sub.id}</Table.Cell>
              <Table.Cell>{sub.endPoint}</Table.Cell>
              <Table.Cell>{sub.resourceFilter}</Table.Cell>
              <Table.Cell>{sub.typeFilter}</Table.Cell>
              <Table.Cell>{formatDateTime(sub.created)}</Table.Cell>
              <Table.Cell>{sub.validated ? <CheckmarkIcon /> : ''}</Table.Cell>
              <Table.Cell>
                <Button variant="tertiary" onClick={() => { setSelectedSubscription(sub); dialogRef.current?.showModal() }}>
                  <TrashIcon />
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Dialog ref={dialogRef}>
        <Heading>Slette event subscription?</Heading>
        <Paragraph>
          Er du sikker på at du vil slette subscription med id: {selectedSubscription?.id} ?
        </Paragraph>
        <div
          style={{
            marginTop: "var(--ds-size-2)",
          }}
          className="flex-row"
        >
          <Button 
            data-color="danger"
            variant="secondary"
            onClick={() => {
              deleteMutation.mutate(selectedSubscription!.id);
              dialogRef.current?.close()}}
          >
            Ja, slett!
          </Button>
          <Button onClick={() => dialogRef.current?.close()} >
            Avbryt
          </Button>
        </div>
      </Dialog>
    </>
  )
}