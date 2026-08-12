"use client";

import { useTransition } from "react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { useTranslator } from "@/i18n/provider";
import { setLocale } from "@/app/actions/session";
import styles from "./LanguagePicker.module.css";

/**
 * The language control used on the sign-in card, where there is no header to
 * carry it. Signed in, the same action is driven from the header instead.
 */
export function LanguagePicker({ locale, variant = "light" }: { locale: Locale; variant?: "light" }) {
  const t = useTranslator();
  const [pending, startTransition] = useTransition();

  return (
    <label className={styles.wrapper}>
      <span className="srOnly">{t("profile.language")}</span>
      <select
        className={`${styles.select} ${styles[variant]}`}
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(() => {
            void setLocale(next);
          });
        }}
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {LOCALE_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
