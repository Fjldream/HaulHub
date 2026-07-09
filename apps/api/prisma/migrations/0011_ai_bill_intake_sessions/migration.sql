CREATE TABLE "AiBillIntakeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messagesJson" TEXT NOT NULL DEFAULT '[]',
    "imageUrlsJson" TEXT NOT NULL DEFAULT '[]',
    "currentDraftJson" TEXT,
    "reviewQuestionsJson" TEXT NOT NULL DEFAULT '[]',
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "lastResultJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "submittedTripId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiBillIntakeSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AiBillIntakeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AiBillIntakeSession_teamId_updatedAt_idx" ON "AiBillIntakeSession"("teamId", "updatedAt");
CREATE INDEX "AiBillIntakeSession_userId_updatedAt_idx" ON "AiBillIntakeSession"("userId", "updatedAt");
CREATE INDEX "AiBillIntakeSession_status_updatedAt_idx" ON "AiBillIntakeSession"("status", "updatedAt");
