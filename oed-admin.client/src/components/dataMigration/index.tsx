import React from "react";
import { Breadcrumbs, Button, Field, Fieldset, Heading, Input, Label, Paragraph, Switch } from "@digdir/designsystemet-react";
import { Link } from "react-router-dom";

export default function DataMigration() {
  const [statusText, setStatusText] = React.useState<string>("");

    const handleAction = async (formData: FormData) => {      
      const postData = { 
        batchSize: formData.get('batchSize'),
        updateExisting: formData.get('updateExisting') ? true : false
      }
      setStatusText('Sending...');

      const response = await fetch(`/api/maintenance/datamigration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });

      if (response.status == 202) {
        setStatusText(`Successfully started migration with params: ${JSON.stringify(postData)}`);
      }
      else {
        setStatusText(`Unable to start migration`);
      }

    };

  return (
    <>
      <Breadcrumbs>
        <Breadcrumbs.Link aria-label="Tilbake til Nivå 3" href="#" asChild>
          <Link to="/" aria-label="Tilbake til forsiden">
            Tilbake til oversikt
          </Link>
        </Breadcrumbs.Link>
      </Breadcrumbs>

      <Heading level={1} data-size="xl">
        Datamigrering
      </Heading>
      <Paragraph>
        Her kan du trigge datamigrering fra altinn instanser inn i 
        Digitalt Dødsbos interne metadatabase.
      </Paragraph>

      <form action={handleAction}>
        <Fieldset>
          <Fieldset.Legend>Fyll ut nødvendige data for å trigge en datamigrering!</Fieldset.Legend>
          <Field>
            <Label>Batch size</Label>
          </Field>
          <Input name="batchSize" defaultValue={100} />          
          <Switch
            description="Skal eksisterende data i metadatabasen oppdateres med data fra instansen?"
            label="Oppdatere eksisterende"
            defaultChecked={false}
            //defaultValue={false}
            value="updateExisting"
            name="updateExisting"
          />

          <Button type="submit">Start datamigrering!</Button>
        </Fieldset>
      </form>
      <Paragraph>{statusText}</Paragraph>

    </>

  )
}