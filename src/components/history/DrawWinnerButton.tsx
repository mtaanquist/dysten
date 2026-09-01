"use client";

import { useTransition } from "react";
import { useTranslator } from "@/i18n/provider";
import { drawCampaignWinner } from "@/app/actions/campaigns";
import { useToast } from "@/components/ui/Toast";
import styles from "./DrawWinnerButton.module.css";

/**
 * Runs a raffle campaign's prize draw.
 *
 * Captain-or-above, and only ever once — the result is written down, so this is
 * a one-way door. It is deliberately a button somebody presses rather than
 * something that happens on its own when the campaign ends: a draw is a moment
 * worth announcing, and it should have a person behind it.
 */
export function DrawWinnerButton({ campaignId }: { campaignId: string }) {
  const t = useTranslator();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={styles.button}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await drawCampaignWinner(campaignId);
          showToast(result.ok ? "toast.winnerDrawn" : result.error);
        })
      }
    >
      {t("history.draw")}
    </button>
  );
}
