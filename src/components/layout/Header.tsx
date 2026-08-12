"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { useLocale, useTranslator } from "@/i18n/provider";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { setLocale, signOut } from "@/app/actions/session";
import { Avatar } from "@/components/ui";
import styles from "./Header.module.css";

interface HeaderProps {
  orgName: string;
  displayName: string;
  email: string;
  canManage: boolean;
}

const NAV = [
  { href: "/", key: "nav.dashboard" },
  { href: "/campaigns", key: "nav.campaign" },
  { href: "/history", key: "nav.history" },
  { href: "/manage", key: "nav.management", manageOnly: true },
] as const;

export function Header({ orgName, displayName, email, canManage }: HeaderProps) {
  const t = useTranslator();
  const locale = useLocale();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={t("nav.dashboard")}>
          <span className={styles.wordmark}>{orgName}</span>
          <span className={styles.tagline}>{t("app.tagline")}</span>
        </Link>

        <nav className={styles.nav} aria-label={t("nav.dashboard")}>
          {NAV.filter((item) => !("manageOnly" in item && item.manageOnly) || canManage).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ""}`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className={styles.tools}>
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
