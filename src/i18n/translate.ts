import { MESSAGES, type Locale, type MessageKey } from "./config";

export type TranslationVars = Record<string, string | number>;

export interface Translator {
  (key: MessageKey, vars?: TranslationVars): string;
  locale: Locale;
}

function lookup(locale: Locale, path: string): unknown {
  let node: unknown = MESSAGES[locale];
  for (const segment of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

function pluralCategory(locale: Locale, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * Builds a translator for one locale.
 *
 * Resolution order for a key with a `count` var: `key_<plural category>`, then
 * `key_other`, then `key`. A missing key falls back to the reference locale and,
 * failing that, returns the key itself — a visible but non-fatal signal, since
 * a missing translation should never blank out a page.
 */
export function createTranslator(locale: Locale): Translator {
  const t = ((key: MessageKey, vars?: TranslationVars): string => {
    const count = vars?.count;
    const candidates: string[] = [];

    if (typeof count === "number") {
      candidates.push(`${key}_${pluralCategory(locale, count)}`, `${key}_other`);
    }
    candidates.push(key);

    for (const candidate of candidates) {
      const value = lookup(locale, candidate);
      if (typeof value === "string") return interpolate(value, vars);
    }

    for (const candidate of candidates) {
      const value = lookup("en-GB", candidate);
      if (typeof value === "string") return interpolate(value, vars);
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] Missing message "${key}" for locale "${locale}"`);
    }
    return key;
  }) as Translator;

  t.locale = locale;
  return t;
}
