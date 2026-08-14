"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslator } from "@/i18n/provider";
import { Blobs } from "@/components/ui";
import styles from "./status.module.css";

/**
 * What a reader sees when a page throws.
 *
 * "Try again" is the point of this screen. `reset()` re-renders the segment
 * that failed, in place — so a request that lost a database connection or hit a
 * transient error puts you back exactly where you were, with what you had
 * typed still in the URL, rather than dropping you at the dashboard and making
 * you navigate back. The link home is the fallback for when retrying does not
 * help.
 *
 * Next replaces the message with a generic string in production builds, so
 * there is nothing here to leak; the digest is the only way to tie what someone
 * saw to what the server logged, which is why it is on the page.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslator();

  useEffect(() => {
    // Server-side faults are already in the container log; this is the client
    // half, which otherwise leaves no trace at all.
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className={styles.root}>
      <Blobs />
      <div className={styles.center}>
        <div className={styles.card} role="alert">
          <div className={styles.mark} aria-hidden="true">
            !
          </div>
          <h1 className={styles.title}>{t("errors.pageTitle")}</h1>
          <p className={styles.body}>{t("errors.pageBody")}</p>

          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={reset}>
              {t("errors.retry")}
            </button>
            <Link href="/" className={styles.secondary}>
              {t("errors.backHome")}
            </Link>
          </div>

          {error.digest ? (
            <p className={styles.digest}>
              {t("errors.reference")} {error.digest}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
