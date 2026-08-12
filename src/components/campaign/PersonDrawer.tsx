"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormatters, useTranslator } from "@/i18n/provider";
import type { PersonDetail } from "@/lib/queries";
import { Avatar } from "@/components/ui";
import styles from "./PersonDrawer.module.css";

/**
 * One participant's day-by-day figures, in a right-hand drawer.
 *
 * Driven by a `person` query parameter rather than client state, so the view is
 * server-rendered, linkable and survives a refresh. Closing is a link back to
 * the page without the parameter.
 */
export function PersonDrawer({ detail, closeHref }: { detail: PersonDetail; closeHref: string }) {
  const t = useTranslator();
  const format = useFormatters();
  const router = useRouter();

  // Escape closes the drawer, as a dialog should.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeHref, router]);

  const unit = t(`campaignTypes.${detail.campaignType}.unit` as never);

  return (
    <div className={styles.overlay}>
      <Link href={closeHref} scroll={false} className={styles.scrim} aria-label={t("common.close")} />

      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={detail.displayName}>
        <div className={styles.head}>
          <Avatar name={detail.displayName} size="lg" />
          <div className={styles.headText}>
            <div className={styles.name}>{detail.displayName}</div>
            <div className={styles.email}>{detail.email}</div>
          </div>
          <Link href={closeHref} scroll={false} className={styles.close} aria-label={t("common.close")}>
            ×
          </Link>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryLabel}>{detail.campaignName}</div>
          <div className={styles.summaryValue}>
            {format.value(detail.campaignType, detail.total)} {unit}
          </div>
        </div>

        <div className={styles.tableLabel}>{t("campaign.dayByDay")}</div>

        {detail.rows.length === 0 ? (
          <p className={styles.empty}>{t("campaign.noEntries")}</p>
        ) : (
          <div className={styles.scroller}>
            <div className={styles.table}>
              <div className={styles.headRow}>
                <div>{t("campaign.dayByDay")}</div>
                <div className={styles.right}>{t(`campaignTypes.${detail.campaignType}.field1` as never)}</div>
                <div className={styles.right}>{t(`campaignTypes.${detail.campaignType}.field2` as never)}</div>
                <div className={styles.right}>{t("campaign.total")}</div>
              </div>

              {detail.rows.map((row) => (
                <div key={row.date} className={styles.row}>
                  <div>
                    <div className={styles.date}>{format.date(row.date)}</div>
                    <div className={styles.dow}>
                      {format.weekday(row.date)}
                      {row.editedByAdmin ? (
                        <span className={styles.adminNote}> · {t("campaign.editedByAdmin")}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.right}>{format.value(detail.campaignType, row.value1)}</div>
                  <div className={styles.right}>{format.value(detail.campaignType, row.value2)}</div>
                  <div className={`${styles.right} ${styles.rowTotal}`}>
                    {format.value(detail.campaignType, row.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
