import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { LOCALE_COOKIE } from "@/lib/auth/cookies";
import { resolveLocale } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/provider";
import { createTranslator } from "@/i18n/translate";
import { ToastProvider } from "@/components/ui/Toast";
import { ORG_NAME } from "@/lib/branding";
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

export const metadata: Metadata = {
  title: ORG_NAME ? `${ORG_NAME} Activity Tracker` : "Activity Tracker",
  description: "Join activity campaigns, log daily values and compete on the leaderboard.",
};

export const viewport: Viewport = {
  themeColor: "#1789ce",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Signed out, the language still needs to come from somewhere: the cookie
  // holds the last choice made on this browser, and the default is Danish.
  const store = await cookies();
  const locale = user?.locale ?? resolveLocale(store.get(LOCALE_COOKIE)?.value);
  const t = createTranslator(locale);

  return (
    <html lang={locale} className={barlow.variable}>
      <body>
        <LocaleProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
        <span className="srOnly">{t("app.tagline")}</span>
      </body>
    </html>
  );
}
