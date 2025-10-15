import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication, type Configuration } from "@azure/msal-browser";

// MSAL configuration
const configuration: Configuration = {
  auth: {
    clientId: "d96b3149-9c75-4bab-9826-ec5148d983af",
    authority: "https://login.microsoftonline.com/cd0026d8-283b-4a55-9bfa-d0ef4a8ba21c",
    redirectUri: '/redirect'
  }
};

const pca = new PublicClientApplication(configuration);
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.VITE_BASE_URL}>
      <MsalProvider instance={pca}>
        <QueryClientProvider client={queryClient}>
          <App />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </MsalProvider>
    </BrowserRouter>
  </StrictMode>
);
