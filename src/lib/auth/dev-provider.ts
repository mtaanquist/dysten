import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, unsignValue } from "./cookies";
import type { AuthProvider, ExternalIdentity } from "./types";

/**
 * Development sign-in.
 *
 * Stands in for Entra ID until tenant details exist: you pick an account from
 * the seeded directory and a signed cookie remembers it. It refuses to run in
 * production unless explicitly forced, so it cannot become the thing that
 * quietly ships.
 */
export const devAuthProvider: AuthProvider = {
  name: "dev",

  isConfigured() {
    if (process.env.NODE_ENV !== "production") return true;
    return process.env.ALLOW_DEV_AUTH === "true";
  },

  async getIdentity(): Promise<ExternalIdentity | null> {
    const store = await cookies();
    const userId = unsignValue(store.get(SESSION_COOKIE)?.value);
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) return null;

    return { externalId: user.id, email: user.email, displayName: user.displayName };
  },

  signInUrl() {
    return "/sign-in";
  },

  signOutUrl() {
    return "/sign-in";
  },
};
