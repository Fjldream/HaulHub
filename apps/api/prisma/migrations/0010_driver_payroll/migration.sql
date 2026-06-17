CREATE TABLE "DriverPayroll" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "salaryMonth" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "tripCount" INTEGER,
  "unitAmount" DECIMAL,
  "paidAt" DATETIME,
  "note" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DriverPayroll_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DriverPayroll_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DriverPayroll_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DriverPayroll_teamId_salaryMonth_idx" ON "DriverPayroll"("teamId", "salaryMonth");
CREATE INDEX "DriverPayroll_teamId_driverId_salaryMonth_idx" ON "DriverPayroll"("teamId", "driverId", "salaryMonth");
CREATE INDEX "DriverPayroll_teamId_type_salaryMonth_idx" ON "DriverPayroll"("teamId", "type", "salaryMonth");
