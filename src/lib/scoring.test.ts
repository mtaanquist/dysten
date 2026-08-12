import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assignRanks,
  bestSingleDay,
  combinedTotal,
  computeStandings,
  cumulativeSeries,
  currentStreak,
  gapToNextRank,
  goalProgress,
  longestStreak,
  missingDays,
  rankMovements,
  type EntryLike,
  type ParticipantLike,
  type Standing,
} from "./scoring";

/**
 * The competitive rules, tested without a database.
 *
 * These are the parts people will argue about — a shared rank on a tie, whether
 * a streak survives a morning before you have logged, what an average divides
 * by. Every function here is pure, so the arguments below are the whole world.
 */

const ROSTER: ParticipantLike[] = [
  { id: "u1", displayName: "Amalie Bech" },
  { id: "u2", displayName: "Jonas Krogh" },
  { id: "u3", displayName: "Mette Sørensen" },
];

/** Shorthand for a step-campaign entry: one day, one person, two values. */
function entry(userId: string, date: string, value1: number, value2 = 0): EntryLike {
  return { userId, date, value1, value2 };
}

/** A standing with only the fields ranking cares about. */
function standing(userId: string, displayName: string, total: number): Standing {
  return {
    userId,
    displayName,
    value1: total,
    value2: 0,
    total,
    daysLogged: 1,
    average: total,
    rank: 0,
    editedByAdmin: false,
  };
}

describe("assignRanks", () => {
  it("shares a rank on a tie and skips the next one", () => {
    const ranked = assignRanks([
      standing("u1", "Amalie Bech", 80),
      standing("u2", "Jonas Krogh", 100),
      standing("u3", "Mette Sørensen", 90),
      standing("u4", "Rasmus Dahl", 90),
    ]);

    assert.deepEqual(
      ranked.map((row) => [row.userId, row.rank]),
      [
        ["u2", 1],
        ["u3", 2],
        ["u4", 2],
        ["u1", 4],
      ],
    );
  });

  it("breaks ordering ties by name without changing the shared rank", () => {
    const ranked = assignRanks([
      standing("u2", "Zara Vind", 50),
      standing("u1", "Amalie Bech", 50),
    ]);

    assert.deepEqual(ranked.map((row) => row.displayName), ["Amalie Bech", "Zara Vind"]);
    assert.deepEqual(ranked.map((row) => row.rank), [1, 1]);
  });

  it("does not mutate the array it is given", () => {
    const rows = [standing("u1", "Amalie Bech", 10), standing("u2", "Jonas Krogh", 20)];
    assignRanks(rows);
    assert.deepEqual(rows.map((row) => row.userId), ["u1", "u2"]);
  });
});

describe("computeStandings", () => {
  const entries: EntryLike[] = [
    entry("u1", "2026-08-01", 10_000),
    entry("u1", "2026-08-02", 12_000),
    entry("u1", "2026-08-03", 30_000), // after the horizon in some tests
    entry("u2", "2026-08-01", 5_000, 4_000),
  ];

  it("keeps people who have logged nothing on the board", () => {
    const rows = computeStandings(ROSTER, entries, "2026-08-02", "step");
    const idle = rows.find((row) => row.userId === "u3");

    assert.ok(idle, "a participant with no entries must still appear");
    assert.equal(idle.total, 0);
    assert.equal(idle.daysLogged, 0);
    assert.equal(idle.average, 0, "no entries must not divide by zero");
  });

  it("excludes days after the horizon", () => {
    const rows = computeStandings(ROSTER, entries, "2026-08-02", "step");
    const mine = rows.find((row) => row.userId === "u1");

    assert.equal(mine?.total, 22_000, "the 2026-08-03 entry is beyond the horizon");
    assert.equal(mine?.daysLogged, 2);
  });

  it("averages over days logged, not days elapsed", () => {
    // u2 logged one day out of two elapsed. A late joiner competes on effort
    // per day, so the divisor is 1, not 2.
    const rows = computeStandings(ROSTER, entries, "2026-08-02", "step");
    const late = rows.find((row) => row.userId === "u2");

    assert.equal(late?.total, 9_000);
    assert.equal(late?.daysLogged, 1);
    assert.equal(late?.average, 9_000);
  });

  it("sums both value columns separately and together", () => {
    const rows = computeStandings(ROSTER, entries, "2026-08-02", "step");
    const late = rows.find((row) => row.userId === "u2");

    assert.equal(late?.value1, 5_000);
    assert.equal(late?.value2, 4_000);
  });

  it("rounds km totals to the type's precision", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in binary floating point; a km
    // leaderboard must not show that.
    const rows = computeStandings(
      [{ id: "u1", displayName: "Amalie Bech" }],
      [entry("u1", "2026-08-01", 0.1), entry("u1", "2026-08-02", 0.2)],
      "2026-08-02",
      "bike",
    );

    assert.equal(rows[0].total, 0.3);
  });

  it("flags the standing when any single entry was an admin correction", () => {
    const rows = computeStandings(
      ROSTER,
      [
        entry("u1", "2026-08-01", 10_000),
        { ...entry("u1", "2026-08-02", 12_000), editedByAdmin: true },
      ],
      "2026-08-02",
      "step",
    );

    assert.equal(rows.find((row) => row.userId === "u1")?.editedByAdmin, true);
    assert.equal(rows.find((row) => row.userId === "u2")?.editedByAdmin, false);
  });

  it("returns rows already ranked", () => {
    const rows = computeStandings(ROSTER, entries, "2026-08-02", "step");
    assert.deepEqual(rows.map((row) => row.rank), [1, 2, 3]);
  });
});

