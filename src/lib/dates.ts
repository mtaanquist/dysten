/**
 * Calendar-day helpers.
 *
 * Everything the tracker reasons about — campaign ranges, entry days, streaks —
 * is a calendar day in the company's local timezone, never an instant. Days are
 * represented as "YYYY-MM-DD" strings, which compare and sort correctly with
 * plain string operators and never drift across a UTC boundary.
 */

/** A calendar day in "YYYY-MM-DD" form. */
export type IsoDate = string;

/**
 * The timezone that defines when "today" rolls over. Everyone on an internal
 * Danish tracker shares one, so a single setting is honest; make it a per-user
 * field only if the company goes multi-region.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Copenhagen";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2026-02-30 and friends, which Date would silently roll forward.
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function assertIsoDate(value: unknown, label = "date"): IsoDate {
  if (!isIsoDate(value)) {
    throw new Error(`Invalid ${label}: expected YYYY-MM-DD, received ${String(value)}`);
  }
  return value;
}

/** Formats a Date as the calendar day it falls on in the given timezone. */
export function toIsoDate(instant: Date, timeZone: string = APP_TIMEZONE): IsoDate {
  // en-CA renders ISO-shaped dates, which saves reassembling parts by hand.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Today, in the app timezone.
 *
 * APP_TODAY pins the clock — the seeded demo data is built around a fixed date
 * (as the prototype was), and tests need a stable "now". Leave it unset in
 * production and this is simply the real date.
 */
export function today(): IsoDate {
  const pinned = process.env.APP_TODAY;
  if (pinned && isIsoDate(pinned)) return pinned;
  return toIsoDate(new Date());
}

/** Parses a calendar day into a Date at UTC midnight — safe for date arithmetic. */
export function parseIsoDate(date: IsoDate): Date {
  return new Date(`${assertIsoDate(date)}T00:00:00Z`);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` precedes `from`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
}

/** Every day from `start` to `end`, inclusive. Empty when end precedes start. */
export function dayRange(start: IsoDate, end: IsoDate): IsoDate[] {
  assertIsoDate(start, "start date");
  assertIsoDate(end, "end date");
  const out: IsoDate[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) out.push(cursor);
  return out;
}

export function isWithin(date: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return date >= start && date <= end;
}

/** Day of week as 0=Monday … 6=Sunday, matching the calendar grid's layout. */
export function mondayIndex(date: IsoDate): number {
  return (parseIsoDate(date).getUTCDay() + 6) % 7;
}

/** "2026-08" — the month bucket a day belongs to. */
export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}
