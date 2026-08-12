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
 * `match` is the path prefix that marks the item current, separate from `href`
 * because the campaign link points at one specific campaign while every
 * campaign page should light it up.
 */
const NAV = [
  { href: "/", match: "/", key: "nav.dashboard" },
  { href: null, match: "/campaigns", key: "nav.campaign" },
  { href: "/history", match: "/history", key: "nav.history" },
  { href: "/manage", match: "/manage", key: "nav.management", manageOnly: true },
] as const;

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
  const locale = useLocale();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (match: string) =>
    match === "/" ? pathname === "/" : pathname.startsWith(match);

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

        <nav className={styles.nav} aria-label={t("nav.dashboard")}>
          {NAV.filter((item) => !("manageOnly" in item && item.manageOnly) || canManage).map((item) => (
            <Link
              key={item.match}
              href={item.href ?? campaignHref}
              className={`${styles.navLink} ${isActive(item.match) ? styles.navLinkActive : ""}`}
              aria-current={isActive(item.match) ? "page" : undefined}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className={styles.tools}>
          <ThemePicker theme={theme} />

          <label className={styles.languageLabel}>
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
