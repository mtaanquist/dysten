import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveLocale } from "@/i18n/config";
import { devAuthProvider } from "./dev-provider";
import { entraAuthProvider } from "./entra-provider";
import type { AuthProvider, ExternalIdentity, SessionUser } from "./types";

export type { AuthProvider, ExternalIdentity, SessionUser } from "./types";

/** Least to most privileged. Used for comparisons, never persisted. */
const ROLE_RANK: Record<Role, number> = {
  [Role.MEMBER]: 0,
  [Role.CAPTAIN]: 1,
  [Role.ADMIN]: 2,
};

export function authProvider(): AuthProvider {
  return process.env.AUTH_PROVIDER === "entra" ? entraAuthProvider : devAuthProvider;
}

function seedAdminEmails(): string[] {
  return (process.env.SEED_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Finds or creates the User row behind an external identity.
 *
 * The spec's bootstrap rule lives here: the very first person to sign in
 * becomes an admin, as does anyone on the configured seed list. Everyone after
 * that starts as a member and is promoted from the management screen.
 */
export async function provisionUser(identity: ExternalIdentity) {
  const email = identity.email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ externalId: identity.externalId }, { email }] },
  });

  if (existing) {
    const shouldBackfillExternalId = !existing.externalId;
    const nameChanged = existing.displayName !== identity.displayName;
    if (shouldBackfillExternalId || nameChanged) {
      // Display name comes from M365 and can change there; keep it in step.
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          externalId: existing.externalId ?? identity.externalId,
          displayName: identity.displayName,
          lastSeenAt: new Date(),
        },
      });
    }
    return prisma.user.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
  }

  const isFirstUser = (await prisma.user.count()) === 0;
  const isSeedAdmin = seedAdminEmails().includes(email);

  return prisma.user.create({
    data: {
      email,
      externalId: identity.externalId,
      displayName: identity.displayName,
      role: isFirstUser || isSeedAdmin ? Role.ADMIN : Role.MEMBER,
      lastSeenAt: new Date(),
    },
  });
}

/** The signed-in user, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const provider = authProvider();
  if (!provider.isConfigured()) return null;

  const identity = await provider.getIdentity();
  if (!identity) return null;

  const user = await provisionUser(identity);

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    locale: resolveLocale(user.locale),
    remindersEnabled: user.remindersEnabled,
  };
}

/** For pages and actions that must have a user; redirect is the caller's job. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export function atLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
