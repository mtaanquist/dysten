import { daysBetween, today as currentDay, type IsoDate } from "./dates";

/**
 * Campaign status is *derived*, never stored — a campaign becomes active or
 * ends because the calendar moved, not because something wrote a column. Only
 * the genuine overrides are persisted: an early close, an admin reopening an
 * ended campaign for corrections, and the moment its winner was settled.
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
  /**
   * When the winner was settled — drawn on a raffle campaign, named on one
   * decided by the leaderboard. Null until that has happened, which is what
   * keeps the campaign open for late entries. See `awaitingWinner`.
   */
  drawnAt: Date | null;
}

/** Just the two dates — all `lastLoggableDay` needs to answer its question. */
interface Range {
  startDate: IsoDate;
  endDate: IsoDate;
}

export function campaignStatus(campaign: StatusInput, today: IsoDate = currentDay()): CampaignStatus {
  if (campaign.closedEarlyAt) return "ended";
  if (today < campaign.startDate) return "upcoming";
  if (today > campaign.endDate) return "ended";
  return "active";
}

/**
 * The gap between the last day of a campaign and the moment its winner is
 * settled — the one window in which a campaign is over but still open.
 *
 * It exists because the two things people do at the end of a campaign happen on
 * different days: the last day passes on its own, and a captain runs the draw
 * whenever the announcement is due. Locking entries the instant the calendar
 * turned meant anyone who had not typed up the final weekend simply lost it,
 * while the prize they were losing it for had not been decided yet.
 *
 * Nothing about the standings moves during the window that would not have moved
 * anyway: every day being filled in is a day inside the campaign's own range,
 * and scoring still stops at the end date.
 */
export function awaitingWinner(campaign: StatusInput, today: IsoDate = currentDay()): boolean {
  return campaignStatus(campaign, today) === "ended" && campaign.drawnAt === null;
}

/** Whether entries may be created or changed at all right now. */
export function entriesEditable(campaign: StatusInput, today: IsoDate = currentDay()): boolean {
  if (campaign.reopenedForCorrections) return true;
  if (campaignStatus(campaign, today) === "active") return true;
  return awaitingWinner(campaign, today);
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
 * still open after its last day — or reopened for corrections — is edited
 * against the days it actually covered, not against this week. Its start date
 * before it begins, so that anything needing a default day has somewhere
 * sensible to sit.
 *
 * Deliberately a question about the calendar alone: whether those days accept a
 * value is `entriesEditable`'s business, and a control that has to disable
 * itself still needs to know which day to open on.
 */
export function lastLoggableDay(campaign: Range, today: IsoDate = currentDay()): IsoDate {
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
