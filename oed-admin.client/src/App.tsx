import React, { useEffect } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import Home from "./components/Home";
import EstateDetails from "./components/estateDetails";
import {
  Avatar,
  Dropdown,
  Heading,
  Paragraph,
  Switch,
} from "@digdir/designsystemet-react";
import type { WhoAmIResponse } from "./types/IEstate";
import { useQuery } from "@tanstack/react-query";
import { DoorOpenIcon } from "@navikt/aksel-icons";
import DataMigration from "./components/dataMigration";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
  useMsalAuthentication,
} from "@azure/msal-react";
import { InteractionType, type AccountInfo } from "@azure/msal-browser";
import { hasRole } from "./utils/msalUtils";

export default function App() {
  const [darkMode, setDarkMode] = React.useState<boolean>(
    localStorage.getItem("darkMode") === "true"
  );
  const { login, error } = useMsalAuthentication(InteractionType.Silent);
  useEffect(() => {
    if (error) {
      login(InteractionType.Redirect);
    }
  }, [error]);
  const { instance } = useMsal();
  // var account = instance.getActiveAccount();
  const account = instance.getAllAccounts()[0] as AccountInfo;
  const isAdmin = hasRole(account, "Admin");
  const isReader = hasRole(account, "Read");
  const { data } = useQuery<WhoAmIResponse>({
    queryKey: ["whoami"],
    queryFn: async () => {
      const response = await fetch(`/api/whoami`);
      if (!response.ok) {
        throw new Error("Failed to fetch whoami");
      }
      return response.json();
    },
  });

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
          <Dropdown.TriggerContext>
            <Dropdown.Trigger variant="tertiary">
              <Avatar
                data-size="sm"
                data-color="neutral"
                aria-label={data?.name || "Username"}
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
        <main className="container" style={{ maxWidth: 1600 }}>
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
          <Route path="/" element={<Layout />}></Route>
        </Routes>
      );
    }

    return (
      <UnauthenticatedTemplate>
        <main className="container" style={{ maxWidth: 1600 }}>
          <Paragraph>
            Du har ikke tilgang til denne applikasjonen. Kontakt
            systemansvarlig.
          </Paragraph>
        </main>
      </UnauthenticatedTemplate>
    );
  };

  return <>{roleBasedRoutes()}</>;
}
