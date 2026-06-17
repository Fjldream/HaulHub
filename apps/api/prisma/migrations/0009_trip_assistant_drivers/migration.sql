CREATE TABLE "TripAssistantDriver" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripAssistantDriver_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TripAssistantDriver_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TripAssistantDriver_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TripAssistantDriver_tripId_driverId_key" ON "TripAssistantDriver"("tripId", "driverId");
CREATE INDEX "TripAssistantDriver_driverId_idx" ON "TripAssistantDriver"("driverId");