describe("currentStreak", () => {
  const entries = [
    entry("u1", "2026-08-08", 1),
    entry("u1", "2026-08-10", 1),
    entry("u1", "2026-08-11", 1),
    entry("u1", "2026-08-12", 1),
  ];

  it("counts consecutive days back from the horizon", () => {
    assert.equal(currentStreak(entries, "u1", "2026-08-12"), 3);
  });

  it("survives a horizon day that has not been logged yet", () => {
    // 09:00 on the 13th: today is blank, but the run through the 12th stands.
    assert.equal(currentStreak(entries, "u1", "2026-08-13"), 3);
  });

  it("breaks on two missed days in a row", () => {
    assert.equal(currentStreak(entries, "u1", "2026-08-14"), 0);
  });

  it("stops at the gap rather than counting earlier days", () => {
    // The 8th is logged but the 9th is not, so it must not join the run.
    assert.equal(currentStreak(entries, "u1", "2026-08-11"), 2);
  });

  it("is zero for someone who has logged nothing", () => {
    assert.equal(currentStreak(entries, "u2", "2026-08-12"), 0);
  });
});

describe("longestStreak", () => {
  it("finds the best run anywhere in the range", () => {
    const entries = [
      entry("u1", "2026-08-01", 1),
      entry("u1", "2026-08-02", 1),
      // gap
      entry("u1", "2026-08-05", 1),
      entry("u1", "2026-08-06", 1),
      entry("u1", "2026-08-07", 1),
      entry("u1", "2026-08-08", 1),
    ];

    assert.equal(longestStreak(entries, "u1", "2026-08-01", "2026-08-10"), 4);
  });

  it("ignores other people's entries", () => {
    const entries = [entry("u2", "2026-08-01", 1), entry("u2", "2026-08-02", 1)];
    assert.equal(longestStreak(entries, "u1", "2026-08-01", "2026-08-10"), 0);
  });
});

describe("missingDays", () => {
  it("lists elapsed days with no entry", () => {
    const entries = [entry("u1", "2026-08-01", 1), entry("u1", "2026-08-03", 1)];

    assert.deepEqual(missingDays(entries, "u1", "2026-08-01", "2026-08-04"), [
      "2026-08-02",
      "2026-08-04",
    ]);
  });

  it("is empty before the campaign has started", () => {
    assert.deepEqual(missingDays([], "u1", "2026-08-01", "2026-07-31"), []);
  });
});

describe("rankMovements", () => {
  const previous = assignRanks([
    standing("u1", "Amalie Bech", 100),
    standing("u2", "Jonas Krogh", 90),
    standing("u3", "Mette Sørensen", 80),
  ]);

  it("reports a climb, a fall and no change", () => {
    const current = assignRanks([
      standing("u3", "Mette Sørensen", 200), // 3rd -> 1st
      standing("u1", "Amalie Bech", 150), // 1st -> 2nd
      standing("u2", "Jonas Krogh", 90), // 2nd -> 3rd
    ]);

    const moves = rankMovements(current, previous);

    assert.deepEqual(moves.get("u3"), { delta: 2, direction: "up" });
    assert.deepEqual(moves.get("u1"), { delta: -1, direction: "down" });
    assert.deepEqual(moves.get("u2"), { delta: -1, direction: "down" });
  });

  it("treats a newcomer with no prior standing as unmoved", () => {
    const current = assignRanks([standing("u9", "Frederik Storm", 500)]);
    assert.deepEqual(rankMovements(current, previous).get("u9"), { delta: 0, direction: "none" });
  });
});

