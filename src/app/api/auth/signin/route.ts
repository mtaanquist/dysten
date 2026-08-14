import { NextResponse } from "next/server";
import { authProvider } from "@/lib/auth";
import { authorizationUrl, entraAuthProvider } from "@/lib/auth/entra-provider";
import {
  OAUTH_COOKIE_OPTIONS,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  callbackUrl,
  createPkce,
  randomToken,
} from "@/lib/auth/oauth-flow";

/**
 * Starts the Entra sign-in: mints the one-time values, parks them in
 * short-lived cookies and hands the browser to Microsoft.
 */
export async function GET(request: Request) {
  if (authProvider().name !== entraAuthProvider.name) {
    // The dev provider owns /sign-in; landing here means AUTH_PROVIDER is not
    // entra and something linked to the wrong place.
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = createPkce();

  let destination: string;
  try {
    destination = authorizationUrl({
      redirectUri: callbackUrl(request),
      state,
      nonce,
      codeChallenge: challenge,
    });
  } catch (error) {
    // Missing configuration. The message names an environment variable, never
    // a secret, so it is safe to log and useless to an attacker.
    console.error("[auth] cannot start Entra sign-in:", error);
    return NextResponse.redirect(new URL("/sign-in?error=config", request.url));
  }

  const response = NextResponse.redirect(destination);
  response.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_OPTIONS);
  response.cookies.set(OAUTH_NONCE_COOKIE, nonce, OAUTH_COOKIE_OPTIONS);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, OAUTH_COOKIE_OPTIONS);
  return response;
}
