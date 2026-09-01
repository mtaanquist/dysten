/**
 * Converting time spent on other activities into steps.
 *
 * A step campaign counts steps, but half the office swims, cycles or plays
 * handball, and none of that shows up on a pedometer. The Entry model has
 * always had a second column for it — "Calculated", converted from cycling,
 * sport etc. — and this is the table that makes filling it in something other
 * than guesswork.
 *
 * MET values are quoted from the 2024 Adult Compendium of Physical Activities
 * (https://pacompendium.com/adult-compendium/), each with the compendium's own
 * activity code so a number can be traced back to its row rather than taken on
 * faith.
 *
 * Two deliberate omissions:
 *
 * Walking, running, hiking and stair climbing are all in the compendium and
 * none of them are here. A pedometer already counts those, so converting them
 * would let the same effort be entered twice.
 *
 * Skiing is left out as well — the compendium has fifty-two winter entries, and
 * a Danish workplace will use approximately none of them.
 */

/**
 * MET-minutes that amount to one step.
 *
 * Fixes `steps = minutes × MET ÷ 0.065`. It ignores body weight, which a
 * stricter energy calculation would not; for a workplace campaign that trades
 * a little accuracy for a formula everyone can check on a napkin.
 */
export const MET_MINUTES_PER_STEP = 0.065;

export type Intensity = "light" | "moderate" | "vigorous";

/** Intensities in the order they are offered, easiest first. */
export const INTENSITIES: Intensity[] = ["light", "moderate", "vigorous"];

export interface ActivityLevel {
  intensity: Intensity;
  /**
   * The 2024 Adult Compendium activity code this MET value is quoted from, or
   * null where the compendium has no row for the activity and the figure comes
   * from elsewhere. Null is a marker, not a shrug: it says "do not go looking
   * for this in the PDF".
   */
  code: string | null;
  met: number;
}

export interface Activity {
  /** Stable id, and the i18n lookup at `activities.<key>`. */
  key: string;
  /**
   * At least one level, ordered as INTENSITIES is. Not every activity has all
   * three: the compendium has one row for table tennis and eight for tennis.
   */
  levels: ActivityLevel[];
}

function level(intensity: Intensity, code: string | null, met: number): ActivityLevel {
  return { intensity, code, met };
}

/**
 * The activities on offer, chosen for a Danish workplace rather than for
 * coverage — the compendium lists 1,109 and a dropdown of that length helps
 * nobody. Every entry here is translated in full; adding one is a row below
 * plus an `activities.<key>` string in each language file.
 */
