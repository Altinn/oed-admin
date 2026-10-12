import type { AccountInfo } from "@azure/msal-browser";

/**
 * The last signed-in user, kept outside MSAL's own cache.
 *
 * MSAL 4 encrypts its localStorage cache with a key held in a session cookie
 * (msal.cache.encryption), so after a browser restart the cached account is unreadable and
 * getActiveAccount() returns null. Without a hint of our own, every login after that showed
 * Entra's account picker even though the user was obviously the same person as yesterday.
 */
const loginHintKey = "oed-admin:login-hint";

const hintFor = function (account: AccountInfo | null): string | undefined {
  // loginHint is the login_hint ID token claim - opaque, and what Entra matches most reliably.
  // It is only present when the optional claim is configured, so fall back to the UPN.
  return account?.loginHint ?? account?.username;
}

export const rememberLoginHint = function (account: AccountInfo | null) {
  const hint = hintFor(account);
  if (hint) {
    localStorage.setItem(loginHintKey, hint);
  }
}

/** Called on logout, so the next person on a shared machine is not steered into this account. */
export const forgetLoginHint = function () {
  localStorage.removeItem(loginHintKey);
}

/** Skips the account picker for the last user; shows it only when we have never seen anyone. */
export const loginHintRequest = function (account: AccountInfo | null): { loginHint: string } | { prompt: string } {
  const hint = hintFor(account) ?? localStorage.getItem(loginHintKey);

  return hint ? { loginHint: hint } : { prompt: "select_account" };
}
