import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseTicketSnapshot,
  poolSize,
  ticketHolders,
  ticketsFor,
  winnerAt,
  type TicketHolder,
} from "./raffle";
import type { Standing } from "./scoring";

/**
 * The draw's rules, tested without a database or a random number.
 *
 * The draw itself is one call to randomInt in the server action; everything
 * that decides *who can win and how often* is here, which is the part people
 * will want to argue about after somebody else takes the prize.
 */

const PER = 10_000;

/** A standing with only the fields the raffle reads. */
function standing(userId: string, total: number, activeDays: number): Standing {
  return {
    userId,
    displayName: userId,
    value1: total,
    value2: 0,
    total,
    daysLogged: activeDays,
    activeDays,
    score: total,
    average: activeDays > 0 ? total / activeDays : 0,
    rank: 0,
    editedByAdmin: false,
  };
}

describe("ticketsFor", () => {
  it("gives one ticket to anyone who logged, however little", () => {
    assert.equal(ticketsFor(1, PER, true), 1);
    assert.equal(ticketsFor(8_000, PER, true), 1);
    assert.equal(ticketsFor(9_999, PER, true), 1);
  });

  it("gives none to someone who logged nothing at all", () => {
    assert.equal(ticketsFor(0, PER, false), 0);
  });

  /* A day logged as zero is not a day logged — the same rule activeDays uses,
     so filling a month with noughts cannot buy a place in the draw. */
  it("gives none for a month of zeroes", () => {
    assert.equal(ticketsFor(0, PER, false), 0);
  });

  it("adds a ticket per whole unit", () => {
    assert.equal(ticketsFor(10_000, PER, true), 1);
    assert.equal(ticketsFor(19_999, PER, true), 1);
    assert.equal(ticketsFor(20_000, PER, true), 2);
    assert.equal(ticketsFor(40_000, PER, true), 4);
  });

  it("is inert when the type does not raffle", () => {
    assert.equal(ticketsFor(50_000, 0, true), 0);
  });
});

describe("ticketHolders", () => {
  const standings = [
    standing("walker", 45_000, 20),
    standing("steady", 12_000, 25),
    standing("light", 3_000, 4),
    standing("absent", 0, 0),
  ];

  it("counts everyone who logged and nobody who did not", () => {
    assert.deepEqual(ticketHolders(standings, PER), [
      { userId: "walker", tickets: 4 },
      { userId: "steady", tickets: 1 },
      { userId: "light", tickets: 1 },
      { userId: "absent", tickets: 0 },
    ]);
  });

  it("keeps standings order, which is what makes a stored index meaningful", () => {
    const holders = ticketHolders(standings, PER);
    assert.deepEqual(
      holders.map((holder) => holder.userId),
      standings.map((row) => row.userId),
    );
  });

  it("sums to the pool size", () => {
    assert.equal(poolSize(ticketHolders(standings, PER)), 6);
  });
});

describe("winnerAt", () => {
  const holders: TicketHolder[] = [
    { userId: "walker", tickets: 4 },
    { userId: "steady", tickets: 1 },
    { userId: "light", tickets: 1 },
    { userId: "absent", tickets: 0 },
  ];

  it("walks the pool in order", () => {
    assert.equal(winnerAt(holders, 0), "walker");
    assert.equal(winnerAt(holders, 3), "walker");
    assert.equal(winnerAt(holders, 4), "steady");
    assert.equal(winnerAt(holders, 5), "light");
  });

  it("never lands on someone holding no tickets", () => {
    const drawn = new Set(
      Array.from({ length: poolSize(holders) }, (_, index) => winnerAt(holders, index)),
    );
    assert.equal(drawn.has("absent"), false);
  });

  it("gives four of six tickets to the heaviest walker", () => {
    const wins = Array.from({ length: poolSize(holders) }, (_, index) =>
      winnerAt(holders, index),
    ).filter((userId) => userId === "walker");
    assert.equal(wins.length, 4);
  });

  it("is null past the end of the pool, and for a pool with nobody in it", () => {
    assert.equal(winnerAt(holders, 6), null);
    assert.equal(winnerAt(holders, 99), null);
    assert.equal(winnerAt([{ userId: "absent", tickets: 0 }], 0), null);
    assert.equal(winnerAt([], 0), null);
  });

  it("refuses an index that is not a whole non-negative number", () => {
    assert.equal(winnerAt(holders, -1), null);
    assert.equal(winnerAt(holders, 1.5), null);
    assert.equal(winnerAt(holders, Number.NaN), null);
  });

  /* The stored index is the whole audit trail: the same snapshot and index must
     always name the same winner, or a finished draw cannot be checked. */
  it("is reproducible from a snapshot and an index", () => {
    const snapshot = JSON.stringify(holders);
    assert.equal(winnerAt(parseTicketSnapshot(snapshot), 4), "steady");
    assert.equal(winnerAt(parseTicketSnapshot(snapshot), 4), "steady");
  });
});

describe("parseTicketSnapshot", () => {
  it("round-trips what the draw stored", () => {
    const holders: TicketHolder[] = [{ userId: "a", tickets: 2 }];
    assert.deepEqual(parseTicketSnapshot(JSON.stringify(holders)), holders);
  });

  it("treats an absent or unreadable snapshot as an empty pool", () => {
    assert.deepEqual(parseTicketSnapshot(null), []);
    assert.deepEqual(parseTicketSnapshot(""), []);
    assert.deepEqual(parseTicketSnapshot("not json"), []);
    assert.deepEqual(parseTicketSnapshot('{"userId":"a"}'), []);
  });

  it("drops rows that are not ticket holders", () => {
    assert.deepEqual(parseTicketSnapshot('[{"userId":"a","tickets":1},{"nope":true},null]'), [
      { userId: "a", tickets: 1 },
    ]);
  });
});
