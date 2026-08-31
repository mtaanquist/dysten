import { NextResponse } from "next/server";
import { provisionUser } from "@/lib/auth";
import { COOKIE_OPTIONS, SESSION_COOKIE, signValue } from "@/lib/auth/cookies";
import {
  TenantNotAllowedError,
  exchangeCode,
  identityFromClaims,
  verifyIdToken,
} from "@/lib/auth/entra-provider";
import {
  OAUTH_COOKIES,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  appUrl,
  callbackUrl,
} from "@/lib/auth/oauth-flow";

function failure(request: Request, reason: "denied" | "tenant" | "failed") {
  const response = NextResponse.redirect(appUrl(request, `/sign-in?error=${reason}`));
  // A half-finished attempt leaves cookies that would break the next one.
  for (const name of OAUTH_COOKIES) response.cookies.delete(name);
  return response;
}

/**
 * Where Microsoft sends the browser back.
 *
 * Everything the token says is untrusted until its signature has been checked
 * against Microsoft's published keys — including the tenant id the allowlist
 * is compared against. That ordering is the whole point of the route.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // The user cancelled, or consent was refused. Not an error worth logging.
  if (url.searchParams.get("error")) return failure(request, "denied");

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  // Read straight off the request: these were set on the way out and are
  // consumed exactly here.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const jar = new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf("=");
        return [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))] as const;
      }),
  );

  const expectedState = jar.get(OAUTH_STATE_COOKIE);
  const nonce = jar.get(OAUTH_NONCE_COOKIE);
  const verifier = jar.get(OAUTH_VERIFIER_COOKIE);

  if (!code || !returnedState || !expectedState || !nonce || !verifier) {
    console.error("[auth] callback missing code or one-time values");
    return failure(request, "failed");
  }

  // Binds the response to the request this browser started, which is what stops
  // an attacker's authorization code being planted in someone else's session.
  if (returnedState !== expectedState) {
    console.error("[auth] callback state mismatch");
    return failure(request, "failed");
  }

  try {
    const idToken = await exchangeCode({
      code,
      codeVerifier: verifier,
      redirectUri: callbackUrl(request),
    });
    const claims = await verifyIdToken(idToken, nonce);
    const user = await provisionUser(identityFromClaims(claims));

    const response = NextResponse.redirect(appUrl(request, "/"));
    response.cookies.set(SESSION_COOKIE, signValue(user.id), COOKIE_OPTIONS);
    for (const name of OAUTH_COOKIES) response.cookies.delete(name);
    return response;
  } catch (error) {
    if (error instanceof TenantNotAllowedError) {
      // Expected in normal operation — a contractor or a personal account.
      console.warn("[auth]", error.message);
      return failure(request, "tenant");
    }
    console.error("[auth] sign-in failed:", error);
    return failure(request, "failed");
  }
}
