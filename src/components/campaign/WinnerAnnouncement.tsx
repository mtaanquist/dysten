"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslator } from "@/i18n/provider";
import type { WinnerAnnouncement as Announcement } from "@/lib/queries";
import { dismissWinnerAnnouncements } from "@/app/actions/campaigns";
import { Avatar } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Confetti } from "./Confetti";
import styles from "./WinnerAnnouncement.module.css";

/**
 * Closed in this tab already, as "userId:campaignId". The server hears about it
 * too, but a page the router kept from before that (the back button) would
 * otherwise show it again. Keyed by person because signing out and in as
 * someone else does not reload the page.
 */
const dismissedHere = new Set<string>();

/**
 * Names a settled campaign's winner, with confetti, to everyone the first time
 * they open the app afterwards, the captain who pressed the button included.
 * Several at once are shown one after the other.
 *
 * A native modal <dialog>: it keeps focus inside, makes the page behind inert,
 * sits above everything else on the page and hands focus back when it closes.
 */
export function WinnerAnnouncement({
  userId,
  announcements,
}: {
  userId: string;
  announcements: Announcement[];
}) {
  const t = useTranslator();
  const { showToast } = useToast();
  const [closed, setClosed] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);

  const queue = announcements.filter(
    (item) =>
      !dismissedHere.has(`${userId}:${item.campaignId}`) && !closed.includes(item.campaignId),
  );
  const current = queue[0];
  const currentId = current?.campaignId;

  function next() {
    if (!current) return;
    const key = `${userId}:${current.campaignId}`;
    // A held-down Escape can land twice before the next render.
    if (dismissedHere.has(key)) return;
    dismissedHere.add(key);
    if (queue.length === 1) dialog.current?.close();
    setClosed((ids) => [...ids, current.campaignId]);

    // Not awaited: the dialog has already moved on. If it did not stick, the
    // announcement just comes back on the next full page load.
    dismissWinnerAnnouncements([current.campaignId])
      .then((result) => {
        if (!result.ok) showToast(result.error);
      })
      .catch(() => showToast("errors.generic"));
  }

  useEffect(() => {
    const element = dialog.current;
    if (!currentId || !element) return;
    if (!element.open) element.showModal();
    // showModal would otherwise pick the first control, the results link.
    primary.current?.focus();

    // The person drawer also closes on Escape from a document listener; this
    // one Escape is the dialog's alone.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") event.stopPropagation();
    };
    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, [currentId]);

  if (!current) return null;

  const more = queue.length > 1;

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="winner-announcement-title"
      aria-describedby="winner-announcement-campaign winner-announcement-name winner-announcement-you"
      // Escape. Kept open while another winner is queued behind this one.
      onCancel={(event) => {
        if (more) event.preventDefault();
        next();
      }}
    >
      {/* Keyed so each winner gets a burst of their own. */}
      <Confetti key={`confetti-${current.campaignId}`} />
      <div className={styles.card} key={`card-${current.campaignId}`}>
        <div id="winner-announcement-campaign" className={styles.campaign}>
          {current.campaignName}
        </div>
        <h2 id="winner-announcement-title" className={styles.label}>
          {t(current.isRaffle ? "winnerAnnouncement.drawnTitle" : "winnerAnnouncement.decidedTitle")}
        </h2>
        <div className={styles.avatar} aria-hidden="true">
          <Avatar name={current.winnerName} />
        </div>
        <div id="winner-announcement-name" className={styles.name}>
          {current.winnerName}
        </div>
        {current.isYou ? (
          <p id="winner-announcement-you" className={styles.you}>
            {t("winnerAnnouncement.itsYou")}
          </p>
        ) : null}

        <div className={styles.actions}>
          <Link href={`/history/${current.campaignId}`} className={styles.secondary} onClick={next}>
            {t("winnerAnnouncement.seeResults")}
          </Link>
          <button type="button" className={styles.primary} onClick={next} ref={primary}>
            {t(more ? "winnerAnnouncement.next" : "winnerAnnouncement.close")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
