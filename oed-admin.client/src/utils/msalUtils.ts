import type { AccountInfo } from "@azure/msal-browser";

export const hasRole = function (account: AccountInfo | null, role: string): boolean {
  if (!account || !account.idTokenClaims) {
    return false;
  }
  const roles = account.idTokenClaims["roles"] as string[] | undefined;
  if (!roles) {
    return false;
  }

  return roles.includes(role);
}