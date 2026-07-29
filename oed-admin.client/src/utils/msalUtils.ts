import type { AccountInfo } from '@azure/msal-browser';
import { msalInstance, msalScopes } from '../msal';
import {
  SessionExpiredError,
  clearSessionExpired,
  isSessionExpired,
  isSessionOver,
  markSessionExpired
} from '../auth/sessionExpiry';

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
  // Once we know the session is over, fail fast. Tabs.Panel renders its children
  // unconditionally, so Home mounts ~8 query-bearing panels and estateDetails ~10; without
  // this each one would burn its own 10s silent-renewal iframe timeout.
  if (isSessionExpired()) {
    throw new SessionExpiredError();
  }

  const account = msalInstance.getActiveAccount();
  if (!account) {
    // Reachable in production: MSAL's cacheRetentionDays defaults to 5, so the account entity
    // is evicted after a few days away.
    markSessionExpired();
    throw new SessionExpiredError();
  }

  let accessToken: string;
  try {
    // Note: acquireTokenSilent *rejects* on failure - it never resolves with a falsy token.
    const msalResponse = await msalInstance.acquireTokenSilent({
      scopes: msalScopes.api,
      account: account
    });
    accessToken = msalResponse.accessToken;
  } catch (error) {
    if (isSessionOver(error)) {
      markSessionExpired();
      throw new SessionExpiredError();
    }
    // Not an auth problem (offline, Entra 5xx, hidden-iframe guards): let the existing inline
    // error UI report it.
    throw error;
  }

  clearSessionExpired();

  const initOverride: RequestInit = {
    ...init,
    headers: {
      ...init?.headers,
      'Authorization': `Bearer ${accessToken}`
    }
  };

  return fetch(input, initOverride);
}