import { Heading, Skeleton, Table, ValidationMessage } from "@digdir/designsystemet-react";
import { formatDateTime } from "../../utils/formatters";
import { useQuery } from "@tanstack/react-query";
import { CheckmarkIcon } from "@navikt/aksel-icons";
import { fetchWithMsal } from "../../utils/msalUtils";

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

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Id</Table.HeaderCell>
            <Table.HeaderCell>Endpoint</Table.HeaderCell>
            <Table.HeaderCell>Resource filter</Table.HeaderCell>
            <Table.HeaderCell>Type filter</Table.HeaderCell>
            <Table.HeaderCell>Created at</Table.HeaderCell>
            <Table.HeaderCell>Validated</Table.HeaderCell>
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
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  )
}