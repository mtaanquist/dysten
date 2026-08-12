-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "externalId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "locale" TEXT NOT NULL DEFAULT 'da-DK',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME
);
INSERT INTO "new_User" ("createdAt", "displayName", "email", "externalId", "id", "lastSeenAt", "locale", "remindersEnabled", "role") SELECT "createdAt", "displayName", "email", "externalId", "id", "lastSeenAt", "locale", "remindersEnabled", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
