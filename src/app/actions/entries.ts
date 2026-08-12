"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditEntry, isAdminCorrection } from "@/lib/permissions";
import { parseTypedValue } from "@/lib/campaign-types";
import { isLoggableDay } from "@/lib/campaign-status";
import { isIsoDate } from "@/lib/dates";
import type { MessageKey } from "@/i18n/config";

export type ActionResult = { ok: true } | { ok: false; error: MessageKey };

/**
 * Saves one day's two values for one participant.
 *
 * Upsert rather than insert-or-update-by-hand: the unique key on
 * (campaign, user, date) is what enforces "one entry per user per day", and
 * letting the database arbitrate avoids a race between two tabs.
 *
 * An empty string means "leave this field alone" — the calendar sends each
 * field independently as it blurs, and clearing one input must not zero the
 * other.
 */
export async function saveEntry(input: {
  campaignId: string;
  userId?: string;
  date: string;
  value1?: string | number | null;
  value2?: string | number | null;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };

  if (!isIsoDate(input.date)) return { ok: false, error: "errors.dateOutOfRange" };

  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      closedEarlyAt: true,
      reopenedForCorrections: true,
    },
  });
  if (!campaign) return { ok: false, error: "errors.notFound" };

  const ownerId = input.userId ?? user.id;

  if (!canEditEntry(user, ownerId, campaign)) return { ok: false, error: "errors.campaignLocked" };
  if (!isLoggableDay(campaign, input.date)) return { ok: false, error: "errors.dateOutOfRange" };

  // The owner must actually be on this campaign's roster.
  const participation = await prisma.participation.findUnique({
    where: { campaignId_userId: { campaignId: campaign.id, userId: ownerId } },
    select: { id: true },
  });
  if (!participation) return { ok: false, error: "errors.notAuthorised" };

  const value1 = parseTypedValue(campaign.type, input.value1);
  const value2 = parseTypedValue(campaign.type, input.value2);

  // Distinguish "not supplied" from "supplied as invalid": a negative or
  // non-numeric value that the user actually typed is worth reporting.
  const supplied1 = input.value1 !== undefined && input.value1 !== null && input.value1 !== "";
  const supplied2 = input.value2 !== undefined && input.value2 !== null && input.value2 !== "";
  if ((supplied1 && value1 === null) || (supplied2 && value2 === null)) {
    return { ok: false, error: "errors.negativeValue" };
  }

  const adminCorrection = isAdminCorrection(user, ownerId);

  await prisma.entry.upsert({
    where: { campaignId_userId_date: { campaignId: campaign.id, userId: ownerId, date: input.date } },
    create: {
      campaignId: campaign.id,
      userId: ownerId,
      date: input.date,
      value1: value1 ?? 0,
      value2: value2 ?? 0,
      editedByAdmin: adminCorrection,
      editedById: adminCorrection ? user.id : null,
    },
    update: {
      // undefined leaves the column untouched, which is exactly the
      // "only the field that changed" semantic the calendar relies on.
      value1: value1 ?? undefined,
      value2: value2 ?? undefined,
      editedByAdmin: adminCorrection ? true : undefined,
      editedById: adminCorrection ? user.id : undefined,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin-only: removes a day's entry entirely, rather than zeroing it. */
export async function deleteEntry(input: {
  campaignId: string;
  userId: string;
  date: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };

  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: {
      startDate: true,
      endDate: true,
      closedEarlyAt: true,
      reopenedForCorrections: true,
    },
  });
  if (!campaign) return { ok: false, error: "errors.notFound" };
  if (!canEditEntry(user, input.userId, campaign)) return { ok: false, error: "errors.notAuthorised" };

  await prisma.entry.deleteMany({
    where: { campaignId: input.campaignId, userId: input.userId, date: input.date },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
