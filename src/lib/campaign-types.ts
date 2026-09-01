import type { CSSProperties } from "react";

/**
 * Campaign type registry.
 *
 * A campaign type defines what the two neutral value columns on an Entry mean,
 * how they're formatted, and how they're entered. Everything a human reads —
 * field labels, units, help text, the type's own name — lives in the per-language
 * resource files under `campaignTypes.<key>`, so a type is translatable and no
 * copy is hard-coded here.
 *
 * Adding a type (say, swimming) is:
 *   1. an entry in TYPES below
 *   2. a `campaignTypes.swim` block in every file under src/i18n/messages
 * No migration, because Entry.value1/value2 stay meaning-neutral.
 */

/**
 * What decides the standings.
 *
 * `total` — whoever logged the most wins. Right for steps: everyone's day is
 * the same length, so the number is comparable.
 *
 * `activeDays` — whoever turned out on the most days wins, and the distance is
 * only ever shown, never ranked. Right for cycling to work: how far you live
 * from the office is not an achievement, and ranking on kilometres would hand
 * the campaign to whoever has the longest commute. A day counts when something
 * was actually ridden, so logging a zero does not buy a day.
 */
export type RankBy = "total" | "activeDays";

/**
 * How the winner is picked — a separate question from how people are ranked.
 *
 * `topScore` — the top of the leaderboard wins outright.
 *
 * `raffle` — logging earns tickets and the winner is drawn from them. The
 * leaderboard is unchanged and still sorts on the ranking figure, because
 * watching the numbers is what makes people walk; what changes is that topping
 * it no longer wins the prize by itself. See src/lib/raffle.ts.
 *
 * Deliberately not folded into RankBy: that drives the sort, the gap to the
 * next rank and the chart, none of which a raffle touches.
 */
export type WinnerBy = "topScore" | "raffle";

export interface CampaignTypeDefinition {
  /** Stable key persisted in Campaign.type and used as the i18n lookup path. */
  key: string;
  /**
   * Decimal places for display *and* for rounding on save. Steps are whole
   * numbers; km carry one decimal (rendered with a comma in Danish).
   */
  decimals: 0 | 1;
  /** `step` attribute on the number inputs — nudges mobile keyboards sensibly. */
  inputStep: number;
  /** Which figure the leaderboard sorts on. See RankBy. */
  rankBy: RankBy;
  /** How the winner is decided once the campaign ends. See WinnerBy. */
  winnerBy: WinnerBy;
  /**
   * Units of the ranking figure that earn one raffle ticket — 10,000 steps to
   * a ticket. Only meaningful when `winnerBy` is "raffle".
   */
  ticketsPer?: number;
  /**
   * The type's colour, as a reference to a token in styles/tokens.css rather
   * than a literal — no hex belongs outside that file. Components set it as a
   * custom property, so adding a type still touches only this registry and the
   * language files, never a stylesheet.
   */
  accent: string;
}

export const CAMPAIGN_TYPES = {
  step: {
    key: "step",
    decimals: 0,
    inputStep: 10,
    rankBy: "total",
    winnerBy: "raffle",
    ticketsPer: 10_000,
    accent: "var(--c-type-step)",
  },
  bike: {
    key: "bike",
    decimals: 1,
    inputStep: 0.1,
    rankBy: "activeDays",
    winnerBy: "topScore",
    accent: "var(--c-type-bike)",
  },
} as const satisfies Record<string, CampaignTypeDefinition>;

export type CampaignTypeKey = keyof typeof CAMPAIGN_TYPES;

export const CAMPAIGN_TYPE_KEYS = Object.keys(CAMPAIGN_TYPES) as CampaignTypeKey[];

export function isCampaignTypeKey(value: unknown): value is CampaignTypeKey {
  return typeof value === "string" && value in CAMPAIGN_TYPES;
}

/**
 * Resolves a persisted type key. Falls back to `step` rather than throwing:
 * a campaign whose type was removed from the registry should still render its
 * history, not take the page down.
 */
export function campaignType(key: string): CampaignTypeDefinition {
  return isCampaignTypeKey(key) ? CAMPAIGN_TYPES[key] : CAMPAIGN_TYPES.step;
}

/**
 * Style props that paint a surface in a campaign type's colour.
 *
 * Spread onto the element; the stylesheet reads `var(--c-accent)` and
 * `var(--c-accent-ink)` without knowing which type it is looking at.
 */
export function accentStyle(key: string): CSSProperties {
  return {
    "--c-accent": campaignType(key).accent,
    "--c-accent-ink": "var(--c-type-ink)",
  } as CSSProperties;
}

/** Whether this type's standings are decided by days out rather than distance. */
export function ranksByActiveDays(key: string): boolean {
  return campaignType(key).rankBy === "activeDays";
}

/** Whether the winner comes out of a draw rather than off the top of the board. */
export function isRaffleType(key: string): boolean {
  return campaignType(key).winnerBy === "raffle";
}

/** Units earning one ticket; 0 when this type does not raffle. */
export function ticketsPerUnit(key: string): number {
  return campaignType(key).ticketsPer ?? 0;
}

/** Rounds a raw input to the precision the type stores. */
export function roundToType(key: string, value: number): number {
  const { decimals } = campaignType(key);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Parses user input. Accepts a decimal comma, since a Danish user typing "12,5"
 * into a km field means twelve and a half. Rejects negatives and junk by
 * returning null so callers can decide between "leave alone" and "treat as 0".
 */
export function parseTypedValue(key: string, raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const normalised = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(normalised) || normalised < 0) return null;
  return roundToType(key, normalised);
}
