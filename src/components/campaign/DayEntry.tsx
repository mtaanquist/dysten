"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormatters, useTranslator } from "@/i18n/provider";
import { campaignType } from "@/lib/campaign-types";
import type { CampaignStatus } from "@/lib/campaign-status";
import { addDays, dayRange, mondayIndex, type IsoDate } from "@/lib/dates";
import { lastLoggableDay } from "@/lib/campaign-status";
import { useEntryDay } from "./EntryDay";
import { saveEntry } from "@/app/actions/entries";
import { useToast } from "@/components/ui/Toast";
import styles from "./DayEntry.module.css";

type EntryMap = Record<IsoDate, { value1: number; value2: number; editedByAdmin?: boolean }>;

interface DayEntryProps {
  campaignId: string;
  type: string;
  startDate: IsoDate;
  endDate: IsoDate;
  today: IsoDate;
  status: CampaignStatus;
  /** Separate from `editable`: an unstarted campaign is locked, but not over. */
  editable: boolean;
  entries: EntryMap;
  /** Whose entries these are; an admin correcting someone else passes their id. */
  ownerId?: string;
}

interface Week {
  key: string;
  /** Seven slots, Monday first; `null` where the week falls outside the campaign. */
  days: (IsoDate | null)[];
}

/** Tallest a day's bar is allowed to grow, in px. */
const BAR_MAX = 28;

/**
 * The phone counterpart to EntryCalendar: one day open for editing at a time,
 * with the month reduced to a swipeable week strip above it and a list of the
 * days you still owe below.
 *
 * The month grid was chosen on desktop so a forgotten day could be filled in
 * where it sits, without hunting. That constraint survives here in two forms —
 * the strip puts three weeks within a swipe, and the missing-days list turns
 * "I forgot Tuesday and Wednesday" into two taps with no navigating at all.
 *
 * Both this and EntryCalendar render on every request; a media query decides
 * which one is on screen. Choosing in JavaScript would mean either a hydration
 * mismatch or a flash of the wrong control.
 */
