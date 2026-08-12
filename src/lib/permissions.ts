import { Role } from "@prisma/client";
import { atLeast } from "./auth";
import { entriesEditable, type StatusInput } from "./campaign-status";
import type { SessionUser } from "./auth/types";
import type { IsoDate } from "./dates";

/**
 * Every authorisation rule in one place, expressed against the account's role.
 *
 * Server actions call these before touching the database; components call the
 * same functions to decide what to render. One source of truth means a hidden
 * button and a rejected request can't disagree.
 */

export function canManageCampaigns(user: SessionUser): boolean {
  return atLeast(user.role, Role.CAPTAIN);
}

export function canAdminister(user: SessionUser): boolean {
  return atLeast(user.role, Role.ADMIN);
}

/** Deleting a campaign, and everything logged in it, is admin-only. */
export function canDeleteCampaign(user: SessionUser): boolean {
  return canAdminister(user);
}

/** Reopening an ended campaign for corrections is admin-only. */
export function canReopenCampaign(user: SessionUser): boolean {
  return canAdminister(user);
}

export function canCloseCampaign(user: SessionUser): boolean {
  return canManageCampaigns(user);
}

export function canManageRoster(user: SessionUser): boolean {
  return canManageCampaigns(user);
}

export function canAssignRoles(user: SessionUser): boolean {
  return canAdminister(user);
}

/**
 * Whether `user` may write the entry for `ownerId` on `date`.
 *
 * Members edit only their own days, and only while the campaign accepts
 * entries. Admins may correct anyone's — that's the whole point of reopening a
 * campaign — but even they cannot write to a campaign that is closed and not
 * reopened, because that would silently rewrite settled history.
 */
export function canEditEntry(
  user: SessionUser,
  ownerId: string,
  campaign: StatusInput,
  today?: IsoDate,
): boolean {
  if (!entriesEditable(campaign, today)) return false;
  if (ownerId === user.id) return true;
  return canAdminister(user);
}

/** Whether saving this entry should be stamped as an admin correction. */
export function isAdminCorrection(user: SessionUser, ownerId: string): boolean {
  return ownerId !== user.id;
}

/**
 * Campaign visibility. The spec is deliberately open — everyone in the company
 * can see campaigns and, within a campaign, everyone's day-by-day figures.
 * The function exists so that if that ever tightens, it tightens in one place.
 */
export function canViewCampaign(): boolean {
  return true;
}
