import { PublicClientApplication, type Configuration } from "@azure/msal-browser";

// MSAL configuration
const configuration: Configuration = {
  auth: {
    clientId: "d96b3149-9c75-4bab-9826-ec5148d983af",
    authority: "https://login.microsoftonline.com/cd0026d8-283b-4a55-9bfa-d0ef4a8ba21c",
    redirectUri: '/redirect'
  }
};

export const msalInstance = new PublicClientApplication(configuration);

// Initialize active account
if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
  // Account selection logic is app dependent. Adjust as needed for different use cases.
  msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
}