import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser, authProvider } from "@/lib/auth";
import { LOCALE_COOKIE, THEME_COOKIE } from "@/lib/auth/cookies";
import { resolveLocale } from "@/i18n/config";
import { resolveTheme } from "@/lib/theme";
import { ThemePicker } from "@/components/layout/ThemePicker";
import { createTranslator } from "@/i18n/translate";
import { signInAsUser } from "@/app/actions/session";
import { BRAND_NAME, ORG_NAME } from "@/lib/branding";
import { Avatar, Blobs } from "@/components/ui";
import { LanguagePicker } from "@/components/layout/LanguagePicker";
import styles from "./sign-in.module.css";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ accounts?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { accounts } = await searchParams;
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);
  // Nobody is signed in here, so both preferences come from this browser.
  const theme = resolveTheme(store.get(THEME_COOKIE)?.value);
  const t = createTranslator(locale);

  const provider = authProvider();
  const isDev = provider.name === "dev";
  const showPicker = isDev && accounts === "1";

  // Only needed for the development account picker; with Entra ID the identity
  // provider owns this step entirely.
  const directory = showPicker
    ? await prisma.user.findMany({
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true, email: true, role: true },
      })
    : [];

  return (
    <div className={styles.root}>
      <Blobs />
      <div className={styles.center}>
        <div className={styles.card}>
          {/* Same lockup as the header: sub-brand over organisation, or the
              organisation beside the product name when there is no sub-brand. */}
          <div className={`${styles.brand} ${BRAND_NAME ? styles.brandStacked : ""}`}>
            <span className={styles.wordmark}>{BRAND_NAME ?? ORG_NAME}</span>
            <span className={styles.tagline}>{BRAND_NAME ? ORG_NAME : t("app.tagline")}</span>
          </div>

          {showPicker ? (
            <>
              <h1 className={styles.title}>{t("signIn.devTitle")}</h1>
              <p className={styles.subtitle}>{t("signIn.devSubtitle")}</p>
              <ul className={styles.accounts}>
                {directory.map((account) => (
                  <li key={account.id}>
                    <form
                      action={async () => {
                        "use server";
                        await signInAsUser(account.id);
                      }}
                    >
                      <button type="submit" className={styles.account}>
                        <Avatar name={account.displayName} />
                        <span className={styles.accountText}>
                          <span className={styles.accountName}>{account.displayName}</span>
                          <span className={styles.accountEmail}>{account.email}</span>
                        </span>
                        <span className={styles.accountRole}>
                          {t(
                            account.role === "ADMIN"
                              ? "roles.admin"
                              : account.role === "CAPTAIN"
                                ? "roles.captain"
                                : "roles.member",
                          )}
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <Link href="/sign-in" className={`textLink ${styles.back}`}>
                ← {t("common.back")}
              </Link>
            </>
          ) : (
            <>
              <h1 className={styles.title}>{t("signIn.title")}</h1>
              <p className={styles.subtitle}>{t("signIn.subtitle")}</p>
              <Link
                href={isDev ? "/sign-in?accounts=1" : provider.signInUrl()}
                className={styles.primary}
              >
                {t("signIn.button")}
              </Link>
              <div className={styles.hint}>{t("signIn.hint")}</div>
            </>
          )}

          <div className={styles.language}>
            <ThemePicker theme={theme} variant="light" />
            <LanguagePicker locale={locale} variant="light" />
          </div>
        </div>
      </div>
    </div>
  );
}
