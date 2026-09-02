import { daysBetween, today as currentDay, type IsoDate } from "./dates";

/**
 * Campaign status is *derived*, never stored — a campaign becomes active or
 * ends because the calendar moved, not because something wrote a column. Only
 * the two genuine overrides are persisted: an early close, and an admin
 * reopening an ended campaign for corrections.
 *
 * Note that reopening deliberately does not resurrect a campaign as "active":
 * it unlocks editing without pushing a finished campaign back onto everyone's
 * dashboard. Display status and edit permission are separate questions.
 */

export type CampaignStatus = "upcoming" | "active" | "ended";

export interface StatusInput {
  startDate: IsoDate;
  endDate: IsoDate;
  closedEarlyAt: Date | null;
  reopenedForCorrections: boolean;
}

export function campaignStatus(campaign: StatusInput, today: IsoDate = currentDay()): CampaignStatus {
  if (campaign.closedEarlyAt) return "ended";
  if (today < campaign.startDate) return "upcoming";
  if (today > campaign.endDate) return "ended";
  return "active";
}

/** Whether entries may be created or changed at all right now. */
export function entriesEditable(campaign: StatusInput, today: IsoDate = currentDay()): boolean {
  if (campaign.reopenedForCorrections) return true;
  return campaignStatus(campaign, today) === "active";
}

/**
 * The last day that counts toward standings: today for a running campaign, the
 * end date for a finished one. Keeps "days elapsed" and averages honest instead
 * of dividing a part-finished campaign by its full length.
 */
export function scoringHorizon(campaign: StatusInput, today: IsoDate = currentDay()): IsoDate {
  const status = campaignStatus(campaign, today);
  if (status === "ended") return campaign.endDate < today ? campaign.endDate : today;
  if (status === "upcoming") return campaign.startDate;
  return today;
}

/**
 * Whole days from `today` until the campaign opens; 0 once it has.
 *
 * Counted exclusively, unlike a campaign's *length*: a campaign starting
 * tomorrow starts in 1 day, even though the span "today through tomorrow"
 * covers 2 of them. Conflating the two is what showed a campaign starting
 * tomorrow as "2 days remaining".
 */
export function daysUntilStart(campaign: StatusInput, today: IsoDate = currentDay()): number {
  return Math.max(0, daysBetween(today, campaign.startDate));
}

/**
 * The last day anybody could still be filling in.
 *
 * Today while a campaign runs. Its end date once it is over, because a campaign
 * reopened for corrections is edited against the days it actually covered, not
 * against this week. Its start date before it begins, so that anything needing
 * a default day has somewhere sensible to sit.
 *
 * This currently lands on the same day as `scoringHorizon` in every case, which
 * is a coincidence of two rules agreeing rather than one rule: that one answers
 * "what counts towards the standings", this one "what can still be typed into".
 */
export function lastLoggableDay(campaign: StatusInput, today: IsoDate = currentDay()): IsoDate {
  if (today > campaign.endDate) return campaign.endDate;
  if (today < campaign.startDate) return campaign.startDate;
  return today;
}

/** A future day can never be logged, whatever the campaign's state. */
export function isLoggableDay(
  campaign: StatusInput,
  date: IsoDate,
  today: IsoDate = currentDay(),
): boolean {
  if (date < campaign.startDate || date > campaign.endDate) return false;
  if (date > today) return false;
  return entriesEditable(campaign, today);
}
