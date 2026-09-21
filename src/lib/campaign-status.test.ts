import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  awaitingWinner,
  campaignStatus,
  daysUntilStart,
  entriesEditable,
  isLoggableDay,
  lastLoggableDay,
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

/** September 2026, with no override set and no winner decided. */
function campaign(overrides: Partial<StatusInput> = {}): StatusInput {
  return {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    closedEarlyAt: null,
    reopenedForCorrections: false,
    drawnAt: null,
    ...overrides,
  };
}

/** The same campaign, with its winner settled on the 5th of October. */
function decided(overrides: Partial<StatusInput> = {}): StatusInput {
  return campaign({ drawnAt: new Date("2026-10-05T10:00:00Z"), ...overrides });
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

  it("is ended from its last day on, decided or not", () => {
    assert.equal(campaignStatus(decided(), "2026-10-01"), "ended");
  });
});

/* The window between the calendar running out and somebody settling the
   winner. Both ends matter: a campaign still running is not in it, and one
   whose winner is decided has left it for good. */
describe("awaitingWinner", () => {
  it("is false while the campaign is still running", () => {
    assert.equal(awaitingWinner(campaign(), "2026-09-30"), false);
  });

  it("opens the day after the end date", () => {
    assert.equal(awaitingWinner(campaign(), "2026-10-01"), true);
  });

  it("does not close on its own, however long nobody draws", () => {
    assert.equal(awaitingWinner(campaign(), "2027-03-01"), true);
  });

  it("closes when the winner is decided", () => {
    assert.equal(awaitingWinner(decided(), "2026-10-06"), false);
  });

  it("covers a campaign closed early, not just one that ran out of days", () => {
    const closed = campaign({ closedEarlyAt: new Date("2026-09-10T09:00:00Z") });
    assert.equal(awaitingWinner(closed, "2026-09-15"), true);
  });
});

describe("entriesEditable", () => {
  it("is false before the campaign starts", () => {
    assert.equal(entriesEditable(campaign(), "2026-08-31"), false);
  });

  it("is true while it runs", () => {
    assert.equal(entriesEditable(campaign(), "2026-09-15"), true);
  });

  /* The point of the window: the last weekend of a campaign is typed up after
     it has ended, and the prize it counts towards has not been handed out yet
     either. */
  it("stays true after the end date while the winner is still undecided", () => {
    assert.equal(entriesEditable(campaign(), "2026-10-01"), true);
  });

  it("is false once the winner has been decided", () => {
    assert.equal(entriesEditable(decided(), "2026-10-06"), false);
  });

  it("is false once a closed-early campaign has been decided", () => {
    const closed = decided({ closedEarlyAt: new Date("2026-09-10T09:00:00Z") });
    assert.equal(entriesEditable(closed, "2026-09-15"), false);
  });

  it("is true again when an admin reopens a decided campaign", () => {
    const reopened = decided({ reopenedForCorrections: true });
    assert.equal(entriesEditable(reopened, "2026-10-10"), true);
  });

  /* Locked before and locked after are the same boolean but not the same
     sentence, so the UI must ask status, not just editability. */
  it("locks upcoming and settled alike, leaving them distinguishable by status", () => {
    const before = "2026-08-31";
    const after = "2026-10-06";
    assert.equal(entriesEditable(campaign(), before), entriesEditable(decided(), after));
    assert.notEqual(campaignStatus(campaign(), before), campaignStatus(decided(), after));
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

describe("lastLoggableDay", () => {
  it("is today while the campaign is running", () => {
    assert.equal(lastLoggableDay(campaign(), "2026-09-15"), "2026-09-15");
  });

  it("is the end date once the campaign is over", () => {
    assert.equal(lastLoggableDay(campaign(), "2026-11-01"), "2026-09-30");
  });

  it("is the start date before it begins", () => {
    assert.equal(lastLoggableDay(campaign(), "2026-08-31"), "2026-09-01");
  });

  it("includes both ends of the range", () => {
    assert.equal(lastLoggableDay(campaign(), "2026-09-01"), "2026-09-01");
    assert.equal(lastLoggableDay(campaign(), "2026-09-30"), "2026-09-30");
  });

  /* It never lands on a day the campaign does not cover, which is what makes it
     safe as the default target for the calculator's copy button. */
  it("always names a day inside the campaign", () => {
    for (const day of ["2026-01-01", "2026-09-01", "2026-09-14", "2026-09-30", "2027-05-05"]) {
      const answer = lastLoggableDay(campaign(), day);
      assert.ok(answer >= "2026-09-01" && answer <= "2026-09-30", `${day} -> ${answer}`);
    }
  });
});

describe("isLoggableDay", () => {
  it("accepts a day inside the range after the campaign ended, until it is decided", () => {
    assert.equal(isLoggableDay(campaign(), "2026-09-30", "2026-10-03"), true);
  });

  it("refuses the same day once the winner has been decided", () => {
    assert.equal(isLoggableDay(decided(), "2026-09-30", "2026-10-06"), false);
  });

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
