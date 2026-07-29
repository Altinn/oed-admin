import { useSyncExternalStore } from "react";
import {
  BrowserAuthErrorCodes,
  ClientAuthErrorCodes,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";

/**
 * Thrown by fetchWithMsal when the Entra session can no longer be renewed silently.
 *
 * The message is deliberately user-facing and Norwegian: several components render
 * error.message straight to the screen (districtCourts, estateSearch, estateDaObject,
 * estateCorrespondences, qaDashboard).
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("Innloggingen har utløpt");
    this.name = "SessionExpiredError";
  }
}

export const isSessionExpiredError = function (error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
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
 * The latch is deliberately in memory only. Persisting it would make it visible to MSAL's
 * hidden renewal iframe and to every other tab (the token cache is shared via localStorage),
 * which would pop the dialog everywhere and could kill a renewal that was still in flight.
 */
let sessionExpired = false;
const listeners = new Set<() => void>();

const emit = function () {
  listeners.forEach((listener) => listener());
}

export const isSessionExpired = function (): boolean {
  return sessionExpired;
}

/** Idempotent: 10-25 concurrent queries reject together, and StrictMode double-invokes effects. */
export const markSessionExpired = function () {
  if (sessionExpired) {
    return;
  }
  sessionExpired = true;
  emit();
}

export const clearSessionExpired = function () {
  if (!sessionExpired) {
    return;
  }
  sessionExpired = false;
  emit();
}

const subscribe = function (listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Lets a plain non-React module (fetchWithMsal) notify React that the session is gone. */
export const useSessionExpired = function (): boolean {
  return useSyncExternalStore(subscribe, isSessionExpired);
}
