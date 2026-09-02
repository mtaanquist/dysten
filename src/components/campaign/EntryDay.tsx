"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { IsoDate } from "@/lib/dates";

/**
 * The day the entry controls are pointed at.
 *
 * It lives up here because three components need to agree on it. The month grid
 * and the day-at-a-time form are two views of the same thing, only one of them
 * on screen at a time, and the step calculator writes into whichever day those
 * two are showing. Keeping the selection in each of them separately would mean
 * the calculator had to guess which one to ask.
 */

export type EntryField = "value1" | "value2";

/**
 * A write made from outside the entry controls — the calculator's copy button.
 *
 * The controls keep a draft of anything typed but not yet saved, and a draft
 * shadows the stored value. Without being told, a control that had been typed
 * into would go on showing the old text after the calculator overwrote it. The
 * counter makes each write distinct, so two copies of the same number to the
 * same day still register as two events.
 */
export interface ExternalWrite {
  date: IsoDate;
  field: EntryField;
  count: number;
}

interface EntryDayValue {
  selected: IsoDate;
  select: (date: IsoDate) => void;
  lastWrite: ExternalWrite | null;
  noteWrite: (date: IsoDate, field: EntryField) => void;
}

const EntryDayContext = createContext<EntryDayValue | null>(null);

export function EntryDayProvider({
  initial,
  children,
}: {
  initial: IsoDate;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<IsoDate>(initial);
  const [lastWrite, setLastWrite] = useState<ExternalWrite | null>(null);

  const noteWrite = useCallback((date: IsoDate, field: EntryField) => {
    setLastWrite((previous) => ({ date, field, count: (previous?.count ?? 0) + 1 }));
  }, []);

  const value = useMemo<EntryDayValue>(
    () => ({ selected, select: setSelected, lastWrite, noteWrite }),
    [selected, lastWrite, noteWrite],
  );

  return <EntryDayContext.Provider value={value}>{children}</EntryDayContext.Provider>;
}

/**
 * Throws outside a provider rather than inventing a day. A control that quietly
 * picked its own would drift out of step with the others, which is the exact
 * bug this context exists to prevent.
 */
export function useEntryDay(): EntryDayValue {
  const value = useContext(EntryDayContext);
  if (!value) throw new Error("useEntryDay must be used inside an EntryDayProvider");
  return value;
}
