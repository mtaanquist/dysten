"use client";

import Link from "next/link";
import { useFormatters, useTranslator } from "@/i18n/provider";
import type { LeaderboardRow } from "@/lib/queries";
import { Avatar } from "@/components/ui";
import styles from "./Leaderboard.module.css";

/**
 * Standings during a running campaign.
 *
 * Tapping a name opens that person's day-by-day view — the spec wants every
 * participant's daily figures visible to everyone in the campaign, not just a
 * summary. Movement arrows compare against yesterday's standings.
 */
export function Leaderboard({
  rows,
  type,
  gap,
  basePath,
}: {
  rows: LeaderboardRow[];
  type: string;
  gap: { amount: number; rank: number } | null;
  /**
   * Page the drawer links back to. A plain string rather than a builder
   * function, because functions cannot cross the server/client boundary.
   */
  basePath: string;
}) {
  const t = useTranslator();
  const format = useFormatters();
  const unit = t(`campaignTypes.${type}.unit` as never);

  return (
    <div>
      <div className={styles.scroller}>
        <div className={styles.table}>
          <div className={styles.headRow}>
            <div>{t("campaign.rank")}</div>
            <div>{t("campaign.name")}</div>
            <div className={styles.right}>{t("campaign.total")}</div>
            <div className={styles.right}>{t("campaign.averagePerDay")}</div>
            <div className={styles.right}>{t("campaign.move")}</div>
          </div>

          {rows.map((row) => (
            <Link
              key={row.userId}
              href={`${basePath}?person=${row.userId}`}
              scroll={false}
              className={`${styles.row} ${row.isMe ? styles.rowMe : ""}`}
            >
              <div className={styles.rank}>{row.rank}</div>

              <div className={styles.person}>
                <Avatar name={row.displayName} />
                <div className={styles.personText}>
                  <div className={styles.name}>{row.displayName}</div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${Math.round(row.barFraction * 100)}%` }} />
                  </div>
                </div>
                {row.streak >= 3 ? <span className={styles.streak}>{row.streak}d</span> : null}
              </div>

              <div className={styles.right}>
                <div className={styles.total}>{format.value(type, row.total)}</div>
                <div className={styles.split}>
                  {format.value(type, row.value1)} + {format.value(type, row.value2)}
                </div>
              </div>

              <div className={`${styles.right} ${styles.average}`}>{format.value(type, row.average)}</div>

              <div
                className={`${styles.right} ${styles.move} ${
                  row.movement.direction === "up"
                    ? styles.moveUp
                    : row.movement.direction === "down"
                      ? styles.moveDown
                      : styles.moveNone
                }`}
              >
                {row.movement.direction === "up"
                  ? `▲ ${row.movement.delta}`
                  : row.movement.direction === "down"
                    ? `▼ ${Math.abs(row.movement.delta)}`
                    : "–"}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {gap ? (
        <div className={styles.gap}>
          {t("campaign.gapBehind", {
            amount: format.value(type, gap.amount),
            unit,
            rank: gap.rank,
          })}
        </div>
      ) : null}
    </div>
  );
}
