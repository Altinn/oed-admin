import React from "react";
import {
  Button,
  Divider,
  Fieldset,
  Heading,
  Link,
  List,
  Paragraph,
  Popover,
  Textfield,
} from "@digdir/designsystemet-react";
import RoleTable from "../estateRoles/RoleTable";
import { EnterIcon, LeaveIcon } from "@navikt/aksel-icons";
import { useMutation } from "@tanstack/react-query";

interface Props {
  estateId: string;
}

type Method = "POST" | "DELETE";

interface SuperadminPayload {
  estateId: string;
  ssn?: string;
  justification?: string;
  method: Method;
}

export default function SuperAdmin({ estateId }: Props) {
  const [ssn, setSsn] = React.useState<string>("");
  const [justification, setJustification] = React.useState<string>("");
  const [isValid, setIsValid] = React.useState<boolean>(true);
  const [popoverOpen, setPopoverOpen] = React.useState<boolean>(false);

  const isFormValid = isValid && ssn && justification;

  const superadminMutationFn = async ({
    estateId,
    ssn,
    justification,
    method,
  }: SuperadminPayload) => {
    const response = await fetch(`/api/estate/${estateId}/superadmin`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body:
        method === "POST" ? JSON.stringify({ ssn, justification }) : undefined,
    });

    if (!response.ok) {
      const errorMessage =
        method === "POST"
          ? "Failed to give admin access"
          : "Failed to remove admin access";
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const addMutation = useMutation({
    mutationKey: ["add-superadmin", ssn],
    mutationFn: () =>
      superadminMutationFn({
        estateId,
        ssn,
        justification,
        method: "POST",
      }),
    onSuccess: () => {
      setSsn("");
      setJustification("");
      setPopoverOpen(false);
    },
    onError: (error) => {
      console.error("Error granting admin access:", error);
    },
  });

  const removeMutation = useMutation({
    mutationKey: ["remove-superadmin", estateId],
    mutationFn: () =>
      superadminMutationFn({
        estateId,
        method: "DELETE",
      }),
    onSuccess: () => {
      setSsn("");
      setJustification("");
    },
    onError: (error) => {
      console.error("Error removing admin access:", error);
    },
  });

  const validateSsn = (ssn: string): boolean => {
    const ssnPattern = /^[0-9]{11}$/;
    return ssnPattern.test(ssn);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isFormValid) {
      console.error("Form is invalid");
      return;
    }

    addMutation.mutate();
    setPopoverOpen(false);
    setSsn("");
    setJustification("");
  };

  const handleRemove = () => {
    removeMutation.mutate();
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Fieldset>
          <Fieldset.Legend>
            Gi midlertidig tilgang (super-admin)
          </Fieldset.Legend>
          <Fieldset.Description>
            Fyll ut fødselsnummeret (11 siffer) til brukeren som skal få
            midlertidig tilgang til boet, og en kort begrunnelse for hvorfor
            dette er nødvendig.
          </Fieldset.Description>
          <Textfield
            label="Fødselsnummer"
            onChange={(e) => setSsn(e.target.value)}
            onBlur={(e) => setIsValid(validateSsn(e.target.value))}
            value={ssn}
            required
            size={11}
            error={
              !isValid && ssn ? "Fødselsnummeret må være 11 siffer." : undefined
            }
          />

          <Textfield
            label="Begrunnelse"
            onChange={(e) => setJustification(e.target.value)}
            value={justification}
            required
          />

          <div className="flex-row" style={{ marginTop: "var(--ds-size-8)" }}>
            <Popover.TriggerContext>
              <Popover.Trigger
                disabled={!isFormValid}
                aria-label="Gi tilgang"
                onClick={() => setPopoverOpen(true)}
              >
                <EnterIcon />
                Gi tilgang
              </Popover.Trigger>
              <Popover
                data-color="warning"
                open={popoverOpen}
                onClose={() => setPopoverOpen(false)}
              >
                <Paragraph>
                  Er du sikker på at du vil gi midlertidig tilgang til dette
                  boet?
                </Paragraph>
                <div
                  style={{
                    marginTop: "var(--ds-size-2)",
                  }}
                  className="flex-row"
                >
                  <Button data-size="sm" type="submit">
                    Ja, gi tilgang
                  </Button>
                  <Button
                    data-size="sm"
                    variant="tertiary"
                    onClick={() => setPopoverOpen(false)}
                  >
                    Avbryt
                  </Button>
                </div>
              </Popover>
            </Popover.TriggerContext>
            <Button variant="secondary" onClick={handleRemove}>
              <LeaveIcon />
              Fjern tilgang
            </Button>
          </div>
        </Fieldset>
      </form>

      <Divider />

      <Heading level={2} data-size="xs">
        Nyttige lenker
      </Heading>

      <List.Unordered
        style={{
          listStyle: "none",
          padding: 0,
        }}
      >
        <List.Item>
          <Link href="https://www.altinn.no/" target="_blank">
            Logg inn i Altinn
          </Link>
        </List.Item>
        <List.Item>
          <Link href="#" target="_blank">
            Digitalt Dødsbo etter avdøde
          </Link>
        </List.Item>
      </List.Unordered>

      <Heading
        level={2}
        data-size="xs"
        style={{ marginTop: "var(--ds-size-2)" }}
      >
        Tilganger for dette boet
      </Heading>
      <RoleTable estateId={estateId} />
    </>
  );
}
