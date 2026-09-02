"use client";

import { useMemo, useState } from "react";
import { useFormatters, useLocale, useTranslator } from "@/i18n/provider";
import {
  ACTIVITIES,
  INTENSITIES,
  findActivity,
  levelFor,
  parseMinutes,
  stepsFor,
  type Intensity,
} from "@/lib/activities";
import styles from "./StepCalculator.module.css";

/**
 * Works out what an hour in the pool is worth in steps.
 *
 * Deliberately read-only. It produces the number and stops there, leaving the
 * typing to the person — writing straight into the Calculated field would mean
 * deciding whether a second activity on the same day adds to the first or
 * replaces it, and quietly choosing wrong loses somebody's swim.
 */
export function StepCalculator({ type }: { type: string }) {
  const t = useTranslator();
  const format = useFormatters();
  const locale = useLocale();

  const [activityKey, setActivityKey] = useState(ACTIVITIES[0].key);
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [minutes, setMinutes] = useState("");

  // The file lists activities thematically; a dropdown wants them alphabetical,
  // and alphabetical differs by language — "Svømning" sorts nowhere near
  // "Swimming".
  const options = useMemo(() => {
    const labelled = ACTIVITIES.map((activity) => ({
      key: activity.key,
      label: t(`activities.${activity.key}` as never),
    }));
    return labelled.sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [t, locale]);

  const activity = findActivity(activityKey) ?? ACTIVITIES[0];
  // Intensity is a preference that survives changing activity, not a hard
  // selection: table tennis has one level and tennis has three, and switching
  // between them should not throw away what the person picked.
  const level = levelFor(activity, intensity);
  const available = INTENSITIES.filter((option) =>
    activity.levels.some((row) => row.intensity === option),
  );

  const parsed = parseMinutes(minutes);
  const steps = parsed === null ? 0 : stepsFor(parsed, level.met);

  return (
    <section className={styles.root}>
      <h3 className={styles.title}>{t("calculator.title")}</h3>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>{t("calculator.activity")}</span>
          <select
            className={styles.input}
            value={activity.key}
            onChange={(event) => setActivityKey(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("calculator.effort")}</span>
          <select
            className={styles.input}
            value={level.intensity}
            onChange={(event) => setIntensity(event.target.value as Intensity)}
            disabled={available.length < 2}
          >
            {available.map((option) => (
              <option key={option} value={option}>
                {t(`calculator.${option}` as never)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("calculator.minutes")}</span>
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={0}
            step={5}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
      </div>

      <div className={styles.result} aria-live="polite">
        <span className={styles.resultLabel}>{t("calculator.resultLabel")}</span>
        <span className={styles.resultValue}>
          {format.value(type, steps)} {t(`campaignTypes.${type}.unit` as never)}
        </span>
      </div>

      <p className={styles.source}>
        {t("calculator.source")}
        {level.code === null ? ` ${t("calculator.estimated")}` : null}
      </p>
    </section>
  );
}
