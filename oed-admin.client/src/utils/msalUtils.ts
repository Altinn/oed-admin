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

/**
 * A request can only be replayed if its body is still readable. A stream or FormData body has
 * already been consumed by the first attempt.
 */
const isReplayable = function (init?: RequestInit): boolean {
  return init?.body == null || typeof init.body === 'string';
}

const acquireToken = async function (account: AccountInfo, forceRefresh: boolean): Promise<string> {
  try {
    // Note: acquireTokenSilent *rejects* on failure - it never resolves with a falsy token.
    const msalResponse = await msalInstance.acquireTokenSilent({
      scopes: msalScopes.api,
      account: account,
      forceRefresh: forceRefresh
    });

    return msalResponse.accessToken;
  } catch (error) {
    if (isSessionOver(error)) {
      markSessionExpired();
      throw new SessionExpiredError();
    }
    // Not an auth problem (offline, Entra 5xx, hidden-iframe guards): let the existing inline
    // error UI report it.
    throw error;
  }
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

  const withBearer = function (accessToken: string): RequestInit {
    return {
      ...init,
      headers: {
        ...init?.headers,
        'Authorization': `Bearer ${accessToken}`
      }
    };
  };

  let response = await fetch(input, withBearer(await acquireToken(account, false)));

  // The server is the authority on whether a token is acceptable, not MSAL.
  // acquireTokenSilent hands back the CACHED access token whenever MSAL still believes it is
  // valid - it does not mint a fresh one per call - so MSAL's view of expiry diverges from the
  // server's routinely: clock skew, the server's own ClockSkew grace, a revoked token, changed
  // app roles. Every divergence looks like "token acquired fine, then 401", which is the
  // dominant way an expired session actually shows up.
  if (response.status === 401 && isReplayable(init)) {
    // Safe to replay: a 401 short-circuits in the authorization middleware before the endpoint
    // runs, so nothing was applied server-side. Forcing a refresh silently fixes the common
    // stale-cache case without bothering the user.
    response = await fetch(input, withBearer(await acquireToken(account, true)));
  }

  if (response.status === 401) {
    // A freshly refreshed token was still rejected: the session really is over.
    markSessionExpired();
    throw new SessionExpiredError();
  }

  // Any other status means the request was authenticated and reached the endpoint, so the
  // session is healthy - including 403, which is a missing role and must NOT trigger re-auth
  // (re-authenticating cannot grant a role, and treating it as expiry would loop).
  clearSessionExpired();

  return response;
}