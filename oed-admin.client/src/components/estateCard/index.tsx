import {
  Card,
  Tag,
  Heading,
  Paragraph,
  Label,
} from "@digdir/designsystemet-react";
import "./style.css";
import { useNavigate } from "react-router-dom";
import type { Estate } from "../../types/IEstate";

interface Props {
  estate: Estate;
}

export default function EstateCard({ estate }: Props) {
  const navigate = useNavigate();
  const {
    deceasedName,
    dateOfDeath,
    deceasedPartyId,
    deceasedNin,
    caseStatus,
    status,
    id,
    districtCourtName,
    caseNumber
  } = estate;

  // TODO: Use a more comprehensive mapping for case statuses
  const statusColors: Record<string, string> = {
    MOTTATT: "neutral",
    FERDIGBEHANDLET: "success",
    FEILFORT: "danger",
    Created: "neutral",
    FirstHeirReceived: "info",
    DeclarationCreated: "info",
    DeclarationSubmitted: "info",
    ProbateIssued: "success",
    Unknown: "warning",

  };

  const statusTexts: Record<string, string> = {
    MOTTATT: "Mottatt",
    FERDIGBEHANDLET: "Ferdigbehandlet",
    FEILFORT: "Feilført",
    Created: "Opprettet",
    FirstHeirReceived: "Arving(er) mottatt",
    DeclarationCreated: "Erklæring opprettet",
    DeclarationSubmitted: "Erklæring innsendt",
    ProbateIssued: "Skifteform besluttet",
    Unknown: "Ukjent",
  };

  const caseStatusColor = caseStatus ? statusColors[caseStatus] : "neutral";
  const caseStatusText = caseStatus ? statusTexts[caseStatus] : "Ukjent";
  const ddStatusColor = caseStatus ? statusColors[status] : "neutral";
  const ddStatusText = caseStatus ? statusTexts[status] : "Ukjent";

  const handleClick = () => {
    navigate(`/estate/${id}`);
  };

  if (!estate) {
    return null;
  }

  return (
    <Card asChild data-color="neutral" className="deceased-card">
      <button type="button" onClick={handleClick}>
        <Card.Block>
          <Heading>{deceasedName}</Heading>
          <Paragraph data-size="sm">
            <Label>Dødsdato: </Label>
            {new Intl.DateTimeFormat("nb").format(new Date(dateOfDeath))}
          </Paragraph>
          <Paragraph data-size="sm" className="flex-row">
            <Tag data-color={caseStatusColor} >{caseStatusText}</Tag>
            <Tag data-color={ddStatusColor} >{ddStatusText}</Tag>
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
          <Paragraph variant="short" data-size="sm">{districtCourtName}</Paragraph>
          <Paragraph variant="short" data-size="sm">{caseNumber}</Paragraph>
        </Card.Block>
      </button>
    </Card>
  );
}
