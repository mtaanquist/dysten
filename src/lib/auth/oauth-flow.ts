import { createHash, randomBytes } from "node:crypto";

/**
 * The short-lived state carried across the redirect to Microsoft and back.
 *
 * All three live in cookies rather than in a server-side store, because the
 * app has no session store to put them in and does not want one: they are read
 * exactly once, by the callback, on the same browser that set them.
 */
export const OAUTH_STATE_COOKIE = "atk_oauth_state";
export const OAUTH_NONCE_COOKIE = "atk_oauth_nonce";
export const OAUTH_VERIFIER_COOKIE = "atk_oauth_verifier";

export const OAUTH_COOKIES = [
  OAUTH_STATE_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
] as const;

/**
 * `sameSite: "lax"`, not "strict": the browser arrives back from
 * login.microsoftonline.com via a top-level GET, and a strict cookie would not
 * be sent on it — the flow would fail every time with a state mismatch.
 *
 * Ten minutes is the whole budget for someone typing a password and answering
 * an MFA prompt; anything left over is a stale cookie waiting to confuse the
 * next attempt.
 */
export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 10,
} as const;

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * PKCE, S256. Public clients need this to stop a stolen authorization code
 * being redeemed by someone else; a confidential client with a secret is
 * already covered, but the cost here is four lines and it removes the secret
 * as a single point of failure.
 */
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomToken();
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * The redirect URI, which must match the app registration byte for byte.
 *
 * APP_URL wins when set, because behind a reverse proxy the request's own idea
 * of its origin is whatever the proxy forwarded and can differ from the URI
 * registered with Microsoft — which fails as AADSTS50011 at the worst moment.
 */
export function callbackUrl(request: Request): string {
  return appUrl(request, "/api/auth/callback");
}

export function appOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}

/**
 * An absolute URL back into this app.
 *
 * Redirects must not be built from `request.url`: the server binds to
 * 0.0.0.0 and a reverse proxy rewrites the Host, so the request's own origin
 * is an internal address the browser cannot reach — which is how a successful
 * sign-in ends up at https://0.0.0.0:3000/. APP_URL is the origin the outside
 * world uses, so every redirect goes through here.
 */
export function appUrl(request: Request, path: string): string {
  return new URL(path, `${appOrigin(request)}/`).toString();
}
