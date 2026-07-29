import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./msal.ts";
import { EventType, type AuthenticationResult, type EventMessage } from "@azure/msal-browser";
import SessionExpiredDialog from "./components/sessionExpired";
import { isSessionExpiredError } from "./auth/sessionExpiry.ts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retrying an expired session buys nothing and costs another silent-renewal iframe
      // timeout (10s each) per attempt, which is what used to leave skeletons on screen for
      // ~40 seconds before any error appeared.
      retry: (failureCount, error) => !isSessionExpiredError(error) && failureCount < 3
    },
    mutations: {
      retry: false
    }
  }
});

/**
 * MSAL renews tokens in a hidden iframe pointed at redirectUri ('/redirect'), which both the
 * server (MapFallbackToFile) and Vite answer with index.html - so the whole SPA would boot in
 * there and fire every query from inside the iframe, where acquireTokenSilent throws
 * block_iframe_reload. The parent window reads the response hash itself, so we must not render.
 */
const isMsalRenewalIframe = function (): boolean {
  if (window.self === window.top) {
    return false;
  }

  return /[#&](code|error|id_token|access_token|state)=/.test(window.location.hash);
}

const renderFatalError = function () {
  createRoot(document.getElementById("root")!).render(
    <main className="container" style={{ maxWidth: 1600 }}>
      <p>Kunne ikke starte applikasjonen. Last siden på nytt.</p>
    </main>
  );
}

const bootstrap = function () {
  // Account selection logic is app dependent. Adjust as needed for different use cases.
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  // Optional - This will update account state if a user signs in from another tab or window
  msalInstance.enableAccountStorageEvents();

  msalInstance.addEventCallback((event: EventMessage) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as AuthenticationResult;
      const account = payload.account;
      msalInstance.setActiveAccount(account);
    }
  });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.VITE_BASE_URL}>
        <MsalProvider instance={msalInstance}>
          <QueryClientProvider client={queryClient}>
            <App />
            <SessionExpiredDialog />
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </MsalProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

if (!isMsalRenewalIframe()) {
  msalInstance.initialize()
    .then(bootstrap)
    .catch(() => renderFatalError());
}
