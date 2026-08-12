import type { Role } from "@prisma/client";
import type { Locale } from "@/i18n/config";

/** The identity an auth provider hands back, before it's matched to a User row. */
export interface ExternalIdentity {
  /** Stable provider-side id — Entra's object id. */
  externalId: string;
  email: string;
  displayName: string;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  /** The role stored against the account. */
  role: Role;
  /**
   * The role the UI and permission checks should use. Captains and admins can
   * preview the app as a lesser role; this is never higher than `role`.
   */
  effectiveRole: Role;
  locale: Locale;
  remindersEnabled: boolean;
}

/**
 * The seam. Swapping the dev provider for Entra ID means implementing this
 * interface and pointing AUTH_PROVIDER at it — nothing in the app's pages,
 * actions or components refers to a provider directly.
 */
export interface AuthProvider {
  readonly name: string;
  /** Whether this provider can actually serve requests with the current config. */
  isConfigured(): boolean;
  /**
   * Resolves the signed-in identity from the incoming request's cookies or
   * headers, or null when nobody is signed in.
   */
  getIdentity(): Promise<ExternalIdentity | null>;
  /** Where the sign-in button should send the browser. */
  signInUrl(): string;
  /** Where the sign-out control should send the browser. */
  signOutUrl(): string;
}
