"use client";

import Link from "next/link";
import { useFormatters, useTranslator } from "@/i18n/provider";
import type { CampaignSummary, CumulativeSeries, HighlightItem } from "@/lib/queries";
import { Avatar, Panel, PanelTitle, ProgressBar } from "@/components/ui";
import styles from "./panels.module.css";

/**
 * The deep-blue shared-goal banner.
 *
 * The design review moved this to the top of the campaign page — it breaks up
 * the white panels and gives the page a scoreboard to open on.
 */
export function GoalPanel({ summary }: { summary: CampaignSummary }) {
  const t = useTranslator();
  const format = useFormatters();

  if (summary.goalFraction === null || !summary.goalValue) return null;
  const unit = t(`campaignTypes.${summary.type}.unit` as never);

  return (
    <section className={styles.goal}>
      <div className={styles.goalHead}>
        <div>
          <div className={styles.goalLabel}>{t("campaign.sharedGoal")}</div>
          <div className={styles.goalName}>{summary.goalName}</div>
        </div>
        <div className={styles.goalTotals}>
          {format.value(summary.type, summary.combined)} {t("common.of")}{" "}
          {format.value(summary.type, summary.goalValue)} {unit} {t("campaign.combinedSoFar")}
        </div>
      </div>
      <div className={styles.goalBar}>
        <ProgressBar fraction={summary.goalFraction} height={12} />
      </div>
    </section>
  );
}

/** Best single day, longest streak, biggest climber. */
export function Highlights({ items, type }: { items: HighlightItem[]; type: string }) {
  const t = useTranslator();
  const format = useFormatters();
  const unit = t(`campaignTypes.${type}.unit` as never);

  return (
    <div className={styles.highlights}>
      {items.map((item) => {
        const label =
          item.key === "bestDay"
            ? t("campaign.bestDay")
            : item.key === "longestStreak"
              ? t("campaign.longestStreak")
              : t("campaign.biggestClimber");

        let value = "–";
        if (item.value !== null) {
          if (item.key === "bestDay") value = `${format.value(type, item.value)} ${unit}`;
          else if (item.key === "longestStreak") value = `${item.value} ${t("common.days")}`;
          else value = `+${item.value} ${t("campaign.rankFull").toLowerCase()}`;
        }

        const who = item.date ? `${item.who} · ${format.dateMedium(item.date)}` : item.who;

        return (
          <Panel key={item.key} className={styles.highlight} padding="tight">
            <div className={styles.highlightLabel}>{label}</div>
            <div className={styles.highlightValue}>{value}</div>
            <div className={styles.highlightWho}>{who}</div>
          </Panel>
        );
      })}
    </div>
  );
}

/**
 * Cumulative totals for the leading participants.
 *
 * Hand-drawn SVG rather than a charting library: it's five polylines on a
 * fixed viewBox, it renders on the server, and it costs nothing in bundle size.
 */
export function ProgressChart({ series, type }: { series: CumulativeSeries[]; type: string }) {
  const t = useTranslator();
  const format = useFormatters();

  const pointCount = series[0]?.points.length ?? 0;
  if (pointCount === 0) {
    return (
      <Panel>
        <PanelTitle>{t("campaign.progress")}</PanelTitle>
        <p className={styles.empty}>{t("campaign.noEntries")}</p>
      </Panel>
    );
  }

  const maxValue = Math.max(1, ...series.map((line) => line.total));
  const toPoints = (line: CumulativeSeries) =>
    line.points
      .map((point, index) => {
        const x = pointCount > 1 ? (index / (pointCount - 1)) * 580 + 10 : 10;
        const y = 170 - (point.value / maxValue) * 150;
        return `${Math.round(x)},${Math.round(y)}`;
      })
      .join(" ");

  const firstDay = series[0].points[0].date;
  const lastDay = series[0].points[pointCount - 1].date;

  return (
    <Panel>
      <PanelTitle>{t("campaign.progress")}</PanelTitle>
      <svg viewBox="0 0 600 190" className={styles.chart} role="img" aria-label={t("campaign.progress")}>
        <line x1="10" y1="170" x2="590" y2="170" stroke="var(--c-border)" strokeWidth="1" />
        <line x1="10" y1="95" x2="590" y2="95" stroke="var(--c-grid-line)" strokeWidth="1" />
        <line x1="10" y1="20" x2="590" y2="20" stroke="var(--c-grid-line)" strokeWidth="1" />
        {series.map((line, index) => (
          <polyline
            key={line.userId}
            points={toPoints(line)}
            fill="none"
            stroke={`var(--c-series-${index + 1})`}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className={styles.chartAxis}>
        <span>{format.date(firstDay)}</span>
        <span>{format.date(lastDay)}</span>
      </div>

      <div className={styles.legend}>
        {series.map((line, index) => (
          <div key={line.userId} className={styles.legendItem}>
            <span
              className={styles.legendSwatch}
              style={{ background: `var(--c-series-${index + 1})` }}
              aria-hidden="true"
            />
            {line.displayName}
            <span className={styles.legendTotal}>{format.value(type, line.total)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Everyone on the roster, including people who have not logged anything yet. */
export function ParticipantList({
  participants,
  basePath,
}: {
  participants: { id: string; displayName: string; email: string; daysLogged: number }[];
  /** See Leaderboard: a path, not a builder, so it can cross to the client. */
  basePath: string;
}) {
  const t = useTranslator();

  return (
    <Panel>
      <PanelTitle>{t("campaign.participants")}</PanelTitle>
      <div className={styles.roster}>
        {participants.map((participant) => (
          <Link
            key={participant.id}
            href={`${basePath}?person=${participant.id}`}
            scroll={false}
            className={styles.rosterRow}
          >
            <Avatar name={participant.displayName} />
            <div className={styles.rosterText}>
              <div className={styles.rosterName}>{participant.displayName}</div>
              <div className={styles.rosterSub}>
                {participant.daysLogged > 0
                  ? t("campaign.daysLogged", { count: participant.daysLogged })
                  : t("campaign.notLoggedYet")}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