export function DayEntry({
  campaignId,
  type,
  startDate,
  endDate,
  today,
  status,
  editable,
  entries,
  ownerId,
}: DayEntryProps) {
  const t = useTranslator();
  const format = useFormatters();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  const { decimals, inputStep } = campaignType(type);

  const lastLoggable = lastLoggableDay({ startDate, endDate, closedEarlyAt: null, reopenedForCorrections: false }, today);

  // Shared with the month grid and the calculator — see ./EntryDay.
  const { selected, select: setSelected, lastWrite } = useEntryDay();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const weeks = useMemo<Week[]>(() => {
    const built: Week[] = [];
    let current: Week | null = null;
    for (const date of dayRange(startDate, endDate)) {
      const index = mondayIndex(date);
      if (!current || index === 0) {
        current = { key: date, days: Array(7).fill(null) };
        built.push(current);
      }
      current.days[index] = date;
    }
    return built;
  }, [startDate, endDate]);

  const weekIndexOf = (date: IsoDate) => Math.max(0, weeks.findIndex((week) => week.days.includes(date)));

  const [weekIndex, setWeekIndex] = useState(() => weekIndexOf(lastLoggable));
  const stripRef = useRef<HTMLDivElement>(null);

  /*
   * Forget a draft the calculator has just overwritten.
   *
   * A draft is what has been typed but not yet committed, and it shadows the
   * stored value so a half-typed number is not yanked away mid-edit. That is
   * wrong when the value was replaced from outside: the field would go on
   * showing text that is no longer what is saved.
   *
   * Adjusted during render rather than in an effect. React documents this as
   * the way to react to a changed input, and an effect would run a beat later,
   * after the stale text had already been painted.
   */
  const [seenWrite, setSeenWrite] = useState(0);
  if (lastWrite && lastWrite.count !== seenWrite) {
    setSeenWrite(lastWrite.count);
    const written = `${lastWrite.date}:${lastWrite.field}`;
    if (written in draft) {
      const remaining = { ...draft };
      delete remaining[written];
      setDraft(remaining);
    }
  }

  /**
   * Keeps the strip on the selected day's week.
   *
   * The strip is a scroll container, so a week has to be scrolled to rather
   * than rendered first — that is why this runs on mount at all. It also runs
   * whenever the selection moves, which now includes moves this control did not
   * make: the month grid shares the selection, and the calculator writes into
   * it. Swiping is left alone, because a swipe changes the week without
   * changing the selected day.
   *
   * Only the scroll position is set here. Moving it fires the strip's own
   * onScroll, which is what owns weekIndex — setting both would be two sources
   * for one fact, and a setState in an effect body besides.
   */
  useEffect(() => {
    const el = stripRef.current;
    if (el) el.scrollLeft = el.clientWidth * weekIndexOf(selected);
    // weekIndexOf reads `weeks`, which only changes when the campaign does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, weeks]);

  /** The biggest day this person has logged — what the strip's bars scale to. */
  const best = useMemo(() => {
    let top = 0;
    for (const entry of Object.values(entries)) top = Math.max(top, entry.value1 + entry.value2);
    return top;
  }, [entries]);

  const missing = useMemo(() => {
    // Today is not yet "missing"; a campaign that has ended has no such grace.
    const upTo = today > endDate ? endDate : addDays(today, -1);
    if (upTo < startDate) return [];
    return dayRange(startDate, upTo).filter((date) => !entries[date]);
  }, [startDate, endDate, today, entries]);

  function goTo(date: IsoDate) {
    if (date < startDate || date > lastLoggable) return;
    setSelected(date);
  }

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

  const selectedEntry = entries[selected];
  const selectedTotal = selectedEntry ? selectedEntry.value1 + selectedEntry.value2 : 0;
  const unit = t(`campaignTypes.${type}.unit` as never);

  const stateLabel = selected === today
    ? t("campaign.today")
    : selectedEntry
      ? t("campaign.legendLogged")
      : t("campaign.legendMissing");

  const stateClass = selected === today
    ? styles.stateToday
    : selectedEntry
      ? styles.stateLogged
      : styles.stateMissing;

  const currentWeek = weeks[weekIndex];
  const weekDays = currentWeek?.days.filter(Boolean) as IsoDate[] | undefined;

  return (
    <div className={styles.root}>
      <section className={styles.card}>
        <div className={styles.dayHead}>
          <button
            type="button"
            className={styles.step}
            aria-label={t("campaign.prevDay")}
            disabled={selected <= startDate}
            onClick={() => goTo(addDays(selected, -1))}
          >
            ←
          </button>

          <div className={styles.dayTitleWrap}>
            <div className={styles.dayTitle}>{format.dayLong(selected)}</div>
            <div className={styles.dayState}>
              <span className={stateClass}>{stateLabel}</span>
              {selectedEntry?.editedByAdmin ? (
                <span className={styles.adminMark}>
                  <span className={styles.adminDot} aria-hidden="true" />
                  {t("campaign.editedByAdmin")}
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className={styles.step}
            aria-label={t("campaign.nextDay")}
            disabled={selected >= lastLoggable}
            onClick={() => goTo(addDays(selected, 1))}
          >
            →
          </button>
        </div>

        <div className={styles.stripBlock}>
          <div className={styles.stripHead}>
            <span className={styles.weekLabel}>
              {t("campaign.week")} {weekIndex + 1}
              {weekDays?.length
                ? ` · ${format.dayMonth(weekDays[0])} – ${format.dayMonth(weekDays[weekDays.length - 1])}`
                : ""}
            </span>
            <span className={styles.dots} aria-hidden="true">
              {weeks.map((week, index) => (
                <span
                  key={week.key}
                  className={index === weekIndex ? styles.dotActive : styles.dot}
                />
              ))}
            </span>
          </div>

          <div
            ref={stripRef}
            className={styles.strip}
            onScroll={(event) => {
              const el = event.currentTarget;
              const index = Math.round(el.scrollLeft / el.clientWidth);
              if (index !== weekIndex && index >= 0 && index < weeks.length) setWeekIndex(index);
            }}
          >
            {weeks.map((week) => (
              <div key={week.key} className={styles.week}>
                {week.days.map((date, slot) => {
                  if (!date) return <span key={`${week.key}-${slot}`} className={styles.dayBlank} />;

                  const entry = entries[date];
                  const total = entry ? entry.value1 + entry.value2 : 0;
                  const isFuture = date > lastLoggable;
                  const isToday = date === today;
                  const isMissing = !entry && !isFuture && !isToday;

                  const numberClass = [
                    styles.dayNumber,
                    isFuture ? styles.dayNumberFuture : "",
                    isToday ? styles.dayNumberToday : "",
                    isMissing ? styles.dayNumberMissing : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={date}
                      type="button"
                      className={`${styles.day} ${date === selected ? styles.daySelected : ""}`}
                      disabled={isFuture}
                      title={format.dayLong(date)}
                      aria-label={format.dayLong(date)}
                      aria-pressed={date === selected}
                      onClick={() => goTo(date)}
                    >
                      {entry && best > 0 ? (
                        <span
                          className={styles.bar}
                          style={{ height: `${Math.max(4, Math.round((total / best) * BAR_MAX))}px` }}
                        />
                      ) : isMissing ? (
                        <span className={styles.barMissing} />
                      ) : (
                        <span className={styles.barNone} />
                      )}
                      <span className={numberClass}>{Number(date.slice(8, 10))}</span>
                      {entry?.editedByAdmin ? <span className={styles.dayAdminDot} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <p className={styles.stripHint}>{t("campaign.swipeHint")}</p>
        </div>

        {!editable ? (
          <p className={styles.locked}>
            {status === "upcoming"
              ? t("campaign.entriesNotStarted")
              : t("campaign.entriesLocked")}
          </p>
        ) : null}

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t(`campaignTypes.${type}.field1` as never)}</span>
            <input
              type="number"
              inputMode={decimals === 0 ? "numeric" : "decimal"}
              min={0}
              step={inputStep}
              placeholder="0"
              disabled={!editable || selected > lastLoggable}
              className={styles.inputPrimary}
              value={storedValue(selected, "value1")}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, [`${selected}:value1`]: event.target.value }))
              }
              onBlur={(event) => commit(selected, "value1", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <span className={styles.fieldHelp}>{t(`campaignTypes.${type}.field1Help` as never)}</span>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabelQuiet}>{t(`campaignTypes.${type}.field2` as never)}</span>
            <input
              type="number"
              inputMode={decimals === 0 ? "numeric" : "decimal"}
              min={0}
              step={inputStep}
              placeholder="0"
              disabled={!editable || selected > lastLoggable}
              className={styles.inputSecondary}
              value={storedValue(selected, "value2")}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, [`${selected}:value2`]: event.target.value }))
              }
              onBlur={(event) => commit(selected, "value2", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <span className={styles.fieldHelp}>{t(`campaignTypes.${type}.field2Help` as never)}</span>
          </label>
        </div>

        <div className={styles.dayFoot}>
          <span className={styles.saveNote}>{editable ? t("campaign.savedOnBlur") : ""}</span>
          <span className={styles.dayTotal}>
            <span className={styles.dayTotalNumber}>{format.value(type, selectedTotal)}</span>{" "}
            <span className={styles.dayTotalUnit}>{unit}</span>
          </span>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.missingHead}>
          <h3 className={styles.missingTitle}>{t("campaign.missingTitle")}</h3>
          <span className={missing.length ? styles.missingCountAlert : styles.missingCount}>
            {missing.length
              ? t("campaign.missingDays", { count: missing.length })
              : t("campaign.missingNone")}
          </span>
        </div>

        {missing.length ? (
          <>
            <ul className={styles.missingList}>
              {missing.map((date) => (
                <li key={date}>
                  <button
                    type="button"
                    className={`${styles.missingRow} ${date === selected ? styles.missingRowSelected : ""}`}
                    onClick={() => goTo(date)}
                  >
                    <span className={styles.missingDate}>
                      <span className={styles.missingDateMain}>{format.dayMonth(date)}</span>
                      <span className={styles.missingDow}>{format.weekdayLong(date)}</span>
                    </span>
                    {editable ? <span className={styles.missingCta}>{t("campaign.logIt")}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className={styles.allDone}>
            <span className={styles.allDoneTick} aria-hidden="true">
              ✓
            </span>
            {t("campaign.missingNone")}
          </div>
        )}
      </section>
    </div>
  );
}
