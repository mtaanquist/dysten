import type { AuthProvider, ExternalIdentity } from "./types";

/**
 * Microsoft 365 / Entra ID provider — the intended production auth.
 *
 * Deliberately left unimplemented rather than guessed at: wiring it needs a
 * tenant id, an app registration's client id and secret, and redirect URIs
 * that only whoever owns the tenant can supply.
 *
 * To finish it:
 *
 *   1. Register an app in Entra ID. Set "Supported account types" to
 *      **"Accounts in this organizational directory only"** — see the tenant
 *      lock-down notes below. Add a web redirect URI of
 *      {APP_URL}/api/auth/callback and grant the delegated `User.Read` scope.
 *   2. Set AUTH_PROVIDER=entra plus ENTRA_TENANT_ID, ENTRA_CLIENT_ID and
 *      ENTRA_CLIENT_SECRET (see .env.example).
 *   3. Implement the authorization-code exchange below — @azure/msal-node's
 *      ConfidentialClientApplication covers it in a few dozen lines — and map
 *      the validated claims onto ExternalIdentity: `oid` to externalId,
 *      `preferred_username`/`mail` to email, `name` to displayName.
 *   4. Pass the validated claims through `assertTenantAllowed` before trusting
 *      them.
 *
 * User provisioning, role assignment and the first-user-becomes-admin rule are
 * already handled in ./index.ts and need no changes.
 *
 * ---------------------------------------------------------------------------
 * Restricting sign-in to a single tenant
 * ---------------------------------------------------------------------------
 * Three independent layers. Use all three — the first two are configuration
 * that is easy to get subtly wrong, and the third is the check that catches it.
 *
 *   1. **Register the app as single-tenant.** "Accounts in this organizational
 *      directory only" makes Microsoft itself refuse to issue tokens for other
 *      tenants. This is the primary control.
 *
 *   2. **Use the tenant-scoped authority**, never the multi-tenant ones:
 *
 *          https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0   ✅
 *          https://login.microsoftonline.com/common/v2.0               ❌
 *          https://login.microsoftonline.com/organizations/v2.0        ❌
 *
 *      `/common` is the single most common way an app meant for one company
 *      quietly accepts sign-ins from every Microsoft tenant on earth.
 *
 *   3. **Verify the `tid` claim** on the validated token equals your tenant id,
 *      and reject if not — `assertTenantAllowed` below. Configuration drifts;
 *      an assertion in code does not.
 *
 * A note on guests: B2B guest accounts invited into your directory legitimately
 * carry your `tid` while belonging to another organisation. If contractors and
 * partners should not appear on the leaderboard, set ENTRA_ALLOW_GUESTS=false —
 * the check uses the `acct` claim, which is 0 for members and 1 for guests.
 */

export interface EntraClaims {
  /** Tenant id the token was issued for. */
  tid?: string;
  /** Immutable object id of the user. */
  oid?: string;
  /** Issuer; should also carry the tenant id. */
  iss?: string;
  /** Account type: 0 = member of this tenant, 1 = guest. */
  acct?: number;
  [claim: string]: unknown;
}

/**
 * Rejects any identity that is not from the configured tenant.
 *
 * Throws rather than returning false: this is the last line between "someone
 * from another company signed in" and a populated user record, and a thrown
 * error cannot be accidentally ignored by a caller that forgets to check a
 * boolean.
 */
export function assertTenantAllowed(claims: EntraClaims): void {
  const expected = process.env.ENTRA_TENANT_ID?.trim();
  if (!expected) {
    throw new Error("ENTRA_TENANT_ID is not set; refusing to accept any Entra sign-in.");
  }

  if (claims.tid !== expected) {
    throw new Error(
      `Sign-in rejected: token is from tenant ${claims.tid ?? "unknown"}, expected ${expected}. ` +
        "Check that the app registration is single-tenant and that the authority URL " +
        "contains the tenant id rather than /common or /organizations.",
    );
  }

  // The issuer independently encodes the tenant; a mismatch means the token
  // came from somewhere other than where it claims.
  if (claims.iss && !claims.iss.includes(expected)) {
    throw new Error(`Sign-in rejected: issuer ${claims.iss} does not match tenant ${expected}.`);
  }

  const allowGuests = process.env.ENTRA_ALLOW_GUESTS !== "false";
  if (!allowGuests && claims.acct === 1) {
    throw new Error("Sign-in rejected: guest accounts are not permitted.");
  }
}

export const entraAuthProvider: AuthProvider = {
  name: "entra",

  isConfigured() {
    return Boolean(
      process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET,
    );
  },

  async getIdentity(): Promise<ExternalIdentity | null> {
    throw new Error(
      "Entra ID authentication is selected but not implemented yet. " +
        "Set AUTH_PROVIDER=dev to use the development sign-in, or implement " +
        "src/lib/auth/entra-provider.ts as documented in that file.",
    );
  },

  /** Must point at the tenant-scoped authority — see the notes above. */
  signInUrl() {
    return "/api/auth/signin";
  },

  signOutUrl() {
    return "/api/auth/signout";
  },
};
