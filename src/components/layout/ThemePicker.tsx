"use client";

import { useTransition } from "react";
import { useTranslator } from "@/i18n/provider";
import { setTheme } from "@/app/actions/session";
import { THEMES, type Theme } from "@/lib/theme";
import styles from "./ThemePicker.module.css";

/**
 * Light / dark / follow-the-device, as three icons in one pill.
 *
 * A segmented control rather than a button that cycles: with three states, a
 * cycling button can show you what you would get next but never what you have
 * now, and "system" in particular is invisible that way — it looks like
 * whichever palette your OS happens to be in.
 *
 * Marked up as a radio group, because that is what it is: one choice out of
 * three, arrow keys moving between them. `aria-checked` carries the state that
 * the filled pill communicates visually.
 */
export function ThemePicker({ theme, variant = "onBrand" }: { theme: Theme; variant?: "onBrand" | "light" }) {
  const t = useTranslator();
  const [pending, startTransition] = useTransition();

  const label: Record<Theme, string> = {
    system: t("profile.themeSystem"),
    light: t("profile.themeLight"),
    dark: t("profile.themeDark"),
  };

  return (
    <div
      className={`${styles.group} ${variant === "light" ? styles.groupLight : ""}`}
      role="radiogroup"
      aria-label={t("profile.theme")}
    >
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={theme === option}
          aria-label={label[option]}
          title={label[option]}
          disabled={pending}
          className={`${styles.option} ${theme === option ? styles.optionActive : ""}`}
          // Not a form: one click is the whole interaction, and the server
          // action re-renders the layout with the new attribute in place.
          onClick={() => startTransition(() => void setTheme(option))}
        >
          <Icon theme={option} />
        </button>
      ))}
    </div>
  );
}

/**
 * Sun, moon, and the two together for "whatever my device says". All three are
 * drawn on the same 24-unit grid with the same stroke weight as the bell in the
 * profile bar, so they sit together as one family.
 */
function Icon({ theme }: { theme: Theme }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 15,
    height: 15,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6" />
      </svg>
    );
  }

  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M20.5 14.3A8.6 8.6 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8Z" />
      </svg>
    );
  }

  // System: a display. Sun-and-moon marks read as "both" or "twilight" rather
  // than "ask the machine"; a monitor is what macOS, GitHub and VS Code all
  // use for this, and conventions are worth more than invention on a 15px icon.
  return (
    <svg {...common}>
      <rect x="2.6" y="4.2" width="18.8" height="12.4" rx="2" />
      <path d="M12 16.6v3.2M8.4 19.8h7.2" />
    </svg>
  );
}
