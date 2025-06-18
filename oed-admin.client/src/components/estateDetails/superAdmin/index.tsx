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

interface Props {
  estateId: string;
}

export default function SuperAdmin({ estateId }: Props) {
  const [ssn, setSsn] = React.useState<string>("");
  const [justification, setJustification] = React.useState<string>("");
  const [isValid, setIsValid] = React.useState<boolean>(true);
  const [popoverOpen, setPopoverOpen] = React.useState<boolean>(false);

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
    console.log("Giving admin access for SSN:", ssn);
  };

  const handleRemoveAdminAccess = () => {
    console.log("Removing admin access for SSN:", ssn);
    setSsn("");
    setJustification("");
  };

  const isFormValid = isValid && ssn && justification;

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
                type="submit"
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
                  <Button data-size="sm">Ja, gi tilgang</Button>
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
            <Button variant="secondary" onClick={handleRemoveAdminAccess}>
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
