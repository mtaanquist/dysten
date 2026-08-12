/**
 * Light / dark / system.
 *
 * "system" is the absence of a choice, not a third palette: it means "do not
 * write `data-theme` at all and let `prefers-color-scheme` in tokens.css
 * decide". That is why the resolved value can be null — there is nothing to
 * put on the element, and that is the correct outcome rather than a missing one.
 *
 * The preference is applied on the server, from the stored value, so the very
 * first paint is already in the right theme. No inline script, no flash of the
 * wrong palette before hydration.
 */

export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "system";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Coerces anything — a cookie, a database column, a form field — to a Theme. */
export function resolveTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

/**
 * The value for the root element's `data-theme`, or null to leave it off.
 *
 * Only an explicit choice is written. `[data-theme="light"]` is not redundant:
 * it is what the dark media query checks for, so that choosing light on a
 * machine set to dark actually wins.
 */
export function themeAttribute(theme: Theme): "light" | "dark" | null {
  return theme === "system" ? null : theme;
}
