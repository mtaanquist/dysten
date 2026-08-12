"use client";

import Link from "next/link";
import { useFormatters, useTranslator } from "@/i18n/provider";
import type { CampaignSummary } from "@/lib/queries";
import { Pill, ProgressBar } from "@/components/ui";
import styles from "./CampaignCard.module.css";

/**
 * A campaign the user has joined, as it appears on the dashboard.
 *
 * The whole card is the link — the design dropped the separate "open campaign"
 * action in favour of the card itself being the hit area. The right-hand deep
 * blue panel carries the shared goal plus this user's standing, which is where
 * the stats moved to when the quick-entry form came off the dashboard.
 */
export function CampaignCard({ summary }: { summary: CampaignSummary }) {
  const t = useTranslator();
  const format = useFormatters();

  const unit = t(`campaignTypes.${summary.type}.unit` as never);
  const timeLabel =
    summary.status === "upcoming"
      ? t("campaign.startsIn", { count: summary.daysUntilStart })
      : summary.status === "ended"
        ? t("campaign.ended")
        : `${summary.daysRemaining} ${t("campaign.daysRemaining", { count: summary.daysRemaining })}`;

  return (
    <Link href={`/campaigns/${summary.id}`} className={styles.card}>
      <div className={styles.info}>
        <div className={styles.pills}>
          <Pill>{t(`campaignTypes.${summary.type}.name` as never)}</Pill>
          {summary.myStreak >= 2 ? (
            <Pill tone="maroon">{t("campaign.streakBadge", { count: summary.myStreak })}</Pill>
          ) : null}
        </div>

        <h2 className={styles.name}>{summary.name}</h2>
        <div className={styles.meta}>
          {format.dateRange(summary.startDate, summary.endDate)} · {timeLabel}
        </div>
        {summary.description ? <p className={styles.description}>{summary.description}</p> : null}
      </div>

      <div className={styles.hero}>
        <span className={styles.heroBlob} aria-hidden="true" />
        <div className={styles.heroContent}>
          {summary.goalFraction !== null && summary.goalValue ? (
            <div>
              <div className={styles.heroLabel}>{t("campaign.sharedGoal")}</div>
              <div className={styles.goalName}>{summary.goalName}</div>
              <div className={styles.goalBar}>
                <ProgressBar fraction={summary.goalFraction} />
              </div>
              <div className={styles.goalMeta}>
                <span>
                  {format.value(summary.type, summary.combined)} {t("common.of")}{" "}
                  {format.value(summary.type, summary.goalValue)} {unit}
                </span>
                <span>{format.percent(summary.goalFraction)}</span>
              </div>
            </div>
          ) : (
            <div className={styles.heroLabel}>{t("dashboard.yourTotal")}</div>
          )}

          <div className={styles.stats}>
            <Stat label={t("dashboard.yourTotal")} value={format.value(summary.type, summary.myTotal)} suffix={unit} />
            <Stat
              label={t("dashboard.yourRank")}
              value={summary.myRank ? `#${summary.myRank}` : "–"}
              suffix={summary.totalParticipantsRanked ? `${t("common.of")} ${summary.totalParticipantsRanked}` : ""}
              accent
            />
            <Stat
              label={t("dashboard.dailyAverage")}
              value={format.value(summary.type, summary.myAverage)}
              suffix={unit}
            />
          </div>

          {summary.status === "upcoming" ? null : summary.myMissingDays > 0 ? (
            <div className={styles.missing}>
              <span className={styles.missingDot} aria-hidden="true" />
              {t("campaign.missingDays", { count: summary.myMissingDays })}
            </div>
          ) : (
            <div className={styles.caughtUp}>{t("campaign.missingNone")}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>
        <span className={accent ? styles.statNumberAccent : styles.statNumber}>{value}</span>
        {suffix ? <span className={styles.statSuffix}>{suffix}</span> : null}
      </div>
    </div>
  );
}
