"use client";

import Link from "next/link";
import { useFormatters, useTranslator } from "@/i18n/provider";
import type { PastCampaignRow } from "@/lib/queries";
import styles from "./PreviousCampaigns.module.css";

/**
 * Finished campaigns at the foot of the dashboard, paginated so the page does
 * not grow without bound as years accumulate. Paging is done with links and a
 * query parameter rather than client state, so a page is shareable and
 * survives a reload.
 */
export function PreviousCampaigns({
  rows,
  page,
  pageCount,
}: {
  rows: PastCampaignRow[];
  page: number;
  pageCount: number;
}) {
  const t = useTranslator();
  const format = useFormatters();

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <div className={styles.label}>{t("dashboard.previousCampaigns")}</div>

        {pageCount > 1 ? (
          <div className={styles.pager}>
            <PagerLink href={`/?past=${page - 1}`} disabled={page === 0} label={t("common.previous")}>
              ←
            </PagerLink>
            <span className={styles.pageLabel}>
              {t("common.page")} {page + 1}/{pageCount}
            </span>
            <PagerLink
              href={`/?past=${page + 1}`}
              disabled={page >= pageCount - 1}
              label={t("common.next")}
            >
              →
            </PagerLink>
          </div>
        ) : null}
      </div>

      <div className={styles.rows}>
        {rows.map((row) => (
          <Link key={row.id} href={`/history/${row.id}`} className={styles.row}>
            <div className={styles.main}>
              <div className={styles.name}>{row.name}</div>
              <div className={styles.meta}>
                {t(`campaignTypes.${row.type}.name` as never)} ·{" "}
                {format.dateRange(row.startDate, row.endDate)}
              </div>
            </div>
            <div>
              <div className={styles.cellLabel}>{t("history.winner")}</div>
              <div className={styles.winner}>
                {row.winnerName ?? (row.wonByDraw ? t("history.notDrawnYet") : "–")}
              </div>
            </div>
            <div>
              <div className={styles.cellLabel}>{t("dashboard.yourPlacement")}</div>
              <div className={styles.placement}>
                {row.myRank ? `#${row.myRank} ${t("common.of")} ${row.participantCount}` : "–"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PagerLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className={`${styles.pagerButton} ${styles.pagerDisabled}`} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={styles.pagerButton} aria-label={label} scroll={false}>
      {children}
    </Link>
  );
}
