import { PrismaClient } from "@prisma/client";

/**
 * Writes a consistent snapshot of the database to a second file.
 *
 * The reason this exists rather than a `cp`: copying a live SQLite file can
 * capture a torn state. In WAL mode the most recent commits are still in the
 * `-wal` sidecar, so a copy of `app.db` alone is missing them; in the older
 * rollback-journal mode a copy taken mid-transaction is missing the journal it
 * would need to become consistent again. Either way the copy usually works —
 * which is the dangerous part, because the failure only shows up on the day you
 * try to restore it.
 *
 * `VACUUM INTO` is SQLite's answer: one statement, taken against a proper read
 * transaction, that writes a complete and compacted database. It is safe while
 * the app is serving, and the file it produces is safe for anything else — a
 * file-level backup agent, an rsync, a download — to pick up afterwards.
 *
 * Usage:
 *   npm run backup                        → prisma/backups/app-YYYY-MM-DD.db
 *   npm run backup -- /data/backups/x.db  → wherever you say
 *
 * In the container:
 *   docker compose exec app node ./prisma/backup.ts /data/backups/app.db
 */

function defaultTarget(): string {
  // Date, not timestamp: the usual pattern is one snapshot per day, overwritten
  // if it runs twice, with the retention handled by whatever archives it.
  const day = new Date().toISOString().slice(0, 10);
  return `prisma/backups/app-${day}.db`;
}

async function main() {
  const target = process.argv[2] ?? defaultTarget();

  const { mkdir } = await import("node:fs/promises");
  const { dirname, resolve } = await import("node:path");
  const absolute = resolve(target);
  await mkdir(dirname(absolute), { recursive: true });

  const prisma = new PrismaClient();
  try {
    // SQLite refuses to overwrite an existing file here, which is the right
    // default — it means a backup can never silently truncate the one before it.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${absolute.replace(/'/g, "''")}'`);
    console.log(`Wrote ${absolute}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Backup failed:", error);
  process.exit(1);
});
