import { Button, Heading, Paragraph, Spinner } from "@digdir/designsystemet-react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { Navigate } from "react-router-dom";
import { msalScopes } from "../../msal";

/**
 * Landing page for MSAL's redirectUri ('/redirect').
 *
 * The server answers /redirect with index.html, so the SPA genuinely mounts here after every
 * interactive login. Without a component for it the router matched nothing and rendered a blank
 * page - not even the header.
 *
 * This must be rendered OUTSIDE MsalAuthenticationTemplate. That template's
 * useMsalAuthentication calls loginRedirect whenever no account is in context yet, and
 * loginRedirect defaults its return page to window.location.href
 * (RedirectClient.getRedirectStartPage). Firing it while we are sitting on /redirect stores
 * /redirect as the page to come back to, so Entra returns the user here again - which is what
 * strands them on a blank /redirect permanently.
 */
export default function AuthRedirect() {
  const { instance, inProgress, accounts } = useMsal();

  if (inProgress !== InteractionStatus.None) {
    return (
      <main className="container" style={{ maxWidth: 1600 }}>
        <Paragraph>
          <Spinner aria-label="Fullfører innlogging" data-size="sm" /> Fullfører innlogging …
        </Paragraph>
      </main>
    );
  }

  if (accounts.length > 0) {
    return <Navigate to="/" replace={true} />;
  }

  // Deliberately no automatic retry: relaunching login from here is how the loop starts.
  return (
    <main className="container" style={{ maxWidth: 1600 }}>
      <Heading level={1} data-size="md">
        Innlogging feilet
      </Heading>
      <Paragraph style={{ marginTop: "var(--ds-size-2)" }}>
        Vi klarte ikke å fullføre innloggingen. Prøv igjen.
      </Paragraph>
      <Button
        style={{ marginTop: "var(--ds-size-4)" }}
        onClick={() =>
          void instance.loginRedirect({
            scopes: msalScopes.api,
            // Never let /redirect become the page we are sent back to.
            redirectStartPage: `${window.location.origin}/`
          })
        }
      >
        Logg inn på nytt
      </Button>
    </main>
  );
}
