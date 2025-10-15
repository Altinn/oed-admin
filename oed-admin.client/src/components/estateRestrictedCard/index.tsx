import {
  Card,
  Tag,
  Heading,
  Paragraph,
  Label,
  List,
} from "@digdir/designsystemet-react";
import type { Estate } from "../../types/IEstate";
import { statusColors, statusTexts } from "../../utils/statusMappers";

interface Props {
  estate: Estate;
}

export default function EstateRestrictedCard({ estate }: Props) {
  const {
    deceasedName,
    firstHeirReceived,
    caseStatus,
    status,
    districtCourtName,
    caseNumber,
  } = estate;

  const caseStatusColor = caseStatus ? statusColors[caseStatus] : "neutral";
  const caseStatusText = caseStatus ? statusTexts[caseStatus] : "Ukjent";
  const ddStatusColor = caseStatus ? statusColors[status] : "neutral";
  const ddStatusText = caseStatus ? statusTexts[status] : "Ukjent";

  if (!estate) {
    return null;
  }

  const tmpHeirsSsns = ["01010112345", "02020223456", "03030334567"];
  const maskedHeirsSsns = tmpHeirsSsns.map((ssn) => ssn.slice(0, 6) + " *****");

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
          {maskedHeirsSsns.map((ssn) => (
            <List.Item key={ssn} style={{ fontVariant: "tabular-nums" }}>
              {ssn}
            </List.Item>
          ))}
        </List.Unordered>
        <Paragraph className="flex-between">
          <Label>Tilgang gitt: </Label>
          {firstHeirReceived
            ? new Intl.DateTimeFormat("nb", { dateStyle: "full" }).format(
                new Date(firstHeirReceived)
              )
            : "Ukjent"}
        </Paragraph>
      </Card.Block>
      <Card.Block>
        <Paragraph variant="short">{districtCourtName}</Paragraph>
        <Paragraph variant="short">{caseNumber}</Paragraph>
      </Card.Block>
    </Card>
  );
}
