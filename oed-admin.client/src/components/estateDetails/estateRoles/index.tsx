import {
  Heading,
  Label,
  Paragraph,
  Spinner,
  ValidationMessage,
} from "@digdir/designsystemet-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

interface Props {
  estateId: string;
}

interface RoleAssignment {
  id: number;
  roleCode: string;
  estateSsn: string;
  heirSsn?: string;
  recipientSsn: string;
  created: string;
  justification?: string;
}

interface RoleAssignmentsResponse {
  roleAssignments: RoleAssignment[];
}

export default function EstateRoles({ estateId }: Props) {
  const location = useLocation();
  const id = estateId || location.pathname.split("/").pop() || "";

  const { data, isLoading, error } = useQuery<RoleAssignmentsResponse>({
    queryKey: ["estateRoles", id],
    queryFn: async () => {
      const response = await fetch(`/api/estate/${id}/roleassignments`);
      if (!response.ok) {
        throw new Error("Failed to fetch estate roles");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return <Spinner data-size="md" aria-label="Henter roller" />;
  }

  if (error) {
    return (
      <ValidationMessage>
        Det oppstod en feil under henting av roller: {error.message}
      </ValidationMessage>
    );
  }

  if (!data || data.roleAssignments.length === 0) {
    return (
      <ValidationMessage data-color="info">
        Ingen roller funnet for dette boet.
      </ValidationMessage>
    );
  }

  return (
    <>
      <Heading
        level={2}
        data-size="sm"
        style={{ marginBottom: "var(--ds-size-2)" }}
      >
        Roller
      </Heading>

      <ul>
        {data.roleAssignments.map((role) => (
          <li key={role.id}>
            <Paragraph className="flex-between">
              <Label>Rolle</Label>
              {role.roleCode}
            </Paragraph>
          </li>
        ))}
      </ul>
    </>
  );
}
