"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormatters, useLocale, useTranslator } from "@/i18n/provider";
import { weekdayHeaders } from "@/lib/format";
import { campaignType } from "@/lib/campaign-types";
import { dayRange, mondayIndex, monthKey, type IsoDate } from "@/lib/dates";
import { saveEntry } from "@/app/actions/entries";
import { useToast } from "@/components/ui/Toast";
import styles from "./EntryCalendar.module.css";

type EntryMap = Record<IsoDate, { value1: number; value2: number; editedByAdmin?: boolean }>;

interface EntryCalendarProps {
  campaignId: string;
  type: string;
  startDate: IsoDate;
  endDate: IsoDate;
  today: IsoDate;
  editable: boolean;
  entries: EntryMap;
  /** Whose entries these are; an admin correcting someone else passes their id. */
  ownerId?: string;
}

interface Cell {
  key: string;
  date: IsoDate | null;
  dayNumber: string;
  isToday: boolean;
  isFuture: boolean;
}

interface MonthBlock {
  key: string;
  anchor: IsoDate;
  cells: Cell[];
}

/**
 * The month-grid entry form.
 *
 * The design moved from one row per day to a calendar precisely so a forgotten
 * day — or three — can be filled in without hunting down a list. Every day in
 * the campaign range is editable while the campaign accepts entries; future
 * days are locked because you cannot have walked them yet.
 *
 * Values save on blur rather than on each keystroke: one request per finished
 * number, and no half-typed "1" landing in the database before "12,500".
 */
