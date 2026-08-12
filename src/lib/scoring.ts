import { campaignType, ranksByActiveDays, roundToType } from "./campaign-types";
import { addDays, dayRange, type IsoDate } from "./dates";

/**
 * Standings, streaks and highlights.
 *
 * Every function here is pure and takes its data as arguments — no database, no
 * request context. That keeps the competitive rules (which are the part users
 * will argue about) independently testable, and lets a single query feed the
 * leaderboard, the chart and the highlights panel without refetching.
 */

export interface EntryLike {
  userId: string;
  date: IsoDate;
  value1: number;
  value2: number;
  editedByAdmin?: boolean;
}

export interface ParticipantLike {
  id: string;
  displayName: string;
  email?: string;
}

export interface Standing {
  userId: string;
  displayName: string;
  value1: number;
  value2: number;
  total: number;
  /** Days with an entry — the divisor for a fair daily average. */
  daysLogged: number;
  /** Days with something actually logged on them; a zero day does not count. */
  activeDays: number;
  /**
   * The figure this campaign type ranks on — `total` or `activeDays`. Anything
   * that compares participants (the sort, the gap, the chart) reads this, so
   * the rules only have to be stated once, in the type registry.
   */
  score: number;
  /** Total ÷ days logged, so a late joiner compares on effort per day. */
  average: number;
  /** Shared on ties: 1, 2, 2, 4. */
  rank: number;
  /** True if any entry in the total was saved by someone else. */
  editedByAdmin: boolean;
}

/** Entries falling on or before `horizon`, bucketed by user. */
function entriesByUser(entries: EntryLike[], horizon: IsoDate): Map<string, EntryLike[]> {
  const buckets = new Map<string, EntryLike[]>();
  for (const entry of entries) {
    if (entry.date > horizon) continue;
    const bucket = buckets.get(entry.userId);
    if (bucket) bucket.push(entry);
    else buckets.set(entry.userId, [entry]);
  }
  return buckets;
}

/**
 * Standings for a roster as of `horizon`.
 *
 * Everyone on the roster appears, including people who have not logged
 * anything — the spec wants them visible in the participant list rather than
 * silently missing.
 */
export function computeStandings(
  roster: ParticipantLike[],
  entries: EntryLike[],
  horizon: IsoDate,
  typeKey: string,
): Standing[] {
  const buckets = entriesByUser(entries, horizon);

  const byActiveDays = ranksByActiveDays(typeKey);

  const rows = roster.map((participant) => {
    const own = buckets.get(participant.id) ?? [];
    let value1 = 0;
    let value2 = 0;
    let activeDays = 0;
    let editedByAdmin = false;

    for (const entry of own) {
      const dayTotal = (entry.value1 || 0) + (entry.value2 || 0);
      value1 += entry.value1 || 0;
      value2 += entry.value2 || 0;
      if (dayTotal > 0) activeDays += 1;
      if (entry.editedByAdmin) editedByAdmin = true;
    }

    // Round at aggregation: summing 0.1s in binary floating point otherwise
    // surfaces as 43.800000000000004 on a km leaderboard.
    value1 = roundToType(typeKey, value1);
    value2 = roundToType(typeKey, value2);
    const total = roundToType(typeKey, value1 + value2);
    const daysLogged = own.length;

    return {
      userId: participant.id,
      displayName: participant.displayName,
      value1,
      value2,
      total,
      daysLogged,
      activeDays,
      score: byActiveDays ? activeDays : total,
      average: daysLogged > 0 ? roundToType(typeKey, total / daysLogged) : 0,
      editedByAdmin,
      rank: 0,
    } satisfies Standing;
  });

  return assignRanks(rows);
}

/**
 * Sorts by score descending and assigns competition ranks, so tied
 * participants share a rank and the next one down skips accordingly.
 * Name is the tie-breaker for *ordering* only — it never changes the rank.
 *
 * Note that ties are left as ties rather than broken by distance. On a
 * bike campaign two people who both rode twenty days have done the same thing,
 * and separating them by kilometres would smuggle back the commute length the
 * ranking deliberately ignores.
 */
export function assignRanks(rows: Standing[]): Standing[] {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName),
  );

  let rank = 0;
  let previousScore: number | null = null;

  return sorted.map((row, index) => {
    if (previousScore === null || row.score !== previousScore) rank = index + 1;
    previousScore = row.score;
    return { ...row, rank };
  });
}

/**
 * Consecutive logged days counting back from `horizon`.
 *
 * If the horizon day itself has no entry the count starts from the day before,
 * so a streak isn't reported as broken at 09:00 simply because today hasn't
 * been logged yet. Two missed days in a row do break it.
 */
