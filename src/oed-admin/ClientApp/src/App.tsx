import React, { useEffect } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import Home from "./components/Home";
import EstateDetails from "./components/estateDetails";
import {
  Avatar,
  Heading,
  Paragraph,
  Switch,
} from "@digdir/designsystemet-react";

export default function App() {
  const [darkMode, setDarkMode] = React.useState<boolean>(
    localStorage.getItem("darkMode") === "true"
  );

  useEffect(() => {
    const rootDiv = document.getElementById("root");
    if (rootDiv) {
      rootDiv.setAttribute("data-color-scheme", darkMode ? "dark" : "light");
    }
  }, [darkMode]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isDarkMode = event.target.checked;
    const rootDiv = document.getElementById("root");
    if (!rootDiv) {
      return;
    }
    rootDiv.setAttribute("data-color-scheme", isDarkMode ? "dark" : "light");
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
          <div className="username">
            <Paragraph>thomas@digdir.no</Paragraph>
            <Avatar
              data-size="sm"
              data-color="neutral"
              aria-label="Ola Nordmann"
            />
          </div>
        </header>
        <main className="container">
          <Outlet />
        </main>
      </>
    );
  };

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/deceased/:partyId" element={<EstateDetails />} />
      </Route>
    </Routes>
  );
}
