"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslator } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/config";
import styles from "./Toast.module.css";

/**
 * The design confirms saves with a transient toast rather than a dialog, so
 * logging a day never interrupts logging the next one.
 */

interface ToastContextValue {
  /** Shows a message by translation key, so toasts are localised like everything else. */
  showToast: (key: MessageKey) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const VISIBLE_MS = 1600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<MessageKey | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslator();

  const showToast = useCallback((key: MessageKey) => {
    setMessage(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* aria-live so the confirmation reaches screen readers, who cannot see
          a toast appear in the corner. */}
      <div className={styles.viewport} role="status" aria-live="polite">
        {message ? <div className={styles.toast}>{t(message)}</div> : null}
      </div>
    </ToastContext.Provider>
  );
}
