-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "goalValue" REAL,
    "goalName" TEXT,
    "closedEarlyAt" DATETIME,
    "reopenedForCorrections" BOOLEAN NOT NULL DEFAULT false,
    "drawnAt" DATETIME,
    "drawWinnerId" TEXT,
    "drawTicketIndex" INTEGER,
    "drawTickets" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_drawWinnerId_fkey" FOREIGN KEY ("drawWinnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("closedEarlyAt", "createdAt", "createdById", "description", "endDate", "goalName", "goalValue", "id", "name", "reopenedForCorrections", "startDate", "type", "updatedAt") SELECT "closedEarlyAt", "createdAt", "createdById", "description", "endDate", "goalName", "goalValue", "id", "name", "reopenedForCorrections", "startDate", "type", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE INDEX "Campaign_startDate_endDate_idx" ON "Campaign"("startDate", "endDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
