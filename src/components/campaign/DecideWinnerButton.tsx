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
 * a one-way door, and it is also what stops the campaign accepting the days
 * people are still filling in. Hence the confirmation: everything else on these
 * screens can be undone by doing it again.
 *
 * It is deliberately a button somebody presses rather than something that
 * happens on its own when the campaign ends: a winner is a moment worth
 * announcing, and it should have a person behind it.
 *
 * Lives here rather than under components/history because it is an action on a
 * campaign, and the campaign page carries it too — a campaign awaiting its
 * winner is still on the dashboard, and that is where a captain is looking.
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
      onClick={() => {
        if (!window.confirm(t(isRaffle ? "campaign.confirmDrawWinner" : "campaign.confirmDecideWinner"))) {
          return;
        }
        startTransition(async () => {
          const result = await decideCampaignWinner(campaignId);
          showToast(
            result.ok ? (isRaffle ? "toast.winnerDrawn" : "toast.winnerDecided") : result.error,
          );
        });
      }}
    >
      {t(isRaffle ? "campaign.drawWinner" : "campaign.decideWinner")}
    </button>
  );
}
