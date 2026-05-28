CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "Team" ("id", "name", "status", "note", "createdAt", "updatedAt")
VALUES ('team-default', '团队A', 'active', '默认团队', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

PRAGMA foreign_keys=off;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isFirstLogin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("id", "teamId", "name", "phone", "passwordHash", "role", "status", "isFirstLogin", "createdAt", "updatedAt")
SELECT "id", CASE WHEN "role" = 'administrator' THEN NULL ELSE 'team-default' END, "name", "phone", "passwordHash", "role", "status", "isFirstLogin", "createdAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

CREATE TABLE "new_Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL DEFAULT 'team-default',
    "plateNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "vehicleType" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vehicle_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Vehicle" ("id", "teamId", "plateNumber", "status", "vehicleType", "note", "createdAt", "updatedAt")
SELECT "id", 'team-default', "plateNumber", "status", "vehicleType", "note", "createdAt", "updatedAt" FROM "Vehicle";
DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

CREATE TABLE "new_DriverVehicleBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL DEFAULT 'team-default',
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriverVehicleBinding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DriverVehicleBinding_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DriverVehicleBinding_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DriverVehicleBinding" ("id", "teamId", "vehicleId", "driverId", "createdAt")
SELECT "id", 'team-default', "vehicleId", "driverId", "createdAt" FROM "DriverVehicleBinding";
DROP TABLE "DriverVehicleBinding";
ALTER TABLE "new_DriverVehicleBinding" RENAME TO "DriverVehicleBinding";
CREATE UNIQUE INDEX "DriverVehicleBinding_vehicleId_driverId_key" ON "DriverVehicleBinding"("vehicleId", "driverId");

CREATE TABLE "new_ExpenseType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL DEFAULT 'team-default',
    "name" TEXT NOT NULL,
    "requiresReceipt" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExpenseType_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExpenseType" ("id", "teamId", "name", "requiresReceipt", "enabled", "sortOrder", "createdAt", "updatedAt")
SELECT "id", 'team-default', "name", "requiresReceipt", "enabled", "sortOrder", "createdAt", "updatedAt" FROM "ExpenseType";
DROP TABLE "ExpenseType";
ALTER TABLE "new_ExpenseType" RENAME TO "ExpenseType";
CREATE UNIQUE INDEX "ExpenseType_teamId_name_key" ON "ExpenseType"("teamId", "name");

CREATE TABLE "new_Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL DEFAULT 'team-default',
    "tripNo" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "loadLocation" TEXT NOT NULL,
    "unloadLocation" TEXT NOT NULL,
    "estimatedFreight" DECIMAL,
    "actualFreight" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "driverNote" TEXT,
    "accountingNote" TEXT,
    "returnReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "startedAt" DATETIME,
    "submittedAt" DATETIME,
    "reviewStartedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Trip" ("id", "teamId", "tripNo", "vehicleId", "driverId", "customerName", "loadLocation", "unloadLocation", "estimatedFreight", "actualFreight", "status", "driverNote", "accountingNote", "returnReason", "createdBy", "startedAt", "submittedAt", "reviewStartedAt", "completedAt", "createdAt", "updatedAt")
SELECT "id", 'team-default', "tripNo", "vehicleId", "driverId", "customerName", "loadLocation", "unloadLocation", "estimatedFreight", "actualFreight", "status", "driverNote", "accountingNote", "returnReason", "createdBy", "startedAt", "submittedAt", "reviewStartedAt", "completedAt", "createdAt", "updatedAt" FROM "Trip";
DROP TABLE "Trip";
ALTER TABLE "new_Trip" RENAME TO "Trip";
CREATE UNIQUE INDEX "Trip_tripNo_key" ON "Trip"("tripNo");

CREATE TABLE "new_VehicleMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL DEFAULT 'team-default',
    "vehicleId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "voucherStorageKey" TEXT,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VehicleMaintenance_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehicleMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehicleMaintenance_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_VehicleMaintenance" ("id", "teamId", "vehicleId", "component", "amount", "occurredAt", "voucherStorageKey", "note", "createdBy", "createdAt", "updatedAt")
SELECT "id", 'team-default', "vehicleId", "component", "amount", "occurredAt", "voucherStorageKey", "note", "createdBy", "createdAt", "updatedAt" FROM "VehicleMaintenance";
DROP TABLE "VehicleMaintenance";
ALTER TABLE "new_VehicleMaintenance" RENAME TO "VehicleMaintenance";

CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT,
    "actorId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("id", "teamId", "actorId", "targetType", "targetId", "action", "before", "after", "createdAt")
SELECT "id", 'team-default', "actorId", "targetType", "targetId", "action", "before", "after", "createdAt" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";

PRAGMA foreign_keys=on;
