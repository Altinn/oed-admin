import React from "react";
import { Button, Dialog, Heading, Paragraph, Spinner } from "@digdir/designsystemet-react";
import { useQueryClient } from "@tanstack/react-query";
import { msalInstance, msalScopes } from "../../msal";
import { clearSessionExpired, isSessionExpired, useSessionExpired } from "../../auth/sessionExpiry";

/**
 * Tells the user their Entra session is gone, instead of leaving the app looking signed in
 * while every request fails.
 *
 * Mounted in main.tsx as a sibling of <App />, not inside it: MsalAuthenticationTemplate swaps
 * its children for loadingComponent whenever an interaction is in progress, and
 * AuthenticatedTemplate gates the whole Layout. A sibling renders regardless of route, role or
 * interaction status.
 */
export default function SessionExpiredDialog() {
  const expired = useSessionExpired();
  const [busy, setBusy] = React.useState<boolean>(false);
  const queryClient = useQueryClient();

  const account = msalInstance.getActiveAccount();

  const reauthenticate = async () => {
    setBusy(true);

    if (account) {
      try {
        // Another tab may already have signed in again - the token cache is shared through
        // localStorage - so try to recover without leaving the page.
        await msalInstance.acquireTokenSilent({ scopes: msalScopes.api, account: account });
        clearSessionExpired();
        await queryClient.invalidateQueries();
        setBusy(false);
        return;
      } catch {
        // Still no usable token: fall through to an interactive login.
      }
    }

    try {
      // loginRedirect rather than acquireTokenRedirect: it works even when the account entity
      // has been evicted, and it refreshes the id token that hasRole reads. Deliberately no
      // `prompt` - "none" is exactly what just failed.
      await msalInstance.loginRedirect({
        scopes: msalScopes.api,
        loginHint: account?.username
      });
    } catch {
      setBusy(false);
    }
  };

  const logoutUser = () => {
    // Also the escape hatch of last resort: a stranded interaction.status entry (tab closed
    // mid-redirect) blocks all further MSAL interaction, and logoutRedirect clears it.
    msalInstance.logoutRedirect({ account: account ?? undefined });
  };

  return (
    <Dialog
      open={expired}
      modal
      closeButton={false}
      closedby="none"
      onCancel={(event) => {
        // Esc fires a cancelable `cancel` event before the dialog closes. closedby="none"
        // already blocks Esc where it is supported (Chrome 134+), but this also covers
        // browsers that ignore closedby - without it, Esc would leave the user stranded in a
        // dead app with no way to sign in again.
        if (isSessionExpired()) {
          event.preventDefault();
        }
      }}
    >
      <Heading level={2} data-size="sm" style={{ marginBottom: "var(--ds-size-2)" }}>
        Innlogging utløpt
      </Heading>
      <Paragraph>Økten din har utløpt. Logg inn på nytt for å fortsette.</Paragraph>
      <Paragraph data-size="sm" style={{ marginTop: "var(--ds-size-2)" }}>
        Data som vises på siden kan være utdatert.
      </Paragraph>
      <div
        style={{
          display: "flex",
          gap: "var(--ds-size-2)",
          marginTop: "var(--ds-size-4)",
          alignItems: "center"
        }}
      >
        <Button disabled={busy} onClick={() => void reauthenticate()}>
          Logg inn på nytt
        </Button>
        <Button variant="secondary" disabled={busy} onClick={logoutUser}>
          Logg ut
        </Button>
        {busy && <Spinner aria-label="Logger inn på nytt" data-size="sm" />}
      </div>
    </Dialog>
  );
}
