import type { Locale } from "@/i18n/config";
import { campaignType } from "./campaign-types";
import { parseIsoDate, type IsoDate } from "./dates";

/**
 * Locale-aware formatting. Every number and date the user sees goes through
 * here — 1,200 in English against 1.200 in Danish, and a decimal comma for km.
 *
 * Intl objects are cached because constructing one is comparatively expensive
 * and the leaderboard formats a few hundred values per render.
 */

const numberCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

function numberFormat(locale: Locale, decimals: number): Intl.NumberFormat {
  const key = `${locale}:${decimals}`;
  let cached = numberCache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberCache.set(key, cached);
  }
  return cached;
}

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions, tag: string): Intl.DateTimeFormat {
  const key = `${locale}:${tag}`;
  let cached = dateCache.get(key);
  if (!cached) {
    // UTC because calendar days are parsed at UTC midnight; without this the
    // formatter would shift "2026-08-01" back a day west of Greenwich.
    cached = new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options });
    dateCache.set(key, cached);
  }
  return cached;
}

export interface Formatters {
  locale: Locale;
  /** A plain number at a fixed precision. */
  number(value: number, decimals?: number): string;
  /** A campaign value at its type's precision — steps whole, km to one place. */
  value(campaignTypeKey: string, value: number): string;
  /** Numeric date: 12/08/2026 (en-GB) · 12.08.2026 (da-DK). */
  date(date: IsoDate): string;
  /** Medium date: 12 Aug 2026 (en-GB) · 12. aug. 2026 (da-DK). */
  dateMedium(date: IsoDate): string;
  /** A campaign's inclusive range as one string. */
  dateRange(start: IsoDate, end: IsoDate): string;
  /** Abbreviated weekday, for calendar column headers and drawer rows. */
  weekday(date: IsoDate): string;
  /** "August 2026" — the calendar's month heading. */
  monthYear(date: IsoDate): string;
  /** Whole-number percentage, e.g. "69%". */
  percent(fraction: number): string;
}

export function createFormatters(locale: Locale): Formatters {
  return {
    locale,
    number: (value, decimals = 0) => numberFormat(locale, decimals).format(value || 0),
    value: (typeKey, value) => numberFormat(locale, campaignType(typeKey).decimals).format(value || 0),
    date: (date) =>
      dateFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }, "short").format(
        parseIsoDate(date),
      ),
    dateMedium: (date) =>
      dateFormat(locale, { day: "numeric", month: "short", year: "numeric" }, "medium").format(
        parseIsoDate(date),
      ),
    dateRange(start, end) {
      return `${this.dateMedium(start)} – ${this.dateMedium(end)}`;
    },
    weekday: (date) => dateFormat(locale, { weekday: "short" }, "weekday").format(parseIsoDate(date)),
    monthYear: (date) =>
      dateFormat(locale, { month: "long", year: "numeric" }, "monthYear").format(parseIsoDate(date)),
    percent: (fraction) =>
      new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(fraction),
  };
}

/** Up to two initials, for the avatar circles. */
export function initials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

/** Monday-first weekday headers for the calendar grid, in the user's language. */
export function weekdayHeaders(locale: Locale): string[] {
  const formatter = dateFormat(locale, { weekday: "short" }, "weekday");
  // 2024-01-01 was a Monday; seven consecutive days give Mon…Sun in order.
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
}
