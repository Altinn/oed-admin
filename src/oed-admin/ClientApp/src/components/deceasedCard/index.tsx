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
interface IProps {
  deceased: {
    name: string;
    partyId: string;
    ssn: string;
    deathDate: Date;
    status: string;
  };
}

export default function DeceasedCard(props: IProps) {
  const { deceased } = props;
  const navigate = useNavigate();

  const statusColors: Record<string, string> = {
    Opprettet: "accent",
    "Erklæring opprettet": "accent",
    "Erklæring innsendt": "warning",
    "Skifteattest mottatt": "success",
  };

  const statusColor = statusColors[deceased.status] || "neutral";

  const handleClick = () => {
    navigate(`/deceased/${deceased.partyId}`, {
      state: { deceased },
    });
  };

  if (!deceased) {
    return null;
  }
  return (
    <Card asChild data-color="neutral" className="deceased-card">
      <button type="button" onClick={handleClick}>
        <Card.Block>
          <Tag data-color={statusColor}>{deceased.status}</Tag>
          <Heading>{deceased.name}</Heading>
          <Paragraph data-size="sm">
            <Label>Dødsdato: </Label>
            {new Intl.DateTimeFormat("nb").format(deceased.deathDate)}
          </Paragraph>
        </Card.Block>
        <Card.Block>
          <Paragraph className="flex-between tab-nums">
            <Label>Party ID: </Label>
            {deceased.partyId}
          </Paragraph>
          <Paragraph className="flex-between tab-nums">
            <Label>SSN: </Label>
            {deceased.ssn}
          </Paragraph>
        </Card.Block>
      </button>
    </Card>
  );
}
