/**
 * Who is allowed to sign in, and where the OAuth endpoints live.
 *
 * Split out from entra-provider.ts on purpose: this is the security-critical
 * part, and keeping it free of `next/headers` and Prisma means it can be tested
 * as plain functions rather than only exercised by a real sign-in against a
 * real tenant — which is exactly the code you least want to be testing for the
 * first time in production.
 *
 * ---------------------------------------------------------------------------
 * Restricting who may sign in
 * ---------------------------------------------------------------------------
 * ENTRA_TENANT_IDS is a comma-separated allowlist. With one entry — the normal
 * case for a single company — three independent layers hold:
 *
 *   1. **Register the app as single-tenant**, "Accounts in this organizational
 *      directory only". Microsoft itself then refuses to issue a token to
 *      anybody else, which is the strongest of the three because it does not
 *      depend on this code being right.
 *
 *   2. **The authority names the tenant**, never /common or /organizations.
 *      `/common` is the single most common way an app meant for one company
 *      quietly accepts sign-ins from every Microsoft tenant on earth.
 *
 *   3. **The `tid` claim is checked** against the allowlist — assertTenantAllowed
 *      below. Configuration drifts; an assertion in code does not.
 *
 * With more than one entry, layers 1 and 2 are gone and cannot be recovered:
 * no authority URL names a *subset* of tenants, so the app registration has to
 * be multi-tenant and the authority becomes /organizations. The allowlist stops
 * being a backstop and becomes the only thing standing between the app and
 * every Microsoft tenant on earth. That is a change in posture, not a config
 * tweak — which is why a second tenant is something you have to type out.
 *
 * A note on guests: B2B guest accounts invited into your directory legitimately
 * carry your `tid` while belonging to another organisation. If contractors and
 * partners should not appear on the leaderboard, set ENTRA_ALLOW_GUESTS=false —
 * the check uses the `acct` claim, which is 0 for members and 1 for guests.
 */

export const LOGIN_HOST = "https://login.microsoftonline.com";

export interface EntraClaims {
  /** Tenant id the token was issued for. */
  tid?: string;
  /** Immutable object id of the user — stable even if their email changes. */
  oid?: string;
  /** Issuer; independently encodes the tenant. */
  iss?: string;
  /** Account type: 0 = member of this tenant, 1 = guest. */
  acct?: number;
  preferred_username?: string;
  email?: string;
  name?: string;
  nonce?: string;
  [claim: string]: unknown;
}

/**
 * A sign-in refused on policy grounds — wrong tenant, or a guest where guests
 * are not allowed — as opposed to one that broke.
 *
 * Its own class rather than a string the callback matches on, because the two
 * cases need different words in front of the user: "your account is not from an
 * organisation that may use this app" is something they can act on, and
 * "something went wrong" is not.
 */
export class TenantNotAllowedError extends Error {
  readonly code = "tenant";
}

/**
 * The tenants permitted to sign in, in configuration order.
 *
 * Empty is not a default — an unset allowlist would mean every tenant, which is
 * never what anyone wants, so callers treat it as a configuration error rather
 * than falling back to something permissive.
 */
export function allowedTenantIds(): string[] {
  return (process.env.ENTRA_TENANT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * The path segment the OAuth endpoints hang off.
 *
 * One tenant gets its own id, which is what makes Microsoft refuse the rest.
 * Several have to share /organizations, because no authority names a subset.
 */
export function authorityTenant(): string {
  const ids = allowedTenantIds();
  if (ids.length === 0) {
    throw new Error(
      "ENTRA_TENANT_IDS is not set; refusing to accept any Entra sign-in. " +
        "Set it to the tenant id allowed to sign in, or a comma-separated list.",
    );
  }
  return ids.length === 1 ? ids[0] : "organizations";
}

/**
 * Rejects any identity that is not from an allowed tenant.
 *
 * Throws rather than returning false: this is the last line between "someone
 * from another company signed in" and a populated user record, and a thrown
 * error cannot be accidentally ignored by a caller that forgets to check a
 * boolean.
 *
 * Only ever call this on claims from a token whose signature has already been
 * verified. Unverified, every field here is attacker-controlled.
 */
export function assertTenantAllowed(claims: EntraClaims): void {
  const allowed = allowedTenantIds();
  if (allowed.length === 0) {
    throw new Error("ENTRA_TENANT_IDS is not set; refusing to accept any Entra sign-in.");
  }

  const tid = claims.tid;
  if (!tid || !allowed.includes(tid)) {
    throw new TenantNotAllowedError(
      `Sign-in rejected: token is from tenant ${tid ?? "unknown"}, which is not in ENTRA_TENANT_IDS. ` +
        "Check that the app registration's supported account types match the list, and that the " +
        "authority URL names a tenant rather than /common.",
    );
  }

  // The issuer independently encodes the tenant, so a token whose `iss` and
  // `tid` disagree came from somewhere other than where it claims. Compared
  // whole rather than by substring: a tenant id appearing *somewhere* in a
  // hostile issuer URL is not the same as the issuer being that tenant.
  const expectedIssuer = `${LOGIN_HOST}/${tid}/v2.0`;
  if (claims.iss !== expectedIssuer) {
    throw new TenantNotAllowedError(
      `Sign-in rejected: issuer ${claims.iss ?? "unknown"} does not match tenant ${tid}.`,
    );
  }

  const allowGuests = process.env.ENTRA_ALLOW_GUESTS !== "false";
  if (!allowGuests && claims.acct === 1) {
    throw new TenantNotAllowedError("Sign-in rejected: guest accounts are not permitted.");
  }
}
