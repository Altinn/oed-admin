import React from "react";
import {
  Card,
  Tag,
  Heading,
  Paragraph,
  Label,
} from "@digdir/designsystemet-react";
import "./style.css";
import { useNavigate } from "react-router-dom";
import { Estate } from "../../types/IEstate";

interface Props {
  estate: Estate;
}

export default function EstateCard({ estate }: Props) {
  const navigate = useNavigate();

  // temporary status colors mapping
  const statusColors: Record<string, string> = {
    Opprettet: "accent",
    "Erklæring opprettet": "accent",
    "Erklæring innsendt": "warning",
    "Skifteattest mottatt": "success",
  };
  const statusColor = estate.caseStatus
    ? statusColors[estate.caseStatus]
    : "neutral";

  const handleClick = () => {
    navigate(`/deceased/${estate.deceasedPartyId}`);
  };

  if (!estate) {
    return null;
  }
  return (
    <Card asChild data-color="neutral" className="deceased-card">
      <button type="button" onClick={handleClick}>
        <Card.Block>
          <Tag data-color={statusColor}>{estate.caseStatus}</Tag>
          <Heading>{estate.deceasedName}</Heading>
          <Paragraph data-size="sm">
            <Label>Dødsdato: </Label>
            {new Intl.DateTimeFormat("nb").format(new Date(estate.dateOfDeath))}
          </Paragraph>
        </Card.Block>
        <Card.Block>
          <Paragraph className="flex-between tab-nums">
            <Label>Party ID: </Label>
            {estate.deceasedPartyId}
          </Paragraph>
          <Paragraph className="flex-between tab-nums">
            <Label>SSN: </Label>
            {estate.deceasedNin}
          </Paragraph>
        </Card.Block>
      </button>
    </Card>
  );
}
