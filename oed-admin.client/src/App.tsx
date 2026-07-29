import React, { useEffect } from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import Home from "./components/Home";
import EstateDetails from "./components/estateDetails";
import {
  Avatar,
  Button,
  Dropdown,
  Heading,
  Paragraph,
  Switch,
} from "@digdir/designsystemet-react";
// import type { WhoAmIResponse } from "./types/IEstate";
// import { useQuery } from "@tanstack/react-query";
import { DoorOpenIcon } from "@navikt/aksel-icons";
import DataMigration from "./components/dataMigration";
import {
  AuthenticatedTemplate,
  MsalAuthenticationTemplate,
  useMsal,
  type MsalAuthenticationResult,
} from "@azure/msal-react";
import { InteractionType, type AccountInfo } from "@azure/msal-browser";
import { hasRole } from "./utils/msalUtils";
import RestrictedHome from "./components/RestrictedHome";
import { msalScopes } from "./msal";
import EnvironmentInformation from "./components/environmentInformation";

export default function App() {
  const [darkMode, setDarkMode] = React.useState<boolean>(
    localStorage.getItem("darkMode") === "true",
  );

  const { instance } = useMsal();
  const account = instance.getActiveAccount() as AccountInfo;
  const isAdmin = hasRole(account, "Admin");
  const isReader = hasRole(account, "Read");

  useEffect(() => {
    const bodyDiv = document.getElementById("body");
    if (bodyDiv) {
      bodyDiv.setAttribute("data-color-scheme", darkMode ? "dark" : "light");
    }
  }, [darkMode]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isDarkMode = event.target.checked;
    const bodyDiv = document.getElementById("body");
    if (!bodyDiv) {
      return;
    }
    bodyDiv.setAttribute("data-color-scheme", isDarkMode ? "dark" : "light");
    setDarkMode(isDarkMode);
    localStorage.setItem("darkMode", isDarkMode ? "true" : "false");
  };

  const logoutUser = () => {
    instance.logoutRedirect({
      account: account,
    });
  };

  const Layout = () => {
    return (
      <AuthenticatedTemplate>
        <header className="header">
          <div className="flex-col">
            <Heading level={1} data-size="md">
              DD Admin
            </Heading>
            <Switch
              label="Mørk modus"
              position="end"
              checked={darkMode}
              onChange={handleChange}
              id="dark-mode"
            />
          </div>
          <EnvironmentInformation
            environment={import.meta.env.VITE_ENVIRONMENT}
          />
          <Dropdown.TriggerContext>
            <Dropdown.Trigger variant="tertiary">
              <Avatar
                data-size="sm"
                data-color="neutral"
                aria-label={account?.name || "Username"}
              />
            </Dropdown.Trigger>
            <Dropdown>
              <Dropdown.Heading>{account?.name}</Dropdown.Heading>
              <Dropdown.List>
                <Dropdown.Item>
                  <Dropdown.Button onClick={logoutUser}>
                    <DoorOpenIcon />
                    Logg ut!
                  </Dropdown.Button>
                </Dropdown.Item>
              </Dropdown.List>
            </Dropdown>
          </Dropdown.TriggerContext>
        </header>
        <main className="container" style={{ maxWidth: 1920 }}>
          <Outlet />
        </main>
      </AuthenticatedTemplate>
    );
  };

  const roleBasedRoutes = () => {
    if (isAdmin) {
      return (
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="/restrictedSearch" element={<RestrictedHome />} />
            <Route index element={<Home />} />
            <Route path="/estate/:id" element={<EstateDetails />} />
            <Route
              path="/maintenance/datamigration"
              element={<DataMigration />}
            />
          </Route>
        </Routes>
      );
    }

    if (isReader) {
      return (
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Layout />
                <Navigate to="/restrictedSearch" replace={true} />
              </>
            }
          >
            <Route
              path="/restrictedSearch"
              index
              element={<RestrictedHome />}
            />
          </Route>
        </Routes>
      );
    }

    // Not wrapped in UnauthenticatedTemplate: a signed-in user without an app role *is*
    // authenticated, so that wrapper rendered nothing and they were left with a blank page.
    return (
      <main className="container" style={{ maxWidth: 1600 }}>
        <Paragraph>
          Du har ikke tilgang til denne applikasjonen. Kontakt systemansvarlig.
        </Paragraph>
      </main>
    );
  };

  // Deliberately no `prompt: "none"`. msal-react forwards this same request object into the
  // *interactive* loginRedirect when the silent call fails, so a dead Entra session answers
  // login_required - and MsalAuthenticationTemplate checks `error` before `isAuthenticated`,
  // replacing the whole app with an error screen it never retries out of.
  const authRequest = account
    ? { scopes: msalScopes.api, loginHint: account.username }
    : { scopes: msalScopes.api, prompt: "select_account" };

  return (
    <MsalAuthenticationTemplate
      interactionType={InteractionType.Redirect}
      authenticationRequest={authRequest}
      errorComponent={(authResult: MsalAuthenticationResult) => (
        <main className="container" style={{ maxWidth: 1600 }}>
          <Heading level={1} data-size="md">
            Innlogging feilet
          </Heading>
          <Paragraph data-size="sm" style={{ marginTop: "var(--ds-size-2)" }}>
            {authResult.error?.errorCode}
          </Paragraph>
          <Button
            style={{ marginTop: "var(--ds-size-4)" }}
            onClick={() =>
              void instance.loginRedirect({ scopes: msalScopes.api })
            }
          >
            Logg inn på nytt
          </Button>
        </main>
      )}
      loadingComponent={() => <Paragraph>Laster … Vennligst vent.</Paragraph>}
    >
      {roleBasedRoutes()}
    </MsalAuthenticationTemplate>
  );
}
