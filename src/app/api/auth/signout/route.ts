import { NextResponse } from "next/server";
import { authProvider } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { endSessionUrl, entraAuthProvider } from "@/lib/auth/entra-provider";
import { OAUTH_COOKIES, appOrigin } from "@/lib/auth/oauth-flow";

/**
 * Ends the session here and at Microsoft.
 *
 * Dropping only our own cookie would leave the browser still signed in to the
 * tenant, so the next sign-in would go straight back through without a prompt —
 * which does not look like signing out to the person who asked for it.
 */
function endSession(request: Request) {
  let destination: string;
  try {
    destination = endSessionUrl(`${appOrigin(request)}/sign-in`);
  } catch {
    // Not configured for Entra, or configured wrongly. Our own sign-out still
    // has to work: never strand someone signed in because of a bad env var.
    destination = new URL("/sign-in", request.url).toString();
  }

  const response = NextResponse.redirect(destination);
  response.cookies.delete(SESSION_COOKIE);
  for (const name of OAUTH_COOKIES) response.cookies.delete(name);
  return response;
}

export async function GET(request: Request) {
  if (authProvider().name !== entraAuthProvider.name) {
    const response = NextResponse.redirect(new URL("/sign-in", request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  return endSession(request);
}

export async function POST(request: Request) {
  return GET(request);
}
