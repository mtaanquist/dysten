#!/bin/sh
set -e

# Bring the database up to date before serving. `migrate deploy` only applies
# migrations that already exist — it never generates or resets one — so it is
# safe to run on every start, including when nothing has changed.
echo "Applying database migrations…"
./node_modules/.bin/prisma migrate deploy

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
