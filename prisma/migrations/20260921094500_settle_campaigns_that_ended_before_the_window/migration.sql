-- Entries used to lock the moment a campaign's last day passed. They now stay
-- open until somebody settles the winner, so a campaign with no `drawnAt` is
-- read as "still waiting, still open" — and every campaign that finished before
-- this change has no `drawnAt`. Left alone they would all reopen at once, long
-- after anyone was still logging into them, and climb back onto the dashboard.
--
-- Stamping the ones that are genuinely over closes them again, without
-- inventing a winner: `drawWinnerId` stays null, and a campaign decided on the
-- leaderboard still reports whoever topped it.
--
-- Raffle campaigns are deliberately left unstamped. One that ended without a
-- draw has no winner yet, and waiting for one is exactly the state the window
-- exists for — those are the campaigns people still owe days to. "step" is the
-- only raffle type in the registry on the day this was written (see
-- src/lib/campaign-types.ts); a type added afterwards is born with the new
-- behaviour and needs no backfill.
UPDATE "Campaign"
SET "drawnAt" = CURRENT_TIMESTAMP
WHERE "drawnAt" IS NULL
  AND "type" <> 'step'
  AND ("closedEarlyAt" IS NOT NULL OR "endDate" < date('now'));
