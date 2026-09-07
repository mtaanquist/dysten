import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACTIVITIES,
  INTENSITIES,
  MET_MINUTES_PER_STEP,
  defaultLevel,
  findActivity,
  levelFor,
  parseMinutes,
  stepsFor,
} from "./activities";

/**
 * The conversion and the table behind it.
 *
 * The arithmetic is one line, so most of what is worth testing is the data:
 * that the table stays internally consistent, that nothing sneaks in which a
 * pedometer already counts, and that intensities do not run backwards.
 */

describe("stepsFor", () => {
  it("applies steps = minutes × MET ÷ 0.065", () => {
    assert.equal(MET_MINUTES_PER_STEP, 0.065);
    assert.equal(stepsFor(60, 6.5), 6000);
    assert.equal(stepsFor(30, 7.0), Math.round((30 * 7.0) / 0.065));
  });

  it("matches the worked examples from the issue", () => {
    assert.equal(stepsFor(60, 9.3), 8585); // running, cross country
    assert.equal(stepsFor(30, 5.8), 2677); // swimming, freestyle, slow
    assert.equal(stepsFor(45, 6.8), 4708); // bicycling to work
  });

  it("rounds rather than truncates", () => {
    // 10 × 2.3 ÷ 0.065 = 353.84…
    assert.equal(stepsFor(10, 2.3), 354);
  });

  /* Linear up to the rounding: doubling a rounded result is not the same as
     rounding a doubled one (2308 × 2 = 4616, but 60 × 5 ÷ 0.065 rounds to
     4615), so this allows the one step of slack that rounding can introduce. */
  it("scales linearly in both arguments, to within the rounding", () => {
    assert.ok(Math.abs(stepsFor(60, 5) - stepsFor(30, 5) * 2) <= 1);
    assert.ok(Math.abs(stepsFor(30, 10) - stepsFor(30, 5) * 2) <= 1);
    assert.equal(stepsFor(60, 5), Math.round((60 * 5) / 0.065));
    assert.equal(stepsFor(30, 10), Math.round((30 * 10) / 0.065));
  });

  it("is zero for anything that is not a positive pair of numbers", () => {
    assert.equal(stepsFor(0, 7), 0);
    assert.equal(stepsFor(-30, 7), 0);
    assert.equal(stepsFor(30, 0), 0);
    assert.equal(stepsFor(30, -7), 0);
    assert.equal(stepsFor(Number.NaN, 7), 0);
    assert.equal(stepsFor(Number.POSITIVE_INFINITY, 7), 0);
  });
});

describe("parseMinutes", () => {
  it("reads a plain number", () => {
    assert.equal(parseMinutes("45"), 45);
    assert.equal(parseMinutes("  45  "), 45);
  });

  it("accepts a decimal comma, as the entry fields do", () => {
    assert.equal(parseMinutes("12,5"), 12.5);
    assert.equal(parseMinutes("12.5"), 12.5);
  });

  it("is null for empty, zero, negative and junk", () => {
    assert.equal(parseMinutes(""), null);
    assert.equal(parseMinutes("   "), null);
    assert.equal(parseMinutes("0"), null);
    assert.equal(parseMinutes("-10"), null);
    assert.equal(parseMinutes("half an hour"), null);
  });
});

describe("the activity table", () => {
  it("has a unique key for every activity", () => {
    const keys = ACTIVITIES.map((activity) => activity.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("gives every activity at least one level", () => {
    for (const activity of ACTIVITIES) {
      assert.ok(activity.levels.length >= 1, `${activity.key} has no levels`);
    }
  });

  it("lists levels in intensity order, with no duplicates", () => {
    for (const activity of ACTIVITIES) {
      const order = activity.levels.map((level) => INTENSITIES.indexOf(level.intensity));
      assert.deepEqual(order, [...order].sort((a, b) => a - b), `${activity.key} is out of order`);
      assert.equal(new Set(order).size, order.length, `${activity.key} repeats an intensity`);
    }
  });

  /* A harder effort earning fewer steps than an easier one would be visible
     nonsense the moment somebody switched the dropdown. */
  it("never lets a harder level be worth less than an easier one", () => {
    for (const activity of ACTIVITIES) {
      const mets = activity.levels.map((level) => level.met);
      assert.deepEqual(mets, [...mets].sort((a, b) => a - b), `${activity.key} has METs out of order`);
    }
  });

  it("keeps every MET inside the range the compendium actually spans", () => {
    for (const activity of ACTIVITIES) {
      for (const level of activity.levels) {
        assert.ok(level.met > 0 && level.met <= 23, `${activity.key} ${level.intensity} = ${level.met}`);
      }
    }
  });

  it("quotes a five-digit compendium code, or explicitly none", () => {
    for (const activity of ACTIVITIES) {
      for (const level of activity.levels) {
        if (level.code === null) continue;
        assert.match(level.code, /^\d{5}$/, `${activity.key} ${level.intensity}`);
      }
    }
  });

  /* Padel is the one activity with no row in the compendium. If a second ever
     appears, that is a decision worth making on purpose rather than by drift. */
  it("has exactly one activity standing outside the compendium", () => {
    const uncited = ACTIVITIES.filter((activity) =>
      activity.levels.some((level) => level.code === null),
    );
    assert.deepEqual(
      uncited.map((activity) => activity.key),
      ["padel"],
    );
  });

  /* The whole point of the second column is effort a pedometer cannot see.
     Offering walking would let one walk be counted twice. */
  it("offers nothing a step counter already counts", () => {
    const counted = ["walk", "run", "hike", "stair", "jog"];
    for (const activity of ACTIVITIES) {
      for (const word of counted) {
        assert.ok(
          !activity.key.toLowerCase().includes(word),
          `${activity.key} is already counted by a pedometer`,
        );
      }
    }
  });
});

describe("choosing a level", () => {
  it("defaults to moderate where there is one", () => {
    const tennis = findActivity("tennis");
    assert.ok(tennis);
    assert.equal(defaultLevel(tennis).intensity, "moderate");
  });

  it("falls back to the gentlest level, not the hardest", () => {
    const floorball = findActivity("floorball");
    assert.ok(floorball);
    assert.equal(floorball.levels.length, 1);
    assert.equal(defaultLevel(floorball), floorball.levels[0]);
  });

  it("keeps the chosen intensity when the activity has it", () => {
    const tennis = findActivity("tennis");
    assert.ok(tennis);
    assert.equal(levelFor(tennis, "vigorous").met, 8.0);
  });

  it("falls back rather than breaking when the activity lacks that intensity", () => {
    const tableTennis = findActivity("tableTennis");
    assert.ok(tableTennis);
    // Switching from vigorous tennis to table tennis must still produce a level.
    assert.equal(levelFor(tableTennis, "vigorous").intensity, "moderate");
  });

  it("returns null for an unknown key", () => {
    assert.equal(findActivity("quidditch"), null);
  });
});
