"use client";

import { useTransition } from "react";
import { useTranslator } from "@/i18n/provider";
import { reopenCampaign } from "@/app/actions/campaigns";
import { useToast } from "@/components/ui/Toast";
import styles from "./ReopenButton.module.css";

/**
 * Admin-only: unlocks a finished campaign so entries can be corrected. The
 * campaign keeps its "ended" status — reopening is for fixing the record, not
 * for restarting the competition.
 */
export function ReopenButton({
  campaignId,
  alreadyReopened,
}: {
  campaignId: string;
  alreadyReopened: boolean;
}) {
  const t = useTranslator();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  if (alreadyReopened) {
    return <span className={styles.reopened}>{t("campaign.reopened")}</span>;
  }

  return (
    <button
      type="button"
      className={styles.button}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reopenCampaign(campaignId);
          showToast(result.ok ? "toast.campaignReopened" : result.error);
        })
      }
    >
      {t("history.reopen")}
    </button>
  );
}
