import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { coversDate, datesOutsideRange, narrowsRange, withinRange } from "./campaign-range";
import type { IsoDate } from "./dates";

/**
 * A campaign's range can be edited after people have logged against it, so the
 * data can hold entries the campaign no longer covers. These are the two rules
 * that follow: what still counts, and what an edit is about to destroy.
 */

const september: { startDate: IsoDate; endDate: IsoDate } = {
  startDate: "2026-09-10",
  endDate: "2026-09-20",
};

function entry(date: IsoDate) {
  return { userId: "u1", date, value1: 1000, value2: 0 };
}

describe("coversDate", () => {
  it("includes both ends of the range", () => {
    assert.equal(coversDate(september, "2026-09-10"), true);
    assert.equal(coversDate(september, "2026-09-20"), true);
  });

  it("excludes the days either side", () => {
    assert.equal(coversDate(september, "2026-09-09"), false);
    assert.equal(coversDate(september, "2026-09-21"), false);
  });

  /* A single-day campaign is a legitimate range, not an empty one. */
  it("covers the one day of a single-day campaign", () => {
    const oneDay = { startDate: "2026-09-10" as IsoDate, endDate: "2026-09-10" as IsoDate };
    assert.equal(coversDate(oneDay, "2026-09-10"), true);
    assert.equal(coversDate(oneDay, "2026-09-11"), false);
  });
});

describe("withinRange", () => {
  /* The bug this exists for: a campaign shortened at both ends, with entries
     left behind on the days that were cut away. */
  it("drops entries either side of the range", () => {
    const entries = [
      entry("2026-09-01"),
      entry("2026-09-10"),
      entry("2026-09-15"),
      entry("2026-09-20"),
      entry("2026-09-28"),
    ];
    assert.deepEqual(
      withinRange(entries, september).map((row) => row.date),
      ["2026-09-10", "2026-09-15", "2026-09-20"],
    );
  });

  it("keeps everything when nothing is outside", () => {
    const entries = [entry("2026-09-11"), entry("2026-09-12")];
    assert.deepEqual(withinRange(entries, september), entries);
  });

  it("preserves order", () => {
    const entries = [entry("2026-09-15"), entry("2026-09-01"), entry("2026-09-11")];
    assert.deepEqual(
      withinRange(entries, september).map((row) => row.date),
      ["2026-09-15", "2026-09-11"],
    );
  });

  it("does not modify the array it was given", () => {
    const entries = [entry("2026-09-01"), entry("2026-09-15")];
    withinRange(entries, september);
    assert.equal(entries.length, 2);
  });
});

describe("narrowsRange", () => {
  const original = { startDate: "2026-09-01" as IsoDate, endDate: "2026-09-30" as IsoDate };

  it("is true when the start moves later", () => {
    assert.equal(narrowsRange(original, { startDate: "2026-09-10", endDate: "2026-09-30" }), true);
  });

  it("is true when the end moves earlier", () => {
    assert.equal(narrowsRange(original, { startDate: "2026-09-01", endDate: "2026-09-20" }), true);
  });

  it("is true when both ends come in", () => {
    assert.equal(narrowsRange(original, september), true);
  });

  it("is false when the range only grows", () => {
    assert.equal(narrowsRange(original, { startDate: "2026-08-25", endDate: "2026-10-05" }), false);
  });

  it("is false when the dates are unchanged, so renaming never prompts", () => {
    assert.equal(narrowsRange(original, { ...original }), false);
  });

  /* Shifting a campaign a week later narrows it at the start even though it is
     the same length, and the first week's entries really are being cut. */
  it("is true when the range slides rather than shrinks", () => {
    assert.equal(narrowsRange(original, { startDate: "2026-09-08", endDate: "2026-10-07" }), true);
  });
});

describe("datesOutsideRange", () => {
  it("returns exactly the dates the range does not cover", () => {
    assert.deepEqual(
      datesOutsideRange(["2026-09-01", "2026-09-10", "2026-09-20", "2026-09-28"], september),
      ["2026-09-01", "2026-09-28"],
    );
  });

  it("returns nothing when the range covers them all", () => {
    assert.deepEqual(datesOutsideRange(["2026-09-11", "2026-09-12"], september), []);
  });

  it("handles an empty list", () => {
    assert.deepEqual(datesOutsideRange([], september), []);
  });
});
