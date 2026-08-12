import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal signed-cookie helpers.
 *
 * The dev provider needs to remember which account you picked without pulling
 * in a session library that the real Entra integration would then replace.
 * Values are signed, not encrypted — they carry a user id, nothing secret — but
 * the signature stops someone editing the cookie to become another user.
 */

export const SESSION_COOKIE = "atk_session";
export const LOCALE_COOKIE = "atk_locale";

function secret(): string {
  const value = process.env.APP_SECRET;
  if (value && value.length >= 16) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_SECRET must be set to at least 16 characters in production — it signs session cookies.",
    );
  }
  // Development convenience only; sessions reset whenever this default changes.
  return "development-only-insecure-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function signValue(value: string): string {
  return `${value}.${sign(value)}`;
}

/** Returns the payload if the signature matches, otherwise null. */
export function unsignValue(signed: string | undefined): string | null {
  if (!signed) return null;
  const separator = signed.lastIndexOf(".");
  if (separator <= 0) return null;

  const value = signed.slice(0, separator);
  const provided = signed.slice(separator + 1);
  const expected = sign(value);

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return value;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
} as const;
