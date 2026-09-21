"use client";

import { useTransition } from "react";
import { useTranslator } from "@/i18n/provider";
import { decideCampaignWinner } from "@/app/actions/campaigns";
import { useToast } from "@/components/ui/Toast";
import styles from "./DecideWinnerButton.module.css";

/**
 * Settles a finished campaign: draws a raffle campaign's ticket, or names the
 * top of a leaderboard campaign's board.
 *
 * Captain-or-above, and only ever once — the result is written down, so this is
 * a one-way door. It is deliberately a button somebody presses rather than
 * something that happens on its own when the campaign ends: a winner is a
 * moment worth announcing, it should have a person behind it, and until it
 * happens everyone still has time to type up the days they missed.
 */
export function DecideWinnerButton({ campaignId, isRaffle }: { campaignId: string; isRaffle: boolean }) {
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
          const result = await decideCampaignWinner(campaignId);
          showToast(
            result.ok ? (isRaffle ? "toast.winnerDrawn" : "toast.winnerDecided") : result.error,
          );
        })
      }
    >
      {t(isRaffle ? "history.draw" : "history.decide")}
    </button>
  );
}
