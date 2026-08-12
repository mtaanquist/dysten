"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { createTranslator, type Translator } from "./translate";
import { createFormatters, type Formatters } from "@/lib/format";

/**
 * Makes the active locale available to client components.
 *
 * Server components call createTranslator/createFormatters directly — they
 * already know the user. This context exists so interactive components (the
 * calendar, the drawer, toasts) don't need translated strings threaded through
 * as props from every call site.
 */

interface LocaleContextValue {
  locale: Locale;
  t: Translator;
  format: Formatters;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createTranslator(locale), format: createFormatters(locale) }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context) return context;

  // A component rendered outside the provider still renders readable text
  // rather than crashing — useful in isolated tests.
  return {
    locale: DEFAULT_LOCALE,
    t: createTranslator(DEFAULT_LOCALE),
    format: createFormatters(DEFAULT_LOCALE),
  };
}

export function useTranslator(): Translator {
  return useLocaleContext().t;
}

export function useFormatters(): Formatters {
  return useLocaleContext().format;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}
