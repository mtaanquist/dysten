import enGB from "./messages/en-GB.json";
import daDK from "./messages/da-DK.json";

/**
 * Adding a language is: drop `de-DE.json` next to the others, import it, and
 * add it to LOCALES and MESSAGES below. Nothing else in the app changes —
 * no component holds a literal string.
 */
export const LOCALES = ["da-DK", "en-GB"] as const;

export type Locale = (typeof LOCALES)[number];

/** The spec's launch default. A user's saved choice always wins over this. */
export const DEFAULT_LOCALE: Locale = "da-DK";

/** en-GB is the reference set — every other file must match its shape. */
export type Messages = typeof enGB;

export const MESSAGES: Record<Locale, Messages> = {
  "da-DK": daDK as Messages,
  "en-GB": enGB,
};

/**
 * Human-readable names, always shown in their own language. The tag stays
 * `en-GB` — it drives date order and decimal separators — but the label says
 * plain "English", because the region is not a choice anyone is making here.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  "da-DK": "Dansk",
  "en-GB": "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Coerces anything (a cookie, a DB column, an Accept-Language tag) to a Locale. */
export function resolveLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  if (typeof value === "string") {
    // "da", "da-DK,da;q=0.9" and "en-US" should all land somewhere sensible.
    const primary = value.split(",")[0]?.split(";")[0]?.trim().toLowerCase();
    const match = LOCALES.find((l) => l.toLowerCase() === primary || l.split("-")[0] === primary?.split("-")[0]);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

// ---- Message key types -----------------------------------------------------

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;

type LeafKeys<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : Join<K, LeafKeys<T[K]>> }[keyof T & string];

/**
 * Plural entries are authored as `key_one` / `key_other`; callers pass the base
 * `key` and the translator picks the form via Intl.PluralRules.
 */
type StripPluralSuffix<K> = K extends `${infer Base}_one`
  ? Base
  : K extends `${infer Base}_other`
    ? Base
    : K;

/** Every valid dotted message key, checked at compile time. */
export type MessageKey = StripPluralSuffix<LeafKeys<Messages>>;
