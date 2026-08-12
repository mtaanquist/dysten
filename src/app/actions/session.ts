"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  COOKIE_OPTIONS,
  LOCALE_COOKIE,
  SESSION_COOKIE,
  VIEW_ROLE_COOKIE,
  signValue,
} from "@/lib/auth/cookies";
import { devAuthProvider } from "@/lib/auth/dev-provider";
import { isLocale } from "@/i18n/config";

/**
 * Development sign-in: adopt a seeded account.
 *
 * Refuses unless the dev provider is actually the configured one, so this
 * cannot be used to bypass Entra ID once that is switched on.
 */
export async function signInAsUser(userId: string) {
  if (process.env.AUTH_PROVIDER === "entra" || !devAuthProvider.isConfigured()) {
    throw new Error("Development sign-in is disabled.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, locale: true } });
  if (!user) throw new Error("Unknown user.");

  const store = await cookies();
  store.set(SESSION_COOKIE, signValue(user.id), COOKIE_OPTIONS);
  store.set(LOCALE_COOKIE, user.locale, { ...COOKIE_OPTIONS, httpOnly: false });
  // A fresh session starts at the user's real role, never a stale preview.
  store.delete(VIEW_ROLE_COOKIE);

  redirect("/");
}

export async function signOut() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(VIEW_ROLE_COOKIE);
  redirect("/sign-in");
}

/**
 * The dashboard's "View as" control. Only ever downgrades: the value is
 * re-checked against the user's real role in getCurrentUser, so writing this
 * cookie by hand cannot escalate anything.
 */
export async function setViewRole(role: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const store = await cookies();
  if (role === user.role || !(role in Role)) {
    store.delete(VIEW_ROLE_COOKIE);
  } else {
    store.set(VIEW_ROLE_COOKIE, signValue(role), COOKIE_OPTIONS);
  }

  revalidatePath("/", "layout");
}

/**
 * Language choice, saved against the account so it follows the user to any
 * device. The cookie mirrors it so the sign-in page — which has no user yet —
 * can still render in the last language used on this browser.
 */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { ...COOKIE_OPTIONS, httpOnly: false });

  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { locale } });
  }

  revalidatePath("/", "layout");
}

/** Opt in or out of the missing-day e-mail nudge. */
export async function toggleReminders() {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { remindersEnabled: !user.remindersEnabled },
  });

  revalidatePath("/", "layout");
}
