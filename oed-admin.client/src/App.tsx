import React, { useEffect } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import Home from "./components/Home";
import EstateDetails from "./components/estateDetails";
import {
  Avatar,
  Dropdown,
  Heading,
  Switch,
} from "@digdir/designsystemet-react";
import type { WhoAmIResponse } from "./types/IEstate";
import { useQuery } from "@tanstack/react-query";
import { DoorOpenIcon } from "@navikt/aksel-icons";
import DataMigration from "./components/dataMigration";

export default function App() {
  const [darkMode, setDarkMode] = React.useState<boolean>(
    localStorage.getItem("darkMode") === "true"
  );

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

  const Layout = () => {
    return (
      <>
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
            <Dropdown.Trigger variant='tertiary'>
              <Avatar
                data-size="sm"
                data-color="neutral"
                aria-label={data?.name || "Username"}
              />
            </Dropdown.Trigger>
            <Dropdown>
              <Dropdown.Heading>{data?.name}</Dropdown.Heading>
              <Dropdown.List>
                <Dropdown.Item>
                  <Dropdown.Button onClick={() => window.location.href='/.auth/logout'}>
                    <DoorOpenIcon />
                    Logg ut!
                  </Dropdown.Button>
                </Dropdown.Item>
              </Dropdown.List>
            </Dropdown>
          </Dropdown.TriggerContext>
        </header>
        <main className="container" style={{maxWidth: 1600}}>
          <Outlet />
        </main>
      </>
    );
  };

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/estate/:id" element={<EstateDetails />} />
        <Route path="/maintenance/datamigration" element={<DataMigration />} />
      </Route>
    </Routes>
  );
}
