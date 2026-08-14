"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { useLocale, useTranslator } from "@/i18n/provider";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { setLocale, signOut } from "@/app/actions/session";
import { Avatar } from "@/components/ui";
import type { Theme } from "@/lib/theme";
import { ThemePicker } from "./ThemePicker";
import { isNavActive, visibleNavItems } from "./nav-items";
import styles from "./Header.module.css";

interface HeaderProps {
  orgName: string;
  /** Optional sub-brand shown above the organisation. See lib/branding.ts. */
  brandName?: string | null;
  displayName: string;
  email: string;
  canManage: boolean;
  theme: Theme;
  /**
   * Where "Campaign" should go. Resolved on the server so the link lands on a
   * real campaign directly: pointing it at /campaigns instead means a redirect,
   * and a redirect means a second round trip with a blank page in between.
   */
  campaignHref: string;
}

/**
 * The language control, rendered twice: once in the header's tool row for wide
 * viewports and once inside the account menu for phones. Only one of the two is
 * ever visible. The theme picker is doubled the same way — on a 390px header
 * both are settings you touch once, and giving them permanent space there is
 * more prominence than they have earned.
 */
function LanguageSelect({ className }: { className: string }) {
  const t = useTranslator();
  const locale = useLocale();
  const [, startTransition] = useTransition();

  return (
    <label className={className}>
      <span className="srOnly">{t("profile.language")}</span>
      <select
        className={styles.language}
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(() => {
            void setLocale(next);
          });
        }}
      >
        {LOCALES.map((option) => (
          <option key={option} value={option} className={styles.languageOption}>
            {LOCALE_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Header({
  orgName,
  brandName,
  displayName,
  email,
  canManage,
  theme,
  campaignHref,
}: HeaderProps) {
  const t = useTranslator();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* With a sub-brand the lockup stacks — club over organisation — and the
            product name drops out. Without one it is the original single line. */}
        <Link
          href="/"
          className={`${styles.brand} ${brandName ? styles.brandStacked : ""}`}
          aria-label={t("nav.dashboard")}
        >
          <span className={styles.wordmark}>{brandName ?? orgName}</span>
          <span className={styles.tagline}>{brandName ? orgName : t("app.tagline")}</span>
        </Link>

        {/* Hidden on phones, where BottomNav carries the same four links. */}
        <nav className={styles.nav} aria-label={t("nav.dashboard")}>
          {visibleNavItems(canManage).map((item) => (
            <Link
              key={item.match}
              href={item.href ?? campaignHref}
              className={`${styles.navLink} ${isNavActive(pathname, item.match) ? styles.navLinkActive : ""}`}
              aria-current={isNavActive(pathname, item.match) ? "page" : undefined}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className={styles.tools}>
          <span className={styles.themeSlot}>
            <ThemePicker theme={theme} />
          </span>

          <LanguageSelect className={styles.languageLabel} />

          <div className={styles.account}>
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="srOnly">{displayName}</span>
              <Avatar name={displayName} tone="solid" />
            </button>

            {menuOpen ? (
              <>
                {/* Click-away layer: closing on an outside click without a
                    document listener keeps this component self-contained. */}
                <button
                  type="button"
                  className={styles.scrim}
                  aria-label={t("common.close")}
                  onClick={() => setMenuOpen(false)}
                />
                <div className={styles.menu} role="menu">
                  <div className={styles.menuName}>{displayName}</div>
                  <div className={styles.menuEmail}>{email}</div>

                  {/* Phones only: the header hands these two over rather than
                      keeping them on screen at all times. The visible labels
                      are hidden from assistive tech because both controls
                      already name themselves. */}
                  <div className={styles.menuControls}>
                    <div className={styles.menuRow}>
                      <span className={styles.menuRowLabel} aria-hidden="true">
                        {t("profile.theme")}
                      </span>
                      <ThemePicker theme={theme} variant="light" />
                    </div>
                    <div className={styles.menuRow}>
                      <span className={styles.menuRowLabel} aria-hidden="true">
                        {t("profile.language")}
                      </span>
                      <LanguageSelect className={styles.menuLanguage} />
                    </div>
                  </div>

                  <form action={signOut}>
                    <button type="submit" className={styles.signOut} role="menuitem">
                      {t("profile.signOut")}
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
