import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, unsignValue } from "./cookies";
import type { AuthProvider, ExternalIdentity } from "./types";
import {
  LOGIN_HOST,
  allowedTenantIds,
  assertTenantAllowed,
  authorityTenant,
  type EntraClaims,
} from "./entra-tenant";

// Re-exported so callers have one import for "the Entra provider" and do not
// have to know that the tenant rules live in their own, dependency-free module.
export {
  TenantNotAllowedError,
  allowedTenantIds,
  assertTenantAllowed,
  authorityTenant,
} from "./entra-tenant";
export type { EntraClaims } from "./entra-tenant";

/**
 * Microsoft 365 / Entra ID — the production sign-in.
 *
 * The authorization-code flow with PKCE, done directly against the v2.0
 * endpoints rather than through @azure/msal-node. The app never calls Graph and
 * never needs an access token: every claim it wants — object id, email, display
 * name — is in the ID token. What is left once the token cache and the
 * silent-refresh machinery are dropped is one redirect, one POST and one
 * signature check, and `jose` is the only dependency that adds against four in
 * the whole project.
 *
 * Once someone has signed in, this provider behaves exactly like the dev one:
 * the callback route provisions the User row and writes the same signed session
 * cookie, and every request after that just reads it. The OAuth round trip
 * happens once, not per request.
 *
 * Who is allowed in is decided in ./entra-tenant.ts, which is deliberately free
 * of Next and Prisma imports so those rules can be tested as plain functions.
 */

const SCOPES = "openid profile email";

function endpoint(path: string): string {
  return `${LOGIN_HOST}/${authorityTenant()}/${path}`;
}

function clientId(): string {
  const value = process.env.ENTRA_CLIENT_ID?.trim();
  if (!value) throw new Error("ENTRA_CLIENT_ID is not set.");
  return value;
}

function clientSecret(): string {
  const value = process.env.ENTRA_CLIENT_SECRET?.trim();
  if (!value) throw new Error("ENTRA_CLIENT_SECRET is not set.");
  return value;
}

/**
 * Signing keys, fetched once and cached for the process lifetime with jose
 * handling rotation. Built lazily so that importing this module does not
 * require Entra configuration to be present — the dev provider is the default,
 * and its users have no tenant to name.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTenant: string | null = null;

function keySet() {
  const tenant = authorityTenant();
  if (!jwks || jwksTenant !== tenant) {
    jwks = createRemoteJWKSet(new URL(`${LOGIN_HOST}/${tenant}/discovery/v2.0/keys`));
    jwksTenant = tenant;
  }
  return jwks;
}

/** Where to send the browser to start the flow. */
export function authorizationUrl(params: {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(endpoint("oauth2/v2.0/authorize"));
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/** Trades the authorization code for an ID token. */
export async function exchangeCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<string> {
  const response = await fetch(endpoint("oauth2/v2.0/token"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
      scope: SCOPES,
    }),
    cache: "no-store",
  });

  const body = (await response.json()) as { id_token?: string; error_description?: string };
  if (!response.ok || !body.id_token) {
    // Microsoft's error_description carries the AADSTS code, which is the only
    // thing that makes these diagnosable. It names no user and no secret.
    throw new Error(`Token exchange failed: ${body.error_description ?? response.status}`);
  }
  return body.id_token;
}

/**
 * Verifies the ID token's signature and claims, then the tenant allowlist.
 *
 * The order is the point: nothing in the token is trusted — including the `tid`
 * the allowlist is checked against — until the signature has been verified
 * against Microsoft's published keys.
 */
export async function verifyIdToken(idToken: string, expectedNonce: string): Promise<EntraClaims> {
  const { payload } = await jwtVerify(idToken, keySet(), {
    audience: clientId(),
    // Not `issuer`: where several tenants are allowed each issues under its own
    // id, so the issuer is checked against the token's verified `tid` instead —
    // see assertTenantAllowed.
    clockTolerance: 60,
  });

  const claims = payload as EntraClaims;

  // Binds the token to the sign-in this browser started, so one captured
  // elsewhere cannot be replayed into a session here.
  if (claims.nonce !== expectedNonce) {
    throw new Error("Sign-in rejected: nonce mismatch.");
  }

  assertTenantAllowed(claims);
  return claims;
}

/** Maps verified claims onto the shape the rest of the app provisions from. */
export function identityFromClaims(claims: EntraClaims): ExternalIdentity {
  const externalId = claims.oid;
  // `preferred_username` is the sign-in name and is present far more reliably
  // than `email`, which needs an address set on the directory object.
  const email = claims.preferred_username ?? claims.email;

  if (!externalId || !email) {
    throw new Error("Sign-in rejected: token is missing the object id or an email address.");
  }

  return {
    externalId,
    email,
    displayName: claims.name?.trim() || email,
  };
}

/** Ends the Microsoft session too, not just ours. */
export function endSessionUrl(postLogoutRedirectUri: string): string {
  const url = new URL(endpoint("oauth2/v2.0/logout"));
  url.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
  return url.toString();
}

export const entraAuthProvider: AuthProvider = {
  name: "entra",

  isConfigured() {
    return Boolean(
      allowedTenantIds().length > 0 &&
        process.env.ENTRA_CLIENT_ID &&
        process.env.ENTRA_CLIENT_SECRET,
    );
  },

  /**
   * Identical in shape to the dev provider's: by this point the callback route
   * has done the OAuth work and written the session cookie, so a request costs
   * one cookie read and one row lookup rather than a round trip to Microsoft.
   */
  async getIdentity(): Promise<ExternalIdentity | null> {
    const store = await cookies();
    const userId = unsignValue(store.get(SESSION_COOKIE)?.value);
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, externalId: true },
    });
    if (!user) return null;

    return {
      externalId: user.externalId ?? user.id,
      email: user.email,
      displayName: user.displayName,
    };
  },

  signInUrl() {
    return "/api/auth/signin";
  },

  signOutUrl() {
    return "/api/auth/signout";
  },
};
