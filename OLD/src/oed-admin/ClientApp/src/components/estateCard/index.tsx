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
  const {
    deceasedName,
    dateOfDeath,
    deceasedPartyId,
    deceasedNin,
    caseStatus,
    id,
  } = estate;

  // TODO: Use a more comprehensive mapping for case statuses
  const statusColors: Record<string, string> = {
    MOTTATT: "neutral",
    FERDIGBEHANDLET: "success",
    FEILFORT: "error",
    ERKLÆRING_OPPRETTET: "warning",
    ERKLÆRING_INNSENDT: "info",
  };
  const statusColor = caseStatus ? statusColors[caseStatus] : "neutral";

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
          <Tag data-color={statusColor}>{caseStatus}</Tag>
          <Heading>{deceasedName}</Heading>
          <Paragraph data-size="sm">
            <Label>Dødsdato: </Label>
            {new Intl.DateTimeFormat("nb").format(new Date(dateOfDeath))}
          </Paragraph>
        </Card.Block>
        <Card.Block>
          <Paragraph className="flex-between ">
            <Label>Party ID</Label>
            {deceasedPartyId}
          </Paragraph>
          <Paragraph className="flex-between ">
            <Label>SSN</Label>
            {deceasedNin}
          </Paragraph>
        </Card.Block>
      </button>
    </Card>
  );
}