export const ACTIVITIES: Activity[] = [
  { key: "cycling", levels: [level("light", "01015", 4.3), level("moderate", "01011", 6.8), level("vigorous", "01040", 10.0)] },
  { key: "exerciseBike", levels: [level("light", "01216", 5.0), level("moderate", "01200", 6.8), level("vigorous", "01305", 8.8)] },
  { key: "swimming", levels: [level("light", "18255", 4.8), level("moderate", "18240", 5.8), level("vigorous", "18230", 9.8)] },
  { key: "football", levels: [level("light", "15615", 3.5), level("moderate", "15610", 7.0), level("vigorous", "15605", 9.5)] },
  { key: "handball", levels: [level("moderate", "15330", 8.0), level("vigorous", "15320", 12.0)] },
  { key: "badminton", levels: [level("light", "15030", 5.5), level("moderate", "15020", 7.0), level("vigorous", "15025", 9.0)] },
  { key: "tennis", levels: [level("light", "15685", 4.5), level("moderate", "15675", 6.8), level("vigorous", "15676", 8.0)] },
  // Padel has no row of its own in the 2024 compendium, and the nearest things
  // it does list overstate the sport: racquetball is 7.0 to 10.0, but that is a
  // singles game on a bigger court. Padel is played mostly as doubles, on a
  // short court, with rallies that stop at the glass — nearer tennis doubles,
  // which the compendium puts at 4.5. Reported figures cluster between 4 and 7
  // by intensity, so that is the span used, with no code to cite because there
  // is honestly no row behind it.
  { key: "padel", levels: [level("light", null, 4.0), level("moderate", null, 5.5), level("vigorous", null, 7.0)] },
  { key: "squash", levels: [level("moderate", "15652", 7.3), level("vigorous", "15650", 12.0)] },
  { key: "tableTennis", levels: [level("moderate", "15660", 4.0)] },
  { key: "basketball", levels: [level("light", "15070", 5.0), level("moderate", "15055", 7.5), level("vigorous", "15040", 8.0)] },
  { key: "volleyball", levels: [level("light", "15720", 3.0), level("moderate", "15710", 4.0), level("vigorous", "15711", 6.0)] },
  { key: "floorball", levels: [level("vigorous", "15205", 10.5)] },
  { key: "strengthTraining", levels: [level("light", "02054", 3.5), level("moderate", "02052", 5.0), level("vigorous", "02032", 6.0)] },
  { key: "rowingMachine", levels: [level("moderate", "02071", 5.0), level("vigorous", "02070", 7.3)] },
  { key: "crossTrainer", levels: [level("moderate", "02048", 5.0), level("vigorous", "02049", 9.0)] },
  { key: "hiit", levels: [level("moderate", "02210", 7.0), level("vigorous", "02214", 11.0)] },
  { key: "yoga", levels: [level("light", "02150", 2.3), level("moderate", "02155", 3.0), level("vigorous", "02160", 4.0)] },
  { key: "pilates", levels: [level("light", "02103", 1.8), level("moderate", "02105", 2.8)] },
  { key: "aerobics", levels: [level("moderate", "02005", 4.8), level("vigorous", "02006", 8.0)] },
  { key: "zumba", levels: [level("moderate", "02310", 6.5)] },
  { key: "dancing", levels: [level("moderate", "03025", 4.5)] },
  { key: "climbing", levels: [level("moderate", "15533", 8.0), level("vigorous", "15534", 8.8)] },
  { key: "kayaking", levels: [level("light", "18040", 2.8), level("moderate", "18100", 5.0), level("vigorous", "18060", 12.5)] },
  { key: "horseRiding", levels: [level("light", "15400", 3.8), level("moderate", "15370", 5.5), level("vigorous", "15395", 7.3)] },
  { key: "martialArts", levels: [level("light", "15425", 5.3), level("vigorous", "15430", 10.3)] },
  { key: "boxing", levels: [level("light", "15110", 5.8), level("moderate", "15120", 7.8), level("vigorous", "15100", 12.3)] },
  { key: "golf", levels: [level("light", "15290", 3.5), level("moderate", "15255", 4.5)] },
  { key: "waterAerobics", levels: [level("light", "18356", 3.8), level("moderate", "18355", 5.5), level("vigorous", "18358", 7.5)] },
  { key: "rollerSkating", levels: [level("moderate", "15590", 7.0), level("vigorous", "15592", 9.8)] },
];

export function findActivity(key: string): Activity | null {
  return ACTIVITIES.find((activity) => activity.key === key) ?? null;
}

/**
 * The level to show when an activity is picked, or when the previous choice of
 * intensity does not exist on the new one — moderate where there is one, since
 * that is what most people mean by "I played badminton", and otherwise the
 * gentlest on offer rather than the hardest.
 */
export function defaultLevel(activity: Activity): ActivityLevel {
  return activity.levels.find((row) => row.intensity === "moderate") ?? activity.levels[0];
}

/** The named intensity if this activity has one, else its default level. */
export function levelFor(activity: Activity, intensity: Intensity): ActivityLevel {
  return activity.levels.find((row) => row.intensity === intensity) ?? defaultLevel(activity);
}

/**
 * Steps equivalent to `minutes` at `met`.
 *
 * Zero for anything that is not a positive, finite pair of numbers — an empty
 * minutes box should read as nothing yet, never as NaN on the screen.
 */
export function stepsFor(minutes: number, met: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  if (!Number.isFinite(met) || met <= 0) return 0;
  return Math.round((minutes * met) / MET_MINUTES_PER_STEP);
}

/**
 * Reads the minutes box. Accepts a decimal comma, as the entry fields do, so
 * a Danish user typing "12,5" gets twelve and a half minutes rather than zero.
 */
export function parseMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
