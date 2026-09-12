import {
  Card,
  Tag,
  Heading,
  Paragraph,
  Label,
} from "@digdir/designsystemet-react";
import "./style.css";
import { Link } from "react-router-dom";
import type { Estate } from "../../types/IEstate";
import { statusColors, statusTexts } from "../../utils/statusMappers";

interface Props {
  estate: Estate;
}

export default function EstateCard({ estate }: Props) {
  const {
    deceasedName,
    dateOfDeath,
    deceasedPartyId,
    deceasedNin,
    caseStatus,
    status,
    id,
    districtCourtName,
    caseNumber,
    created,
  } = estate;

  const caseStatusColor = caseStatus ? statusColors[caseStatus] : "neutral";
  const caseStatusText = caseStatus ? statusTexts[caseStatus] : "Ukjent";
  const ddStatusColor = caseStatus ? statusColors[status] : "neutral";
  const ddStatusText = caseStatus ? statusTexts[status] : "Ukjent";

  if (!estate) {
    return null;
  }

  return (
    <Card asChild data-color="neutral" className="deceased-card">
      <Link to={`/estate/${id}`}>
        <Card.Block>
          <Paragraph data-size="xs">
            <Label>Opprettet: </Label>
            {new Intl.DateTimeFormat("nb").format(new Date(created))}
          </Paragraph>
          <Heading>{deceasedName}</Heading>
          <Paragraph data-size="sm">
            <Label>Dødsdato: </Label>
            {new Intl.DateTimeFormat("nb").format(new Date(dateOfDeath))}
          </Paragraph>
          <Paragraph data-size="sm" className="flex-row">
            <Tag data-color={caseStatusColor}>{caseStatusText}</Tag>
            <Tag data-color={ddStatusColor}>{ddStatusText}</Tag>
          </Paragraph>
        </Card.Block>
        <Card.Block>
          <Paragraph className="flex-between">
            <Label>Party ID</Label>
            {deceasedPartyId}
          </Paragraph>
          <Paragraph className="flex-between">
            <Label>SSN</Label>
            {deceasedNin}
          </Paragraph>
        </Card.Block>
        <Card.Block>
          <Paragraph variant="short" data-size="sm">
            {districtCourtName}
          </Paragraph>
          <Paragraph variant="short" data-size="sm">
            {caseNumber}
          </Paragraph>
        </Card.Block>
      </Link>
    </Card>
  );
}
