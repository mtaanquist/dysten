"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatters, useTranslator } from "@/i18n/provider";
import { campaignType } from "@/lib/campaign-types";
import { dayRange, type IsoDate } from "@/lib/dates";
import type { PersonDetail } from "@/lib/queries";
import { deleteEntry, saveEntry } from "@/app/actions/entries";
import { Avatar } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import styles from "./PersonDrawer.module.css";

/**
 * One participant's day-by-day figures, in a right-hand drawer.
 *
 * Driven by a `person` query parameter rather than client state, so the view is
 * server-rendered, linkable and survives a refresh. Closing is a link back to
 * the page without the parameter.
 *
 * For an admin on a campaign that still accepts writes, the same table becomes
 * the correction surface: every day in the campaign range gets a row, not only
 * the days already logged, because the usual correction is a day someone never
 * logged at all. This is what "reopen for corrections" exists to unlock.
 */
export function PersonDrawer({
  detail,
  closeHref,
  canCorrect = false,
  today,
}: {
  detail: PersonDetail;
  closeHref: string;
  /** Admin viewing a campaign that accepts writes. */
  canCorrect?: boolean;
  today?: IsoDate;
}) {
  const t = useTranslator();
  const format = useFormatters();
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  // Local echo of what's on screen, so a saved value doesn't flicker back to
  // its old figure while the server round-trips.
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Escape closes the drawer, as a dialog should.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeHref, router]);

  const unit = t(`campaignTypes.${detail.campaignType}.unit` as never);
  const { decimals, inputStep } = campaignType(detail.campaignType);
  const editing = canCorrect && detail.editable;

  const byDate = useMemo(
    () => new Map(detail.rows.map((row) => [row.date, row])),
    [detail.rows],
  );

  // Read-only keeps the design's behaviour — only days that were logged. The
  // correction view needs every day in the range, blanks included.
  const dates = useMemo(
    () =>
      editing
        ? dayRange(detail.campaignStart, detail.campaignEnd)
        : detail.rows.map((row) => row.date),
    [editing, detail.campaignStart, detail.campaignEnd, detail.rows],
  );

  function fieldValue(date: IsoDate, field: "value1" | "value2"): string {
    const key = `${date}:${field}`;
    if (key in draft) return draft[key];
    const row = byDate.get(date);
    if (!row) return "";
    // A day logged as all zeroes is a real entry and should read "0".
    if (row.value1 === 0 && row.value2 === 0) return "0";
    return row[field] === 0 ? "" : String(row[field]);
  }

  function commit(date: IsoDate, field: "value1" | "value2", raw: string) {
    const row = byDate.get(date);
    const previous = row ? String(row[field] ?? "") : "";
    const normalised = raw.trim();
    if (normalised === "" && !row) return;
    if (normalised === previous) return;

    startTransition(async () => {
      const result = await saveEntry({
        campaignId: detail.campaignId,
        userId: detail.userId,
        date,
        [field]: normalised === "" ? "0" : normalised,
      });
      showToast(result.ok ? "toast.saved" : result.error);
    });
  }

  function remove(date: IsoDate) {
    startTransition(async () => {
      const result = await deleteEntry({
        campaignId: detail.campaignId,
        userId: detail.userId,
        date,
      });
      if (result.ok) {
        // Drop any local echo, or the deleted figures would linger on screen.
        setDraft((previous) => {
          const next = { ...previous };
          delete next[`${date}:value1`];
          delete next[`${date}:value2`];
          return next;
        });
      }
      showToast(result.ok ? "toast.entryDeleted" : result.error);
    });
  }

  return (
    <div className={styles.overlay}>
      <Link href={closeHref} scroll={false} className={styles.scrim} aria-label={t("common.close")} />

      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={detail.displayName}>
        <div className={styles.head}>
          <Avatar name={detail.displayName} size="lg" />
          <div className={styles.headText}>
            <div className={styles.name}>{detail.displayName}</div>
            <div className={styles.email}>{detail.email}</div>
          </div>
          <Link href={closeHref} scroll={false} className={styles.close} aria-label={t("common.close")}>
            ×
          </Link>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryLabel}>{detail.campaignName}</div>
          <div className={styles.summaryValue}>
            {format.value(detail.campaignType, detail.total)} {unit}
          </div>
        </div>

        <div className={styles.tableLabel}>
          {editing ? t("campaign.correctEntries") : t("campaign.dayByDay")}
        </div>
        {editing ? <p className={styles.hint}>{t("campaign.correctEntriesHint")}</p> : null}

        {dates.length === 0 ? (
          <p className={styles.empty}>{t("campaign.noEntries")}</p>
        ) : (
          <div className={styles.scroller}>
            <div className={`${styles.table} ${editing ? styles.tableEditing : ""}`}>
              <div className={`${styles.headRow} ${editing ? styles.rowEditing : ""}`}>
                <div>{t("campaign.dayByDay")}</div>
                <div className={styles.right}>
                  {t(`campaignTypes.${detail.campaignType}.field1` as never)}
                </div>
                <div className={styles.right}>
                  {t(`campaignTypes.${detail.campaignType}.field2` as never)}
                </div>
                <div className={styles.right}>{t("campaign.total")}</div>
                {editing ? <div /> : null}
              </div>

              {dates.map((date) => {
                const row = byDate.get(date);
                // A day nobody could have walked yet cannot be corrected either.
                const future = Boolean(today && date > today);

                return (
                  <div key={date} className={`${styles.row} ${editing ? styles.rowEditing : ""}`}>
                    <div>
                      <div className={styles.date}>{format.date(date)}</div>
                      <div className={styles.dow}>
                        {format.weekday(date)}
                        {row?.editedByAdmin ? (
                          <span className={styles.adminNote}> · {t("campaign.editedByAdmin")}</span>
                        ) : null}
                      </div>
                    </div>

                    {editing ? (
                      <>
                        <ValueInput
                          date={date}
                          field="value1"
                          value={fieldValue(date, "value1")}
                          label={`${format.date(date)} — ${t(`campaignTypes.${detail.campaignType}.field1` as never)}`}
                          step={inputStep}
                          decimals={decimals}
                          disabled={future}
                          onChange={(next) =>
                            setDraft((previous) => ({ ...previous, [`${date}:value1`]: next }))
                          }
                          onCommit={(next) => commit(date, "value1", next)}
                        />
                        <ValueInput
                          date={date}
                          field="value2"
                          value={fieldValue(date, "value2")}
                          label={`${format.date(date)} — ${t(`campaignTypes.${detail.campaignType}.field2` as never)}`}
                          step={inputStep}
                          decimals={decimals}
                          disabled={future}
                          onChange={(next) =>
                            setDraft((previous) => ({ ...previous, [`${date}:value2`]: next }))
                          }
                          onCommit={(next) => commit(date, "value2", next)}
                        />
                      </>
                    ) : (
                      <>
                        <div className={styles.right}>
                          {format.value(detail.campaignType, row?.value1 ?? 0)}
                        </div>
                        <div className={styles.right}>
                          {format.value(detail.campaignType, row?.value2 ?? 0)}
                        </div>
                      </>
                    )}

                    <div className={`${styles.right} ${styles.rowTotal}`}>
                      {row ? format.value(detail.campaignType, row.total) : "–"}
                    </div>

                    {editing ? (
                      <div className={styles.right}>
                        {row ? (
                          <button
                            type="button"
                            className={styles.delete}
                            title={t("campaign.deleteEntry")}
                            aria-label={`${t("campaign.deleteEntry")} — ${format.date(date)}`}
                            onClick={() => remove(date)}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function ValueInput({
  date,
  field,
  value,
  label,
  step,
  decimals,
  disabled,
  onChange,
  onCommit,
}: {
  date: IsoDate;
  field: string;
  value: string;
  label: string;
  step: number;
  decimals: number;
  disabled: boolean;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}) {
  return (
    <input
      type="number"
      inputMode={decimals === 0 ? "numeric" : "decimal"}
      min={0}
      step={step}
      value={value}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={styles.input}
      id={`correct-${date}-${field}`}
      onChange={(event) => onChange(event.target.value)}
      // Saving on blur means one request per finished number, matching the
      // entry calendar rather than firing on every keystroke.
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
