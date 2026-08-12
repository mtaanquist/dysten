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
}

export const CAMPAIGN_TYPES = {
  step: { key: "step", decimals: 0, inputStep: 10 },
  bike: { key: "bike", decimals: 1, inputStep: 0.1 },
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
