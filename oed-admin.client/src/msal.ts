import { BrowserCacheLocation, PublicClientApplication, type Configuration } from "@azure/msal-browser";

// MSAL configuration
const configuration: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID!,
    authority: "https://login.microsoftonline.com/cd0026d8-283b-4a55-9bfa-d0ef4a8ba21c",
    redirectUri: '/redirect'
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage // "sessionStorage"
  }
};

export const msalScopes = { api: [`api://${configuration.auth.clientId}/AccessToken.Read`] };

export const msalInstance = new PublicClientApplication(configuration);