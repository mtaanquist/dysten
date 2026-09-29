"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslator } from "@/i18n/provider";
import type { WinnerAnnouncement as Announcement } from "@/lib/queries";
import { dismissWinnerAnnouncements } from "@/app/actions/campaigns";
import { Avatar } from "@/components/ui";
import { Confetti } from "./Confetti";
import styles from "./WinnerAnnouncement.module.css";

/**
 * Closed in this tab already. The server hears about it too, but a page the
 * router kept from before that (the back button) would otherwise show it again.
 */
const dismissedHere = new Set<string>();

/**
 * Names a settled campaign's winner, with confetti, to everyone the first time
 * they open the app afterwards, the captain who pressed the button included.
 * Several at once are shown one after the other.
 */
export function WinnerAnnouncement({ announcements }: { announcements: Announcement[] }) {
  const t = useTranslator();
  const [closed, setClosed] = useState<string[]>([]);
  const primary = useRef<HTMLButtonElement>(null);

  const queue = announcements.filter(
    (item) => !dismissedHere.has(item.campaignId) && !closed.includes(item.campaignId),
  );
  const current = queue[0];

  function next() {
    if (!current) return;
    dismissedHere.add(current.campaignId);
    setClosed((ids) => [...ids, current.campaignId]);
    void dismissWinnerAnnouncements([current.campaignId]);
  }

  useEffect(() => {
    if (!current) return;
    primary.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") next();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  if (!current) return null;

  const more = queue.length > 1;

  return (
    <div className={styles.overlay}>
      <div className={styles.scrim} aria-hidden="true" />
      {/* Keyed so each winner gets a burst of their own. */}
      <Confetti key={`confetti-${current.campaignId}`} />
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="winner-announcement-title"
        key={`card-${current.campaignId}`}
      >
        <div className={styles.campaign}>{current.campaignName}</div>
        <h2 id="winner-announcement-title" className={styles.label}>
          {t(current.isRaffle ? "winnerAnnouncement.drawnTitle" : "winnerAnnouncement.decidedTitle")}
        </h2>
        <div className={styles.avatar}>
          <Avatar name={current.winnerName} />
        </div>
        <div className={styles.name}>{current.winnerName}</div>
        {current.isYou ? <p className={styles.you}>{t("winnerAnnouncement.itsYou")}</p> : null}

        <div className={styles.actions}>
          <Link href={`/history/${current.campaignId}`} className={styles.secondary} onClick={next}>
            {t("winnerAnnouncement.seeResults")}
          </Link>
          <button ref={primary} type="button" className={styles.primary} onClick={next}>
            {t(more ? "winnerAnnouncement.next" : "winnerAnnouncement.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
