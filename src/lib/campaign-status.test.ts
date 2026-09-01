import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  campaignStatus,
  daysUntilStart,
  entriesEditable,
  isLoggableDay,
  scoringHorizon,
  type StatusInput,
} from "./campaign-status";

/**
 * Status is derived from the calendar, so the calendar is the whole input.
 *
 * The case worth guarding is the one that shipped broken: a campaign that has
 * not started is locked for entry, exactly like a finished one, but it is not
 * finished — anything that collapses those two states tells people a campaign
 * beginning tomorrow has ended.
 */

/** September 2026, with neither override set. */
function campaign(overrides: Partial<StatusInput> = {}): StatusInput {
  return {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    closedEarlyAt: null,
    reopenedForCorrections: false,
    ...overrides,
  };
}

describe("campaignStatus", () => {
  it("is upcoming the day before it starts", () => {
    assert.equal(campaignStatus(campaign(), "2026-08-31"), "upcoming");
  });

  it("turns active on the start date itself", () => {
    assert.equal(campaignStatus(campaign(), "2026-09-01"), "active");
  });

  it("is still active on the end date itself", () => {
    assert.equal(campaignStatus(campaign(), "2026-09-30"), "active");
  });

  it("ends the day after the end date", () => {
    assert.equal(campaignStatus(campaign(), "2026-10-01"), "ended");
  });

  it("is ended once closed early, mid-run", () => {
    const closed = campaign({ closedEarlyAt: new Date("2026-09-10T09:00:00Z") });
    assert.equal(campaignStatus(closed, "2026-09-15"), "ended");
  });

  it("reopening for corrections does not push it back onto the dashboard", () => {
    const reopened = campaign({ reopenedForCorrections: true });
    assert.equal(campaignStatus(reopened, "2026-10-05"), "ended");
  });
});

describe("entriesEditable", () => {
  it("is false before the campaign starts", () => {
    assert.equal(entriesEditable(campaign(), "2026-08-31"), false);
  });

  it("is true while it runs", () => {
    assert.equal(entriesEditable(campaign(), "2026-09-15"), true);
  });

  it("is false once it has ended", () => {
    assert.equal(entriesEditable(campaign(), "2026-10-01"), false);
  });

  it("is true again when an admin reopens it", () => {
    const reopened = campaign({ reopenedForCorrections: true });
    assert.equal(entriesEditable(reopened, "2026-10-01"), true);
  });

  /* Locked before and locked after are the same boolean but not the same
     sentence, so the UI must ask status, not just editability. */
  it("locks upcoming and ended alike, leaving them distinguishable by status", () => {
    const before = "2026-08-31";
    const after = "2026-10-01";
    assert.equal(entriesEditable(campaign(), before), entriesEditable(campaign(), after));
    assert.notEqual(campaignStatus(campaign(), before), campaignStatus(campaign(), after));
  });
});

describe("daysUntilStart", () => {
  it("counts a campaign starting tomorrow as one day out, not two", () => {
    assert.equal(daysUntilStart(campaign(), "2026-08-31"), 1);
  });

  it("is zero on the start date", () => {
    assert.equal(daysUntilStart(campaign(), "2026-09-01"), 0);
  });

  it("is zero once the campaign is under way", () => {
    assert.equal(daysUntilStart(campaign(), "2026-09-20"), 0);
  });

  it("counts across a month boundary", () => {
    assert.equal(daysUntilStart(campaign(), "2026-08-01"), 31);
  });
});

describe("scoringHorizon", () => {
  it("stops at today while the campaign runs", () => {
    assert.equal(scoringHorizon(campaign(), "2026-09-10"), "2026-09-10");
  });

  it("stops at the end date once finished", () => {
    assert.equal(scoringHorizon(campaign(), "2026-11-01"), "2026-09-30");
  });

  it("sits at the start date before it begins", () => {
    assert.equal(scoringHorizon(campaign(), "2026-08-31"), "2026-09-01");
  });
});

describe("isLoggableDay", () => {
  it("refuses a day before the campaign has started", () => {
    assert.equal(isLoggableDay(campaign(), "2026-09-01", "2026-08-31"), false);
  });

  it("refuses tomorrow", () => {
    assert.equal(isLoggableDay(campaign(), "2026-09-16", "2026-09-15"), false);
  });

  it("accepts today and a day already past", () => {
    assert.equal(isLoggableDay(campaign(), "2026-09-15", "2026-09-15"), true);
    assert.equal(isLoggableDay(campaign(), "2026-09-02", "2026-09-15"), true);
  });

  it("refuses a day outside the range entirely", () => {
    assert.equal(isLoggableDay(campaign(), "2026-08-30", "2026-09-15"), false);
  });
});