export function currentStreak(entries: EntryLike[], userId: string, horizon: IsoDate): number {
  const logged = new Set(
    entries.filter((entry) => entry.userId === userId && entry.date <= horizon).map((entry) => entry.date),
  );
  if (logged.size === 0) return 0;

  let cursor = logged.has(horizon) ? horizon : addDays(horizon, -1);
  let streak = 0;
  while (logged.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** The longest run of consecutive logged days anywhere in the range. */
export function longestStreak(
  entries: EntryLike[],
  userId: string,
  start: IsoDate,
  end: IsoDate,
): number {
  const logged = new Set(entries.filter((entry) => entry.userId === userId).map((entry) => entry.date));
  let best = 0;
  let run = 0;
  for (const day of dayRange(start, end)) {
    if (logged.has(day)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** Days in the elapsed window with no entry — drives the "N days missing" chip. */
export function missingDays(
  entries: EntryLike[],
  userId: string,
  start: IsoDate,
  horizon: IsoDate,
): IsoDate[] {
  if (horizon < start) return [];
  const logged = new Set(entries.filter((entry) => entry.userId === userId).map((entry) => entry.date));
  return dayRange(start, horizon).filter((day) => !logged.has(day));
}

export interface RankMovement {
  /** Positive = climbed, negative = fell, 0 = unchanged or no comparison. */
  delta: number;
  direction: "up" | "down" | "none";
}

/**
 * Rank change between two horizons — "since yesterday" on the leaderboard,
 * "this week" for the biggest-climber highlight.
 */
export function rankMovements(
  current: Standing[],
  previous: Standing[],
): Map<string, RankMovement> {
  const before = new Map(previous.map((row) => [row.userId, row.rank]));
  const movements = new Map<string, RankMovement>();

  for (const row of current) {
    const priorRank = before.get(row.userId);
    // Someone with no prior standing hasn't moved; they've just arrived.
    const delta = priorRank === undefined ? 0 : priorRank - row.rank;
    movements.set(row.userId, {
      delta,
      direction: delta > 0 ? "up" : delta < 0 ? "down" : "none",
    });
  }
  return movements;
}

/**
 * How far the user is from the rank immediately above them, if any.
 *
 * Measured in whatever the campaign ranks on, so a bike campaign says "3 days
 * behind #2" rather than quoting a kilometre gap that would not move anyone up.
 */
export function gapToNextRank(
  standings: Standing[],
  userId: string,
  typeKey: string,
): { amount: number; rank: number } | null {
  const mine = standings.find((row) => row.userId === userId);
  if (!mine || mine.rank === 1) return null;

  // The nearest *better* rank, which with ties may be several rows up.
  const above = standings.filter((row) => row.rank < mine.rank).pop();
  if (!above) return null;

  const difference = above.score - mine.score;
  const amount = ranksByActiveDays(typeKey) ? difference : roundToType(typeKey, difference);
  return { amount, rank: above.rank };
}

export interface BestDay {
  userId: string;
  displayName: string;
  date: IsoDate;
  total: number;
}

export function bestSingleDay(
  entries: EntryLike[],
  roster: ParticipantLike[],
  horizon: IsoDate,
  typeKey: string,
): BestDay | null {
  const names = new Map(roster.map((p) => [p.id, p.displayName]));
  let best: BestDay | null = null;

  for (const entry of entries) {
    if (entry.date > horizon) continue;
    const total = roundToType(typeKey, (entry.value1 || 0) + (entry.value2 || 0));
    if (total <= 0) continue;
    if (!best || total > best.total) {
      best = {
        userId: entry.userId,
        displayName: names.get(entry.userId) ?? "",
        date: entry.date,
        total,
      };
    }
  }
  return best;
}

export interface CumulativePoint {
  date: IsoDate;
  value: number;
}

export interface CumulativeSeries {
  userId: string;
  displayName: string;
  points: CumulativePoint[];
  total: number;
}

/**
 * Running totals per day for the leading participants — the progress chart.
 *
 * Plots whatever the campaign ranks on, so the lines and the leaderboard tell
 * the same story: cumulative steps for a step campaign, cumulative days out for
 * a bike one.
 */
export function cumulativeSeries(
  standings: Standing[],
  entries: EntryLike[],
  start: IsoDate,
  horizon: IsoDate,
  typeKey: string,
  limit = 5,
): CumulativeSeries[] {
  if (horizon < start) return [];
  const days = dayRange(start, horizon);
  const leaders = standings.slice(0, limit);
  const byActiveDays = ranksByActiveDays(typeKey);

  return leaders.map((leader) => {
    const own = new Map<IsoDate, number>();
    for (const entry of entries) {
      if (entry.userId !== leader.userId || entry.date > horizon) continue;
      const dayTotal = (entry.value1 || 0) + (entry.value2 || 0);
      const contribution = byActiveDays ? (dayTotal > 0 ? 1 : 0) : dayTotal;
      own.set(entry.date, (own.get(entry.date) ?? 0) + contribution);
    }

    let running = 0;
    const points = days.map((date) => {
      running += own.get(date) ?? 0;
      return { date, value: byActiveDays ? running : roundToType(typeKey, running) };
    });

    return { userId: leader.userId, displayName: leader.displayName, points, total: leader.score };
  });
}

/**
 * Combined total across the roster — the shared-goal progress bar.
 *
 * Always the raw amount, never the ranking score: "together we ride around
 * Denmark" is a distance the group covers, and stays one even on a campaign
 * whose winner is decided by days out.
 */
export function combinedTotal(standings: Standing[], typeKey: string): number {
  return roundToType(
    typeKey,
    standings.reduce((sum, row) => sum + row.total, 0),
  );
}

/** Fraction of a shared goal reached, clamped to [0, 1] for bar widths. */
export function goalProgress(combined: number, goal: number | null | undefined): number | null {
  if (!goal || goal <= 0) return null;
  return Math.min(1, Math.max(0, combined / goal));
}

/** Re-exported so callers formatting standings don't reach for two modules. */
export { campaignType };