export function EntryCalendar({
  campaignId,
  type,
  startDate,
  endDate,
  today,
  editable,
  entries,
  ownerId,
}: EntryCalendarProps) {
  const t = useTranslator();
  const format = useFormatters();
  const locale = useLocale();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  // Local echo of what's on screen, so a saved value doesn't flicker back to
  // its old figure while the server round-trips.
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { decimals, inputStep } = campaignType(type);
  const headers = useMemo(() => weekdayHeaders(locale), [locale]);

  const months = useMemo<MonthBlock[]>(() => {
    const blocks: MonthBlock[] = [];
    for (const date of dayRange(startDate, endDate)) {
      const key = monthKey(date);
      let block = blocks.find((candidate) => candidate.key === key);
      if (!block) {
        block = { key, anchor: date, cells: [] };
        // Blank cells so the first day lands under the right weekday column.
        for (let i = 0; i < mondayIndex(date); i += 1) {
          block.cells.push({ key: `${key}-pad-${i}`, date: null, dayNumber: "", isToday: false, isFuture: false });
        }
        blocks.push(block);
      }
      block.cells.push({
        key: date,
        date,
        dayNumber: String(Number(date.slice(8, 10))),
        isToday: date === today,
        isFuture: date > today,
      });
    }
    // Pad the tail so every month is a whole number of rows.
    for (const block of blocks) {
      while (block.cells.length % 7 !== 0) {
        block.cells.push({
          key: `${block.key}-tail-${block.cells.length}`,
          date: null,
          dayNumber: "",
          isToday: false,
          isFuture: false,
        });
      }
    }
    return blocks;
  }, [startDate, endDate, today]);

  function storedValue(date: IsoDate, field: "value1" | "value2"): string {
    const key = `${date}:${field}`;
    if (key in draft) return draft[key];
    const entry = entries[date];
    if (!entry) return "";
    const value = entry[field];
    // A stored 0 is a real logged value and should stay visible.
    return value === 0 && entry.value1 === 0 && entry.value2 === 0 ? "0" : value === 0 ? "" : String(value);
  }

  function commit(date: IsoDate, field: "value1" | "value2", raw: string) {
    const entry = entries[date];
    const previous = entry ? String(entry[field] ?? "") : "";
    const normalised = raw.trim();
    // Nothing typed and nothing stored — no need to create an empty entry.
    if (normalised === "" && !entry) return;
    if (normalised === previous) return;

    startTransition(async () => {
      const result = await saveEntry({
        campaignId,
        userId: ownerId,
        date,
        [field]: normalised === "" ? "0" : normalised,
      });
      showToast(result.ok ? "toast.saved" : result.error);
    });
  }

  return (
    <div>
      <div className={styles.legend}>
        <LegendSwatch className={styles.swatchLogged} label={t("campaign.legendLogged")} />
        <LegendSwatch className={styles.swatchMissing} label={t("campaign.legendMissing")} />
        <LegendSwatch className={styles.swatchToday} label={t("campaign.today")} />
      </div>

      {!editable ? <p className={styles.locked}>{t("campaign.entriesLocked")}</p> : null}

      {months.map((month) => (
        <div key={month.key} className={styles.month}>
          <div className={styles.monthName}>{format.monthYear(month.anchor)}</div>

          {/* Below ~660px the grid scrolls rather than crushing the inputs. */}
          <div className={styles.scroller}>
            <div className={styles.grid}>
              {headers.map((header, index) => (
                <div key={`${month.key}-h-${index}`} className={styles.weekday}>
                  {header}
                </div>
              ))}

              {month.cells.map((cell) => {
                if (!cell.date) return <div key={cell.key} className={styles.cellSlot} />;

                const entry = entries[cell.date];
                const logged = Boolean(entry);
                const disabled = !editable || cell.isFuture;
                const dayTotal = entry ? format.value(type, entry.value1 + entry.value2) : "";

                const cellClass = [
                  styles.cell,
                  cell.isToday ? styles.cellToday : logged ? styles.cellLogged : styles.cellMissing,
                  cell.isFuture ? styles.cellFuture : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div key={cell.key} className={styles.cellSlot}>
                    <div className={cellClass}>
                      <div className={styles.cellHead}>
                        <span className={cell.isFuture ? styles.dayNumberFuture : styles.dayNumber}>
                          {cell.dayNumber}
                        </span>
                        <span className={styles.dayTotal}>{dayTotal}</span>
                        {entry?.editedByAdmin ? (
                          <span className={styles.adminMark} title={t("campaign.editedByAdmin")}>
                            ✻
                          </span>
                        ) : null}
                      </div>

                      <CellInput
                        date={cell.date}
                        field="value1"
                        value={storedValue(cell.date, "value1")}
                        placeholder={t(`campaignTypes.${type}.field1Short` as never)}
                        title={`${format.date(cell.date)} — ${t(`campaignTypes.${type}.field1` as never)}`}
                        step={inputStep}
                        decimals={decimals}
                        disabled={disabled}
                        onChange={(next) => setDraft((prev) => ({ ...prev, [`${cell.date}:value1`]: next }))}
                        onCommit={(next) => commit(cell.date!, "value1", next)}
                        primary
                      />
                      <CellInput
                        date={cell.date}
                        field="value2"
                        value={storedValue(cell.date, "value2")}
                        placeholder={t(`campaignTypes.${type}.field2Short` as never)}
                        title={`${format.date(cell.date)} — ${t(`campaignTypes.${type}.field2` as never)}`}
                        step={inputStep}
                        decimals={decimals}
                        disabled={disabled}
                        onChange={(next) => setDraft((prev) => ({ ...prev, [`${cell.date}:value2`]: next }))}
                        onCommit={(next) => commit(cell.date!, "value2", next)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CellInput({
  date,
  field,
  value,
  placeholder,
  title,
  step,
  decimals,
  disabled,
  onChange,
  onCommit,
  primary,
}: {
  date: IsoDate;
  field: string;
  value: string;
  placeholder: string;
  title: string;
  step: number;
  decimals: number;
  disabled: boolean;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  primary?: boolean;
}) {
  return (
    <input
      // `inputMode` gives phones the right keypad without the spinner
      // furniture that type=number brings on desktop.
      type="number"
      inputMode={decimals === 0 ? "numeric" : "decimal"}
      min={0}
      step={step}
      value={value}
      placeholder={placeholder}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={primary ? styles.inputPrimary : styles.inputSecondary}
      id={`entry-${date}-${field}`}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <div className={styles.legendItem}>
      <span className={`${styles.swatch} ${className}`} aria-hidden="true" />
      {label}
    </div>
  );
}
