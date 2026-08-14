"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslator } from "@/i18n/provider";
import { isNavActive, visibleNavItems } from "./nav-items";
import styles from "./BottomNav.module.css";

/**
 * The phone tab bar. It answers the question the responsive brief put to the
 * design agent — whether the header's second row of nav links was right — with
 * "no": the destinations move to the bottom of the screen, where the thumb is,
 * and the header gets its full width back for the brand lockup.
 *
 * Rendered on every viewport and hidden above the phone breakpoint in CSS,
 * because deciding it in JavaScript would mean either a hydration mismatch or
 * a flash of the wrong navigation.
 */
export function BottomNav({ canManage, campaignHref }: { canManage: boolean; campaignHref: string }) {
  const t = useTranslator();
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label={t("nav.dashboard")}>
      {visibleNavItems(canManage).map((item) => {
        const active = isNavActive(pathname, item.match);
        return (
          <Link
            key={item.match}
            href={item.href ?? campaignHref}
            className={`${styles.tab} ${active ? styles.tabActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={item.icon} />
            </svg>
            <span className={styles.label}>{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
