import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { LOCALE_COOKIE, THEME_COOKIE } from "@/lib/auth/cookies";
import { resolveLocale } from "@/i18n/config";
import { resolveTheme, themeAttribute } from "@/lib/theme";
import { LocaleProvider } from "@/i18n/provider";
import { createTranslator } from "@/i18n/translate";
import { ToastProvider } from "@/components/ui/Toast";
import { BRAND_NAME, ORG_NAME } from "@/lib/branding";
import "@/styles/globals.css";

/**
 * next/font downloads Barlow at build time and serves it from this origin, so
 * no user's browser ever calls a third-party font CDN. That matters for an
 * internal EU tool, and it removes a render-blocking external request too.
 */
const barlow = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

/**
 * Signed out, the language still needs to come from somewhere: the cookie holds
 * the last choice made on this browser, and the default is Danish.
 */
async function currentLocale() {
  const user = await getCurrentUser();
  if (user) return user.locale;
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value);
}

/** Same story for the theme: the account's choice, else this browser's. */
async function currentTheme() {
  const user = await getCurrentUser();
  if (user) return user.theme;
  const store = await cookies();
  return resolveTheme(store.get(THEME_COOKIE)?.value);
}

/**
 * The browser tab follows the reader's language too — the product name is
 * translated copy (`app.tagline`), not a literal, so it cannot be a static
 * `metadata` export.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await currentLocale());
  // The tab shows whoever runs this, then what it is — the sub-brand when there
  // is one, since that is the more identifying half in a strip of tabs.
  return {
    title: `${BRAND_NAME ?? ORG_NAME} · ${t("app.tagline")}`,
    description: t("app.description"),
  };
}

/**
 * The browser chrome — the address bar on Android, the status bar on iOS —
 * takes its colour from here, so it needs one value per palette or it stays
 * light blue behind a dark page.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1789ce" },
    { media: "(prefers-color-scheme: dark)", color: "#0d2b3e" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, theme] = await Promise.all([currentLocale(), currentTheme()]);

  return (
    // No attribute at all for "system" — that is what hands the decision to
    // prefers-color-scheme in tokens.css. Written here on the server, so the
    // first paint is already correct rather than corrected.
    <html lang={locale} data-theme={themeAttribute(theme) ?? undefined} className={barlow.variable}>
      <body>
        <LocaleProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
