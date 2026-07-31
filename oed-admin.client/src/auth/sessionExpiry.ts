import { useSyncExternalStore } from "react";
import {
  BrowserAuthErrorCodes,
  ClientAuthErrorCodes,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";

/**
 * Why the app can no longer call the API.
 *
 * The distinction is the whole point of this module: both cases look identical from the outside
 * (every request fails) but they have opposite remedies, and offering the wrong one loops.
 *
 * - "expired"  - MSAL can no longer renew the token silently. An interactive login fixes it.
 * - "rejected" - MSAL renewed the token successfully and the server still answered 401. The
 *                session is fine; the API will not accept it. Logging in again CANNOT help,
 *                because the new token gets rejected for exactly the same reason.
 */
export type AuthBlockedReason = "expired" | "rejected";

/**
 * The message on both errors is deliberately user-facing and Norwegian: several components
 * render error.message straight to the screen (districtCourts, estateSearch, estateDaObject,
 * estateCorrespondences, qaDashboard).
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("Innloggingen har utløpt");
    this.name = "SessionExpiredError";
  }
}

/** A token the server refuses. Separate from expiry so the UI never offers a pointless re-login. */
export class TokenRejectedError extends Error {
  constructor() {
    super("Tjenesten avviste innloggingen din");
    this.name = "TokenRejectedError";
  }
}

export const isSessionExpiredError = function (error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

export const isTokenRejectedError = function (error: unknown): error is TokenRejectedError {
  return error instanceof TokenRejectedError;
}

/** Either failure mode. Retrying the request cannot fix one any more than the other. */
export const isAuthBlockedError = function (error: unknown): boolean {
  return isSessionExpiredError(error) || isTokenRejectedError(error);
}

/**
 * MSAL error codes that mean the session is over and only an interactive login can fix it.
 *
 * monitor_window_timeout is the one that matters most in practice: SilentIframeClient rethrows
 * it unchanged when the hidden renewal iframe is blocked (third-party cookie policy on
 * login.microsoftonline.com), so the failure does NOT arrive as an InteractionRequiredAuthError.
 */
const sessionOverCodes = new Set<string>([
  BrowserAuthErrorCodes.monitorWindowTimeout,
  BrowserAuthErrorCodes.hashEmptyError,
  BrowserAuthErrorCodes.noStateInHash,
  ClientAuthErrorCodes.tokenRefreshRequired,
]);

const getErrorCode = function (error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("errorCode" in error)) {
    return undefined;
  }
  const { errorCode } = error as { errorCode: unknown };

  return typeof errorCode === "string" ? errorCode : undefined;
}

/**
 * Distinguishes "the session is over" from "something else went wrong".
 *
 * Anything not recognised here must be rethrown unchanged so the existing inline error UI
 * handles it. In particular block_iframe_reload, redirect_in_iframe, interaction_in_progress
 * and plain network failures are NOT session problems - we must not tell the user their
 * session died because the network blipped.
 */
export const isSessionOver = function (error: unknown): boolean {
  if (error instanceof InteractionRequiredAuthError) {
    return true;
  }
  const errorCode = getErrorCode(error);

  return errorCode !== undefined && sessionOverCodes.has(errorCode);
}

/**
 * Counts the interactive logins launched from the dialog, so a login that does not fix the
 * problem cannot be offered forever.
 *
 * sessionStorage rather than memory because the counter has to survive the very redirect it is
 * counting, and rather than localStorage because it must stay per-tab: one stuck tab must not
 * disarm the login button in another.
 */
const reauthAttemptsKey = "oed-admin:reauth-attempts";
export const maxReauthAttempts = 2;

export const reauthAttempts = function (): number {
  const stored = Number.parseInt(sessionStorage.getItem(reauthAttemptsKey) ?? "", 10);

  return Number.isNaN(stored) ? 0 : stored;
}

export const countReauthAttempt = function () {
  sessionStorage.setItem(reauthAttemptsKey, String(reauthAttempts() + 1));
}

/**
 * The latch is deliberately in memory only. Persisting it would make it visible to MSAL's
 * hidden renewal iframe and to every other tab (the token cache is shared via localStorage),
 * which would pop the dialog everywhere and could kill a renewal that was still in flight.
 */
let blockedReason: AuthBlockedReason | null = null;
const listeners = new Set<() => void>();

const emit = function () {
  listeners.forEach((listener) => listener());
}

export const authBlockedReason = function (): AuthBlockedReason | null {
  return blockedReason;
}

export const isAuthBlocked = function (): boolean {
  return blockedReason !== null;
}

/**
 * First reason wins, and repeat calls are no-ops: 10-25 concurrent queries fail together (every
 * Tabs.Panel mounts and fetches at once) and StrictMode double-invokes effects, so this runs in
 * a burst. Whichever failure arrived first is the one the user is shown - both are dead ends for
 * the request either way.
 */
export const markAuthBlocked = function (reason: AuthBlockedReason) {
  if (blockedReason !== null) {
    return;
  }
  blockedReason = reason;
  emit();
}

export const clearAuthBlocked = function () {
  if (blockedReason === null) {
    // Hot path: called after every successful response, so it has to stay a cheap no-op.
    return;
  }
  blockedReason = null;
  sessionStorage.removeItem(reauthAttemptsKey);
  emit();
}

const subscribe = function (listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Lets a plain non-React module (fetchWithMsal) notify React that the API is unreachable. */
export const useAuthBlockedReason = function (): AuthBlockedReason | null {
  return useSyncExternalStore(subscribe, authBlockedReason);
}
