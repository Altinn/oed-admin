import React from "react";
import { Button, Dialog, Heading, Paragraph, Spinner } from "@digdir/designsystemet-react";
import { useQueryClient } from "@tanstack/react-query";
import { msalInstance, msalScopes } from "../../msal";
import {
  clearAuthBlocked,
  countReauthAttempt,
  isAuthBlocked,
  maxReauthAttempts,
  reauthAttempts,
  useAuthBlockedReason
} from "../../auth/sessionExpiry";

/**
 * Tells the user why the app has stopped working, instead of leaving it looking signed in while
 * every request fails.
 *
 * Two cases, deliberately worded and actioned differently:
 *
 * - "expired"  - the session is gone. Offer a login; it will work.
 * - "rejected" - the server refused a token minted seconds ago. Offering a login here is what
 *                produces an endless modal-redirect-modal loop, because the fresh token is
 *                rejected on arrival exactly like the last one. Say so, and offer only the exit.
 *
 * Mounted in main.tsx as a sibling of <App />, not inside it: MsalAuthenticationTemplate swaps
 * its children for loadingComponent whenever an interaction is in progress, and
 * AuthenticatedTemplate gates the whole Layout. A sibling renders regardless of route, role or
 * interaction status.
 */
export default function SessionExpiredDialog() {
  const reason = useAuthBlockedReason();
  const [busy, setBusy] = React.useState<boolean>(false);
  const queryClient = useQueryClient();

  const account = msalInstance.getActiveAccount();

  // A login is only worth offering when it can actually help. Past the cap it demonstrably has
  // not helped, so stop offering it however we got here.
  const canRetryLogin = reason === "expired" && reauthAttempts() < maxReauthAttempts;

  const recheck = async () => {
    // Cheap, no redirect: drop the latch and let the queries try again. If the server is still
    // refusing, the first response re-latches and we are back here - no loop, no navigation.
    setBusy(true);
    clearAuthBlocked();
    await queryClient.invalidateQueries();
    setBusy(false);
  };

  const reauthenticate = async () => {
    setBusy(true);

    if (account) {
      try {
        // Another tab may already have signed in again - the token cache is shared through
        // localStorage - so try to recover without leaving the page.
        await msalInstance.acquireTokenSilent({ scopes: msalScopes.api, account: account });
        clearAuthBlocked();
        await queryClient.invalidateQueries();
        setBusy(false);
        return;
      } catch {
        // Still no usable token: fall through to an interactive login.
      }
    }

    try {
      // Counted before leaving the page, because we are about to stop executing: if this login
      // does not fix anything, the count is what stops us offering it a third time.
      countReauthAttempt();
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
      open={reason !== null}
      modal
      closeButton={false}
      closedby="none"
      onCancel={(event) => {
        // Esc fires a cancelable `cancel` event before the dialog closes. closedby="none"
        // already blocks Esc where it is supported (Chrome 134+), but this also covers
        // browsers that ignore closedby - without it, Esc would leave the user stranded in a
        // dead app with no way to sign in again.
        if (isAuthBlocked()) {
          event.preventDefault();
        }
      }}
    >
      <Heading level={2} data-size="sm" style={{ marginBottom: "var(--ds-size-2)" }}>
        {reason === "rejected" ? "Ingen tilgang til tjenesten" : "Innlogging utløpt"}
      </Heading>

      {reason === "rejected" ? (
        <>
          <Paragraph>
            Du er innlogget, men tjenesten avviser tilgangen din. Å logge inn på nytt hjelper
            ikke.
          </Paragraph>
          <Paragraph data-size="sm" style={{ marginTop: "var(--ds-size-2)" }}>
            Dette er en feil på serveren, ikke hos deg. Prøv igjen om litt, eller kontakt
            systemansvarlig hvis det vedvarer.
          </Paragraph>
        </>
      ) : (
        <>
          <Paragraph>Økten din har utløpt. Logg inn på nytt for å fortsette.</Paragraph>
          <Paragraph data-size="sm" style={{ marginTop: "var(--ds-size-2)" }}>
            {canRetryLogin
              ? "Data som vises på siden kan være utdatert."
              : "Innlogging er forsøkt flere ganger uten å løse problemet. Kontakt systemansvarlig."}
          </Paragraph>
        </>
      )}

      <div
        style={{
          display: "flex",
          gap: "var(--ds-size-2)",
          marginTop: "var(--ds-size-4)",
          alignItems: "center"
        }}
      >
        {canRetryLogin && (
          <Button disabled={busy} onClick={() => void reauthenticate()}>
            Logg inn på nytt
          </Button>
        )}
        {reason === "rejected" && (
          <Button disabled={busy} onClick={() => void recheck()}>
            Prøv igjen
          </Button>
        )}
        <Button variant="secondary" disabled={busy} onClick={logoutUser}>
          Logg ut
        </Button>
        {busy && <Spinner aria-label="Prøver på nytt" data-size="sm" />}
      </div>
    </Dialog>
  );
}
