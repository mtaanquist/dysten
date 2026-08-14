#!/bin/sh
set -e

# Bring the database up to date before serving. `migrate deploy` only applies
# migrations that already exist — it never generates or resets one — so it is
# safe to run on every start, including when nothing has changed.
echo "Applying database migrations…"
node ./cli/node_modules/prisma/build/index.js migrate deploy

# Write-ahead logging: readers stop blocking the writer, which matters because
# every page render is a burst of reads. It is recorded in the database header,
# so this is idempotent — it only does anything the first time.
#
# It also changes what a backup has to be. In WAL mode recent commits live in
# the -wal sidecar, so copying app.db alone loses them; use prisma/backup.ts,
# which writes a complete snapshot with VACUUM INTO.
echo "Ensuring write-ahead logging…"
node ./cli/node_modules/prisma/build/index.js db execute --stdin --schema ./prisma/schema.prisma <<'SQL' || echo "  (skipped: could not set journal_mode)"
PRAGMA journal_mode=WAL;
SQL

# Optional demo data. Off by default, and deliberately so: seeding clears the
# existing rows first, which would wipe real data on a restart.
#
# Node 22 strips TypeScript types natively, so the seed script runs here
# without tsx or a build step of its own.
if [ "$SEED_ON_START" = "true" ]; then
  echo "Seeding demo data…"
  node ./prisma/seed.ts
fi

exec "$@"
