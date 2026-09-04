import type { IsoDate } from "./dates";

/**
 * What a campaign's date range covers, and what falls outside it.
 *
 * A campaign's range is editable after entries exist, which makes "outside the
 * range" a state the data can genuinely be in: shorten a running campaign and
 * every entry on a day you just cut away is still sitting in the table. Two
 * separate things follow from that, and both live here.
 *
 * `withinRange` is the defensive half. Scoring reads entries through it, so a
 * stranded row cannot reach a leaderboard even on a campaign that was shortened
 * before anything cleaned up after it — no migration, no repair script.
 *
 * `narrowsRange` and `datesOutsideRange` are the deliberate half: they let the
 * edit itself say how much it is about to destroy, so an admin is asked before
 * it happens rather than told afterwards.
 *
 * Dates are ISO `YYYY-MM-DD` throughout, so lexical comparison is chronological
 * comparison and none of this needs a Date object.
 */

export interface DateRange {
  startDate: IsoDate;
  endDate: IsoDate;
}

/** Whether `date` falls on or between the range's two ends. */
export function coversDate(range: DateRange, date: IsoDate): boolean {
  return date >= range.startDate && date <= range.endDate;
}

/**
 * The subset of `items` the range still covers.
 *
 * Generic over anything with a `date`, so the same filter serves entries on
 * their way into scoring and any other dated row that has to respect the range.
 */
export function withinRange<T extends { date: IsoDate }>(items: readonly T[], range: DateRange): T[] {
  return items.filter((item) => coversDate(range, item.date));
}

/**
 * Whether `next` cuts days off either end of `previous`.
 *
 * Only a narrowing can strand anything, so this is what decides whether an edit
 * needs to ask before it saves. Widening a campaign, or leaving the dates alone
 * while renaming it, never destroys an entry and never prompts.
 */
export function narrowsRange(previous: DateRange, next: DateRange): boolean {
  return next.startDate > previous.startDate || next.endDate < previous.endDate;
}

/** The dates `range` does not cover, in the order they were given. */
export function datesOutsideRange(dates: readonly IsoDate[], range: DateRange): IsoDate[] {
  return dates.filter((date) => !coversDate(range, date));
}
