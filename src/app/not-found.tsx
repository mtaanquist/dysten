import Link from "next/link";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/auth/cookies";
import { resolveLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/translate";
import { Blobs } from "@/components/ui";
import styles from "./status.module.css";

/**
 * Reached by notFound() — a campaign or a past campaign that has been deleted,
 * and by anything mistyped.
 *
 * A server component, so it can read the language without waiting for the
 * client: whoever follows an old bookmark deserves to be told in their own
 * language, and the cookie holds that even when there is no session.
 */
export default async function NotFound() {
  const store = await cookies();
  const t = createTranslator(resolveLocale(store.get(LOCALE_COOKIE)?.value));

  return (
    <div className={styles.root}>
      <Blobs />
      <div className={styles.center}>
        <div className={styles.card}>
          <div className={`${styles.mark} ${styles.markQuiet}`} aria-hidden="true">
            ?
          </div>
          <h1 className={styles.title}>{t("errors.notFoundTitle")}</h1>
          <p className={styles.body}>{t("errors.notFoundBody")}</p>

          <div className={styles.actions}>
            <Link href="/" className={styles.primary}>
              {t("errors.backHome")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
