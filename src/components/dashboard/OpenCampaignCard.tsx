"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatters, useTranslator } from "@/i18n/provider";
import { joinCampaign } from "@/app/actions/campaigns";
import { useToast } from "@/components/ui/Toast";
import { Pill } from "@/components/ui";
import { accentStyle } from "@/lib/campaign-types";
import type { CampaignSummary } from "@/lib/queries";
import styles from "./OpenCampaignCard.module.css";

/**
 * A campaign the user could join but hasn't. Unlike the joined cards this one
 * is not itself a link — it carries a single explicit action instead, so a
 * stray click can't enrol someone.
 */
export function OpenCampaignCard({ summary }: { summary: CampaignSummary }) {
  const t = useTranslator();
  const format = useFormatters();
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  const timeLabel =
    summary.status === "upcoming"
      ? t("campaign.startsIn", { count: summary.daysUntilStart })
      : `${summary.daysRemaining} ${t("campaign.daysRemaining", { count: summary.daysRemaining })}`;

  return (
    <article className={styles.card}>
      <div className={styles.pills}>
        <Pill tone="type" style={accentStyle(summary.type)}>
          {t(`campaignTypes.${summary.type}.name` as never)}
        </Pill>
      </div>
      <h3 className={styles.name}>{summary.name}</h3>
      <div className={styles.meta}>
        {format.dateRange(summary.startDate, summary.endDate)} · {timeLabel}
      </div>
      {summary.description ? <p className={styles.description}>{summary.description}</p> : null}

      <button
        type="button"
        className={styles.join}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await joinCampaign(summary.id);
            showToast(result.ok ? "toast.joined" : result.error);
            if (result.ok) router.push(`/campaigns/${summary.id}`);
          })
        }
      >
        {t("dashboard.join")}
      </button>
    </article>
  );
}
