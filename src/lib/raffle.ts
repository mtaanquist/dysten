import type { Standing } from "./scoring";

/**
 * The prize draw that decides a raffle campaign.
 *
 * Ranking and winning are separate questions here. The leaderboard still sorts
 * on steps, because watching the numbers is what makes people walk — but the
 * prize goes to a ticket pulled out of the pool, so someone who turned out
 * steadily all month has a real chance against whoever had the biggest week.
 *
 * Everything below is pure, and the draw needs exactly one random number, which
 * the caller supplies. That keeps the rules testable without a database and
 * makes a finished draw reproducible from the index that was stored with it.
 */

/** One participant's share of the pool. */
export interface TicketHolder {
  userId: string;
  tickets: number;
}

/**
 * Tickets earned for a total.
 *
 * Anyone who logged something holds at least one — a draw nobody can enter is
 * not a draw — and every further whole `per` earns another, so 40,000 steps is
 * four chances against 10,000's one.
 *
 * A day logged as zero is not "logging something": `hasLogged` is fed from
 * `activeDays`, the same rule the standings already use, so filling the month
 * with noughts buys nothing.
 */
export function ticketsFor(total: number, per: number, hasLogged: boolean): number {
  if (!hasLogged || per <= 0) return 0;
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.floor(total / per));
}

/**
 * The pool, in standings order.
 *
 * Order is what makes a draw checkable later — the stored index only means
 * something against a stable sequence — so this deliberately preserves whatever
 * order `computeStandings` produced rather than sorting again.
 */
export function ticketHolders(standings: Standing[], per: number): TicketHolder[] {
  return standings.map((row) => ({
    userId: row.userId,
    tickets: ticketsFor(row.total, per, row.activeDays > 0),
  }));
}

/** How many tickets are in the draw altogether. */
export function poolSize(holders: TicketHolder[]): number {
  return holders.reduce((sum, holder) => sum + holder.tickets, 0);
}

/**
 * Whose ticket sits at `index`.
 *
 * The pool is never materialised — walking the counts gives the same answer and
 * cannot be made to allocate an array the size of somebody's step count.
 *
 * Returns null when the index falls outside the pool, which covers the case
 * worth naming: a campaign where nobody logged anything has no one to draw.
 */
export function winnerAt(holders: TicketHolder[], index: number): string | null {
  if (!Number.isInteger(index) || index < 0) return null;

  let cursor = index;
  for (const holder of holders) {
    if (cursor < holder.tickets) return holder.userId;
    cursor -= holder.tickets;
  }
  return null;
}

/** Parses a stored `drawTickets` snapshot. Returns [] for anything unreadable. */
export function parseTicketSnapshot(raw: string | null): TicketHolder[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is TicketHolder =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as TicketHolder).userId === "string" &&
        typeof (row as TicketHolder).tickets === "number",
    );
  } catch {
    return [];
  }
}