describe("gapToNextRank", () => {
  const standings = assignRanks([
    standing("u1", "Amalie Bech", 100),
    standing("u2", "Jonas Krogh", 90),
    standing("u3", "Mette Sørensen", 90),
    standing("u4", "Rasmus Dahl", 60),
  ]);

  it("is null for whoever is leading", () => {
    assert.equal(gapToNextRank(standings, "u1", "step"), null);
  });

  it("measures the distance to the nearest better rank", () => {
    assert.deepEqual(gapToNextRank(standings, "u2", "step"), { amount: 10, rank: 1 });
  });

  it("skips past a tie to the rank actually above", () => {
    // u4 is 4th; 2nd is shared by two people, so the nearest better rank is 2.
    assert.deepEqual(gapToNextRank(standings, "u4", "step"), { amount: 30, rank: 2 });
  });

  it("is null for someone not in the standings", () => {
    assert.equal(gapToNextRank(standings, "nobody", "step"), null);
  });
});

describe("bestSingleDay", () => {
  it("finds the highest combined day across everyone", () => {
    const entries = [
      entry("u1", "2026-08-01", 10_000, 2_000),
      entry("u2", "2026-08-02", 11_500),
      entry("u1", "2026-08-03", 9_000),
    ];

    assert.deepEqual(bestSingleDay(entries, ROSTER, "2026-08-03", "step"), {
      userId: "u1",
      displayName: "Amalie Bech",
      date: "2026-08-01",
      total: 12_000,
    });
  });

  it("ignores days beyond the horizon", () => {
    const entries = [entry("u1", "2026-08-01", 1_000), entry("u2", "2026-08-05", 50_000)];
    assert.equal(bestSingleDay(entries, ROSTER, "2026-08-01", "step")?.userId, "u1");
  });

  it("is null when nothing has been logged", () => {
    assert.equal(bestSingleDay([], ROSTER, "2026-08-01", "step"), null);
  });

  it("ignores zero-valued days", () => {
    assert.equal(bestSingleDay([entry("u1", "2026-08-01", 0)], ROSTER, "2026-08-01", "step"), null);
  });
});

describe("cumulativeSeries", () => {
  it("accumulates a running total across every day in the window", () => {
    const entries = [entry("u1", "2026-08-01", 100), entry("u1", "2026-08-03", 50)];
    const standings = computeStandings([ROSTER[0]], entries, "2026-08-03", "step");

    const [series] = cumulativeSeries(standings, entries, "2026-08-01", "2026-08-03", "step");

    assert.deepEqual(series.points, [
      { date: "2026-08-01", value: 100 },
      { date: "2026-08-02", value: 100 }, // a blank day holds the line
      { date: "2026-08-03", value: 150 },
    ]);
  });

  it("covers only the leading participants", () => {
    const entries = [
      entry("u1", "2026-08-01", 300),
      entry("u2", "2026-08-01", 200),
      entry("u3", "2026-08-01", 100),
    ];
    const standings = computeStandings(ROSTER, entries, "2026-08-01", "step");

    const series = cumulativeSeries(standings, entries, "2026-08-01", "2026-08-01", "step", 2);

    assert.deepEqual(series.map((line) => line.userId), ["u1", "u2"]);
  });

  it("is empty before the campaign has started", () => {
    assert.deepEqual(cumulativeSeries([], [], "2026-08-01", "2026-07-31", "step"), []);
  });
});

describe("combinedTotal and goalProgress", () => {
  it("sums the roster for the shared-goal bar", () => {
    const standings = [
      standing("u1", "Amalie Bech", 400_000),
      standing("u2", "Jonas Krogh", 350_000),
    ];
    assert.equal(combinedTotal(standings, "step"), 750_000);
  });

  it("returns a fraction of the goal", () => {
    assert.equal(goalProgress(600_000, 1_200_000), 0.5);
  });

  it("clamps past the goal rather than overflowing the bar", () => {
    assert.equal(goalProgress(1_500_000, 1_200_000), 1);
  });

  it("is null when the campaign has no goal", () => {
    assert.equal(goalProgress(500, null), null);
    assert.equal(goalProgress(500, undefined), null);
    assert.equal(goalProgress(500, 0), null);
  });
});
