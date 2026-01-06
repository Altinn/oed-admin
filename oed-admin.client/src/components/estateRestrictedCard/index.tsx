import {
  Card,
  Tag,
  Heading,
  Paragraph,
  Label,
  List,
  Popover,
} from "@digdir/designsystemet-react";
import type { MinimalEstate } from "../../types/IEstate";
import { statusColors, statusTexts, statusDescriptions } from "../../utils/statusMappers";
import CopyToClipboard from "../copyToClipboard";

interface Props {
  estate: MinimalEstate;
}

export default function EstateRestrictedCard({ estate }: Props) {
  if (!estate) {
    return null;
  }
  const {
    deceasedName,
    status,
    districtCourtName,
    caseNumber,
    heirs,
    scheduled,
    id
  } = estate;

  const ddStatusColor = status ? statusColors[status] : "neutral";
  const ddStatusText = status ? statusTexts[status] : "Ukjent";
  const ddStatusDescription = status ? statusDescriptions[status] : "";

  const popover = (statusText: string, statusDescription: string) => {
    return (
      <Popover.TriggerContext>
        <Paragraph>
          <Popover.Trigger inline>{statusText}</Popover.Trigger>
        </Paragraph>
        <Popover data-color='neutral'>
          <Paragraph>
            {statusDescription}
          </Paragraph>
        </Popover>
      </Popover.TriggerContext>
    );
  }


  return (
    <Card data-color="brand2" className="deceased-card">
      <Card.Block>
        <Heading level={3}>{deceasedName}</Heading>
          <div className="flex-row">
            <Tag data-color={ddStatusColor}>{popover(ddStatusText, ddStatusDescription)}</Tag>
          </div>
      </Card.Block>
      <Card.Block>
        <Heading
          level={4}
          data-size="xs"
          style={{ paddingBottom: "var(--ds-size-2)" }}
        >
          Arvinger
        </Heading>
        <List.Unordered>
          {heirs.map((heir) => (
            <List.Item key={heir.birthdate} style={{ fontVariant: "tabular-nums" }}>
              {heir.birthdate}
            </List.Item>
          ))}
        </List.Unordered>
        {scheduled && (
          <Paragraph className="flex-between">
            <Label>Tilgang gis: </Label>
              {new Intl.DateTimeFormat("nb", { dateStyle: "full" }).format(new Date(scheduled))}
          </Paragraph>
        )}
      </Card.Block>
      <Card.Block>
        <Paragraph variant="short">{districtCourtName}</Paragraph>
        <Paragraph variant="short">{caseNumber}</Paragraph>
        <CopyToClipboard value={`${window.location.origin}/estate/${id}`} displayValue="Kopier lenke til bo" />
      </Card.Block>
    </Card>
  );
}

