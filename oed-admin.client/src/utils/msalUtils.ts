import type { AccountInfo, SilentRequest } from '@azure/msal-browser';
import { msalInstance } from '../main';

export const hasRole = function (account: AccountInfo | null, role: string): boolean {
  if (!account || !account.idTokenClaims) {
    return false;
  }
  const roles = account.idTokenClaims['roles'] as string[] | undefined;
  if (!roles) {
    return false;
  }

  return roles.includes(role);
}

export const fetchWithMsal = async function (input: string | URL | Request, init?: RequestInit | undefined): Promise<Response> {
  const account = msalInstance.getActiveAccount();
  if (!account) {
    // Maybe do not throw, but redirect to login
    throw Error('No active account! Verify a user has been signed in and setActiveAccount has been called.');
  }
  const scopes = ['api://d96b3149-9c75-4bab-9826-ec5148d983af/AccessToken.Read'];
  const msalResponse = await msalInstance.acquireTokenSilent({
    scopes: scopes,
    account: account,
    redirectUri: '/redirect'
  } as SilentRequest);
  const accessToken = msalResponse.accessToken;

  if (!accessToken) {
    await msalInstance.acquireTokenRedirect({
      scopes: scopes,
      redirectUri: '/redirect'
    });
  }
  const initOverride: RequestInit = {
    ...init,
    headers: {
      ...init?.headers,
      'Authorization': `Bearer ${accessToken}`
    }
  };

  return fetch(input, initOverride);
}