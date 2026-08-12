"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  canAssignRoles,
  canCloseCampaign,
  canDeleteCampaign,
  canManageCampaigns,
  canManageRoster,
  canReopenCampaign,
} from "@/lib/permissions";
import { isCampaignTypeKey } from "@/lib/campaign-types";
import { campaignStatus } from "@/lib/campaign-status";
import { isIsoDate } from "@/lib/dates";
import type { ActionResult } from "./entries";

export type { ActionResult } from "./entries";

/** Opting into a campaign. Members do this themselves; captains use the roster. */
export async function joinCampaign(campaignId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, startDate: true, endDate: true, closedEarlyAt: true, reopenedForCorrections: true },
  });
  if (!campaign) return { ok: false, error: "errors.notFound" };

  // Joining a campaign that has already finished would put someone on a
  // historical roster they were never part of.
  if (campaignStatus(campaign) === "ended") return { ok: false, error: "errors.campaignLocked" };

  await prisma.participation.upsert({
    where: { campaignId_userId: { campaignId, userId: user.id } },
    create: { campaignId, userId: user.id },
    update: {},
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

interface CampaignInput {
  id?: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  description?: string;
  goalValue?: string | number | null;
  goalName?: string | null;
}

/** Creates or updates a campaign, depending on whether an id came along. */
export async function saveCampaign(input: CampaignInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };
  if (!canManageCampaigns(user)) return { ok: false, error: "errors.notAuthorised" };

  const name = input.name?.trim() ?? "";
  if (!name) return { ok: false, error: "errors.nameRequired" };
  if (!isCampaignTypeKey(input.type)) return { ok: false, error: "errors.generic" };
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) {
    return { ok: false, error: "errors.generic" };
  }
  if (input.endDate < input.startDate) return { ok: false, error: "errors.endBeforeStart" };

  const rawGoal = input.goalValue;
  const goalValue =
    rawGoal === undefined || rawGoal === null || rawGoal === ""
      ? null
      : Number(String(rawGoal).replace(",", "."));
  if (goalValue !== null && (!Number.isFinite(goalValue) || goalValue < 0)) {
    return { ok: false, error: "errors.negativeValue" };
  }

  const data = {
    name,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    description: input.description?.trim() ?? "",
    goalValue,
    goalName: input.goalName?.trim() || null,
  };

  if (input.id) {
    const existing = await prisma.campaign.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) return { ok: false, error: "errors.notFound" };
    await prisma.campaign.update({ where: { id: input.id }, data });
  } else {
    await prisma.campaign.create({ data: { ...data, createdById: user.id } });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Ends a running campaign now. Entries become read-only from this moment. */
export async function closeCampaign(campaignId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };
  if (!canCloseCampaign(user)) return { ok: false, error: "errors.notAuthorised" };

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { closedEarlyAt: new Date(), reopenedForCorrections: false },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Admin-only: unlocks an ended campaign so entries can be corrected. The
 * campaign stays "ended" for display — see src/lib/campaign-status.ts.
 */
export async function reopenCampaign(campaignId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };
  if (!canReopenCampaign(user)) return { ok: false, error: "errors.notAuthorised" };

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { reopenedForCorrections: true, closedEarlyAt: null },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin-only, and genuinely destructive: entries cascade away with it. */
export async function deleteCampaign(campaignId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };
  if (!canDeleteCampaign(user)) return { ok: false, error: "errors.notAuthorised" };

  await prisma.campaign.delete({ where: { id: campaignId } });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addParticipant(campaignId: string, userId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };
  if (!canManageRoster(user)) return { ok: false, error: "errors.notAuthorised" };

  await prisma.participation.upsert({
    where: { campaignId_userId: { campaignId, userId } },
    create: { campaignId, userId },
    update: {},
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Removes someone from a roster. Their entries go too — leaving orphaned
 * entries behind would make the roster and the leaderboard disagree.
 */
export async function removeParticipant(campaignId: string, userId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };
  if (!canManageRoster(user)) return { ok: false, error: "errors.notAuthorised" };

  await prisma.$transaction([
    prisma.entry.deleteMany({ where: { campaignId, userId } }),
    prisma.participation.deleteMany({ where: { campaignId, userId } }),
  ]);

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin-only role assignment. */
export async function setUserRole(userId: string, role: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.notAuthorised" };
  if (!canAssignRoles(user)) return { ok: false, error: "errors.notAuthorised" };
  if (!(role in Role)) return { ok: false, error: "errors.generic" };

  // Losing the last admin would lock role management for everyone.
  if (user.id === userId && role !== Role.ADMIN) {
    const otherAdmins = await prisma.user.count({
      where: { role: Role.ADMIN, id: { not: userId } },
    });
    if (otherAdmins === 0) return { ok: false, error: "errors.notAuthorised" };
  }

  await prisma.user.update({ where: { id: userId }, data: { role: role as Role } });

  revalidatePath("/", "layout");
  return { ok: true };
}
