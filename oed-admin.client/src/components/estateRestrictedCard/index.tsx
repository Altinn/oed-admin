import {
  Card,
  Tag,
  Heading,
  Paragraph,
  Label,
  List,
} from "@digdir/designsystemet-react";
import type { MinimalEstate } from "../../types/IEstate";
import { statusColors, statusTexts } from "../../utils/statusMappers";
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
    caseStatus,
    status,
    districtCourtName,
    caseNumber,
    heirs,
    scheduled,
    id
  } = estate;

  const caseStatusColor = caseStatus ? statusColors[caseStatus] : "neutral";
  const caseStatusText = caseStatus ? statusTexts[caseStatus] : "Ukjent";
  const ddStatusColor = caseStatus ? statusColors[status] : "neutral";
  const ddStatusText = caseStatus ? statusTexts[status] : "Ukjent";

  return (
    <Card data-color="brand2" className="deceased-card">
      <Card.Block>
        <Heading level={3}>{deceasedName}</Heading>
        <Paragraph className="flex-row">
          <Tag data-color={caseStatusColor}>{caseStatusText}</Tag>
          <Tag data-color={ddStatusColor}>{ddStatusText}</Tag>
        </Paragraph>
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
        <Paragraph className="flex-between">
          <Label>Melding om tilgang sendes: </Label>
          {scheduled
            ? new Intl.DateTimeFormat("nb", { dateStyle: "full" }).format(
              new Date(scheduled)
            )
            : "Ukjent"}
        </Paragraph>
      </Card.Block>
      <Card.Block>
        <Paragraph variant="short">{districtCourtName}</Paragraph>
        <Paragraph variant="short">{caseNumber}</Paragraph>
        <CopyToClipboard value={`${window.location.origin}/estate/${id}`} displayValue="Kopier lenke til bo" />
      </Card.Block>
    </Card>
  );
}
