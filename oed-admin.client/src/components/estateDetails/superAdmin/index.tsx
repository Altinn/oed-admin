import React from "react";
import {
  Button,
  Fieldset,
  Heading,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react";
import RoleTable from "../estateRoles/RoleTable";

interface Props {
  estateId: string;
}

export default function SuperAdmin({ estateId }: Props) {
  const [ssn, setSsn] = React.useState<string>("");
  const [justification, setJustification] = React.useState<string>("");
  const [isValid, setIsValid] = React.useState<boolean>(true);

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
      <Paragraph>
        Her kan du gi en midlertidig admin-tilgang til dødsboet. Dette kan være
        nyttig for å finne feil, eller verifisere løsningen i
        produksjonsmiljøet. Brukeren vil dermed kunne logge seg inn i boet med
        sin private bank-id.
      </Paragraph>
      <form onSubmit={handleSubmit}>
        <Fieldset>
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

          <div className="flex-row">
            <Button type="submit" data-color="danger" disabled={!isFormValid}>
              Gi admin-tilgang
            </Button>
            <Button
              variant="secondary"
              data-color="danger"
              onClick={handleRemoveAdminAccess}
            >
              Fjern admin-tilgang
            </Button>
          </div>
        </Fieldset>
      </form>
      <Heading
        level={2}
        data-size="sm"
        style={{ marginTop: "var(--ds-size-2)" }}
      >
        Superadmin-tilganger
      </Heading>
      <RoleTable estateId={estateId} />
    </>
  );
}
