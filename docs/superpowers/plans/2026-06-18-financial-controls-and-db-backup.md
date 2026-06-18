# Financial Controls And Database Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe financial correction, monthly close/reopen controls, and small-server-friendly monthly database backups without changing unrelated existing workflows or UI.

**Architecture:** Keep the existing HaulHub monorepo shape. Add focused Prisma models and small API helper modules for financial periods, void filtering, and database backup retention; wire those helpers into the current Fastify routes in `apps/api/src/app.ts`. Web pages use existing AdminShell, panel, table, button, and toast styles; App changes are limited to API error handling for locked months.

**Tech Stack:** TypeScript, Fastify, Prisma, SQLite-compatible migrations, Next.js App Router, Uni/Vue, Vitest, Node.js `fs/promises`, existing `AuditLog` and API client helpers.

---

## Scope And Safety Notes

- Current worktree has unrelated local changes in `apps/driver-uni/src/pages/trips/index.vue`, `apps/driver-uni/src/features/driver/`, `.dev-logs/`, `.superpowers/`, and `apps/api/prisma/dev.db.backup-20260618-070828`. Do not stage or edit those for this feature unless the user explicitly asks.
- Implement this feature on the current branch only after confirming the unrelated files are still understood. Every commit in this plan must stage explicit paths.
- Existing UI must remain stable: no changes to login, driver trip tabs, bottom app nav, or unrelated page CSS.
- Backup must only include database data. It must not copy uploads, receipt images, app code, logs, `node_modules`, `.next`, or Uni build outputs.

## File Structure

### Backend Data And Helpers

- Modify: `apps/api/prisma/schema.prisma`
  - Add `FinancialPeriodClose`.
  - Add `DatabaseBackupRecord`.
  - Add soft-void metadata to `SettlementSnapshot`, `DriverPayroll`, `VehicleMaintenance`, and `Expense`.
- Create: `apps/api/prisma/migrations/0011_financial_controls_and_db_backups/migration.sql`
  - SQLite-compatible table creation and nullable columns.
- Create: `apps/api/src/financial-controls.ts`
  - Pure helpers for period-month parsing, financial month resolution, closed-month checks, and Prisma `where` fragments for active records.
- Create: `apps/api/src/financial-controls.test.ts`
  - Unit tests for helper behavior.
- Create: `apps/api/src/database-backups.ts`
  - Pure-ish backup planning helpers plus filesystem execution helpers.
- Create: `apps/api/src/database-backups.test.ts`
  - Unit tests for retention, low-disk skip, and path exclusion behavior.
- Modify: `apps/api/src/app.ts`
  - Add period close/reopen APIs.
  - Add financial adjustment/void APIs.
  - Add backup record API.
  - Apply close checks to existing write routes.
  - Apply active-record filters to profit reports.
- Modify: `apps/api/tests/api.test.ts`
  - Add endpoint and profit regression tests using the existing Prisma mock style.
- Modify: `apps/api/src/env.ts`
  - Add optional backup-related env parsing if the project already centralizes env access there.
- Modify: `apps/api/src/server.ts`
  - Start monthly database backup scheduler only in long-running server mode.

### Web Admin

- Modify: `apps/admin-web/src/lib/api-client.ts`
  - Add types for financial periods, financial adjustments, and backup records.
- Modify: `apps/admin-web/src/components/admin/admin-shell-client.tsx`
  - Add existing-style nav children under `利润统计` or `系统设置`.
- Modify: `apps/admin-web/src/components/admin/admin-shell-client.test.ts`
  - Assert active states for new child routes.
- Create: `apps/admin-web/src/components/admin/financial-controls-model.ts`
  - UI helper functions for close badge labels, destructive action labels, and backup status labels.
- Create: `apps/admin-web/src/components/admin/financial-controls-model.test.ts`
  - Unit tests for those UI helpers.
- Modify: `apps/admin-web/src/app/reports/monthly/page.tsx`
  - Show close status and link to period close actions.
- Create: `apps/admin-web/src/app/reports/periods/page.tsx`
  - Month close/reopen page.
- Create: `apps/admin-web/src/app/reports/adjustments/page.tsx`
  - Financial adjustment/void history page.
- Create: `apps/admin-web/src/app/settings/backups/page.tsx`
  - Database backup status page.
- Modify: `apps/admin-web/src/app/globals.css`
  - Add only small reusable classes for status pills and reason forms if existing classes are insufficient.

### App Admin / Driver

- Modify: `apps/driver-uni/src/api/client.ts`
  - Ensure API errors for closed periods preserve backend Chinese messages.
- Modify: `apps/driver-uni/src/pages/admin/trips/index.vue`
  - If manual billing save returns a closed-period error, show the backend message in the existing toast/modal style.
- Modify: `apps/driver-uni/src/pages/admin/maintenance/index.vue`
  - If maintenance save/delete returns a closed-period error, show the backend message in the existing style.

## Task 0: Preflight And Isolation

**Files:**
- Read only: entire repo status.
- No code files modified.

- [ ] **Step 1: Confirm dirty worktree**

Run:

```powershell
git status --short --branch
```

Expected: branch is `feature/haulhub-mvp`; unrelated dirty files may still be present. Do not stage `.dev-logs`, `.superpowers`, local database backups, or the older driver trip tab files.

- [ ] **Step 2: Confirm spec and plan are present**

Run:

```powershell
Test-Path docs/superpowers/specs/2026-06-18-financial-controls-and-db-backup-design.md
Test-Path docs/superpowers/plans/2026-06-18-financial-controls-and-db-backup.md
```

Expected:

```text
True
True
```

## Task 1: Prisma Data Model And Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/0011_financial_controls_and_db_backups/migration.sql`

- [ ] **Step 1: Add schema fields**

Modify `apps/api/prisma/schema.prisma`:

```prisma
model Expense {
  id                      String   @id @default(cuid())
  tripId                  String
  expenseTypeId           String
  expenseTypeNameSnapshot String
  amount                  Decimal
  occurredAt              DateTime
  note                    String?
  createdBy               String
  voidedAt                DateTime?
  voidedBy                String?
  voidReason              String?
  adjustedFromId          String?
  adjustReason            String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  trip          Trip           @relation(fields: [tripId], references: [id])
  expenseType   ExpenseType    @relation(fields: [expenseTypeId], references: [id])
  creator       User           @relation("ExpenseCreator", fields: [createdBy], references: [id])
  receiptImages ReceiptImage[]

  @@index([voidedAt])
}

model SettlementSnapshot {
  id            String   @id @default(cuid())
  tripId        String   @unique
  actualFreight Decimal
  expenseTotal  Decimal
  profit        Decimal
  profitRate    Decimal?
  settledBy     String
  settledAt     DateTime @default(now())
  voidedAt      DateTime?
  voidedBy      String?
  voidReason    String?
  adjustedFromId String?
  adjustReason  String?

  trip    Trip @relation(fields: [tripId], references: [id])
  settler User @relation("SettlementUser", fields: [settledBy], references: [id])

  @@index([voidedAt])
}

model VehicleMaintenance {
  id                String   @id @default(cuid())
  teamId            String
  vehicleId         String
  component         String
  amount            Decimal
  occurredAt        DateTime
  voucherStorageKey String?
  note              String?
  createdBy         String
  voidedAt          DateTime?
  voidedBy          String?
  voidReason        String?
  adjustedFromId    String?
  adjustReason      String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  team    Team    @relation(fields: [teamId], references: [id])
  vehicle Vehicle @relation(fields: [vehicleId], references: [id])
  creator User    @relation("MaintenanceCreator", fields: [createdBy], references: [id])

  @@index([teamId, occurredAt])
  @@index([voidedAt])
}

model DriverPayroll {
  id          String   @id @default(cuid())
  teamId      String
  driverId    String
  salaryMonth String
  type        String
  amount      Decimal
  tripCount   Int?
  unitAmount  Decimal?
  paidAt      DateTime?
  note        String?
  createdBy   String
  voidedAt    DateTime?
  voidedBy    String?
  voidReason  String?
  adjustedFromId String?
  adjustReason String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  team    Team @relation(fields: [teamId], references: [id])
  driver  User @relation("DriverPayrollDriver", fields: [driverId], references: [id])
  creator User @relation("DriverPayrollCreator", fields: [createdBy], references: [id])

  @@index([teamId, salaryMonth])
  @@index([teamId, driverId, salaryMonth])
  @@index([teamId, type, salaryMonth])
  @@index([voidedAt])
}

model FinancialPeriodClose {
  id             String   @id @default(cuid())
  teamId         String
  periodMonth    String
  status         String   @default("closed")
  closedAt       DateTime @default(now())
  closedById     String
  closeNote      String?
  reopenedAt     DateTime?
  reopenedById   String?
  reopenReason   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  team       Team @relation(fields: [teamId], references: [id])
  closedBy   User @relation("FinancialPeriodClosedBy", fields: [closedById], references: [id])
  reopenedBy User? @relation("FinancialPeriodReopenedBy", fields: [reopenedById], references: [id])

  @@unique([teamId, periodMonth])
  @@index([teamId, status])
}

model DatabaseBackupRecord {
  id             String   @id @default(cuid())
  status         String
  backupKind     String   @default("monthly-db")
  filePath       String?
  fileSizeBytes  Int?
  startedAt      DateTime @default(now())
  finishedAt     DateTime?
  failureReason  String?
  createdAt      DateTime @default(now())

  @@index([backupKind, startedAt])
  @@index([status, startedAt])
}
```

Also add the missing relation fields to `User`:

```prisma
  closedFinancialPeriods     FinancialPeriodClose[] @relation("FinancialPeriodClosedBy")
  reopenedFinancialPeriods   FinancialPeriodClose[] @relation("FinancialPeriodReopenedBy")
```

Keep `voidedBy` fields as nullable string IDs in the first implementation. Do not add nullable Prisma relations for them in this patch; the audit log already records the actor, and plain string columns keep the migration low risk for existing data.

- [ ] **Step 2: Write SQLite migration**

Create `apps/api/prisma/migrations/0011_financial_controls_and_db_backups/migration.sql`:

```sql
ALTER TABLE "Expense" ADD COLUMN "voidedAt" DATETIME;
ALTER TABLE "Expense" ADD COLUMN "voidedBy" TEXT;
ALTER TABLE "Expense" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "Expense" ADD COLUMN "adjustedFromId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "adjustReason" TEXT;
CREATE INDEX "Expense_voidedAt_idx" ON "Expense"("voidedAt");

ALTER TABLE "SettlementSnapshot" ADD COLUMN "voidedAt" DATETIME;
ALTER TABLE "SettlementSnapshot" ADD COLUMN "voidedBy" TEXT;
ALTER TABLE "SettlementSnapshot" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "SettlementSnapshot" ADD COLUMN "adjustedFromId" TEXT;
ALTER TABLE "SettlementSnapshot" ADD COLUMN "adjustReason" TEXT;
CREATE INDEX "SettlementSnapshot_voidedAt_idx" ON "SettlementSnapshot"("voidedAt");

ALTER TABLE "VehicleMaintenance" ADD COLUMN "voidedAt" DATETIME;
ALTER TABLE "VehicleMaintenance" ADD COLUMN "voidedBy" TEXT;
ALTER TABLE "VehicleMaintenance" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "VehicleMaintenance" ADD COLUMN "adjustedFromId" TEXT;
ALTER TABLE "VehicleMaintenance" ADD COLUMN "adjustReason" TEXT;
CREATE INDEX "VehicleMaintenance_voidedAt_idx" ON "VehicleMaintenance"("voidedAt");
CREATE INDEX "VehicleMaintenance_teamId_occurredAt_idx" ON "VehicleMaintenance"("teamId", "occurredAt");

ALTER TABLE "DriverPayroll" ADD COLUMN "voidedAt" DATETIME;
ALTER TABLE "DriverPayroll" ADD COLUMN "voidedBy" TEXT;
ALTER TABLE "DriverPayroll" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "DriverPayroll" ADD COLUMN "adjustedFromId" TEXT;
ALTER TABLE "DriverPayroll" ADD COLUMN "adjustReason" TEXT;
CREATE INDEX "DriverPayroll_voidedAt_idx" ON "DriverPayroll"("voidedAt");

CREATE TABLE "FinancialPeriodClose" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "periodMonth" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'closed',
  "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedById" TEXT NOT NULL,
  "closeNote" TEXT,
  "reopenedAt" DATETIME,
  "reopenedById" TEXT,
  "reopenReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FinancialPeriodClose_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialPeriodClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancialPeriodClose_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinancialPeriodClose_teamId_periodMonth_key" ON "FinancialPeriodClose"("teamId", "periodMonth");
CREATE INDEX "FinancialPeriodClose_teamId_status_idx" ON "FinancialPeriodClose"("teamId", "status");

CREATE TABLE "DatabaseBackupRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL,
  "backupKind" TEXT NOT NULL DEFAULT 'monthly-db',
  "filePath" TEXT,
  "fileSizeBytes" INTEGER,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "failureReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DatabaseBackupRecord_backupKind_startedAt_idx" ON "DatabaseBackupRecord"("backupKind", "startedAt");
CREATE INDEX "DatabaseBackupRecord_status_startedAt_idx" ON "DatabaseBackupRecord"("status", "startedAt");
```

- [ ] **Step 3: Validate Prisma schema**

Run:

```powershell
npm --workspace apps/api run db:generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 4: Commit data model**

Run:

```powershell
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/0011_financial_controls_and_db_backups/migration.sql
git commit -m "feat: 增加财务锁账和备份数据模型"
```

Expected: commit only includes schema and migration.

## Task 2: Financial Controls Helper

**Files:**
- Create: `apps/api/src/financial-controls.ts`
- Create: `apps/api/src/financial-controls.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/financial-controls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  activeRecordWhere,
  financialMonthFromDate,
  financialMonthFromSalaryMonth,
  isClosedPeriod,
  validatePeriodMonth,
} from "./financial-controls";

describe("financial controls helpers", () => {
  it("validates YYYY-MM period months", () => {
    expect(validatePeriodMonth("2026-06")).toBe("2026-06");
    expect(() => validatePeriodMonth("2026-6")).toThrow("月份格式必须为 YYYY-MM");
    expect(() => validatePeriodMonth("2026-13")).toThrow("月份格式必须为 YYYY-MM");
  });

  it("converts business dates to local financial month", () => {
    expect(financialMonthFromDate(new Date("2026-06-30T16:00:00.000Z"))).toBe("2026-07");
    expect(financialMonthFromDate(new Date("2026-06-01T00:00:00.000Z"))).toBe("2026-06");
  });

  it("uses salary month directly after validation", () => {
    expect(financialMonthFromSalaryMonth("2026-06")).toBe("2026-06");
    expect(() => financialMonthFromSalaryMonth("2026/06")).toThrow("月份格式必须为 YYYY-MM");
  });

  it("detects closed period records", () => {
    expect(isClosedPeriod(null)).toBe(false);
    expect(isClosedPeriod({ status: "closed" })).toBe(true);
    expect(isClosedPeriod({ status: "open" })).toBe(false);
  });

  it("builds active-record filters", () => {
    expect(activeRecordWhere()).toEqual({ voidedAt: null });
    expect(activeRecordWhere({ teamId: "team-1" })).toEqual({ teamId: "team-1", voidedAt: null });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm --workspace apps/api run test -- src/financial-controls.test.ts
```

Expected: FAIL because `financial-controls.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `apps/api/src/financial-controls.ts`:

```ts
const periodMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export type FinancialPeriodStatus = "open" | "closed";

export type FinancialPeriodLike = {
  status: string;
} | null;

export function validatePeriodMonth(value: string) {
  if (!periodMonthPattern.test(value)) {
    throw new Error("月份格式必须为 YYYY-MM");
  }
  return value;
}

export function financialMonthFromDate(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(date);
}

export function financialMonthFromSalaryMonth(salaryMonth: string) {
  return validatePeriodMonth(salaryMonth);
}

export function isClosedPeriod(period: FinancialPeriodLike) {
  return period?.status === "closed";
}

export function activeRecordWhere<T extends Record<string, unknown>>(where?: T) {
  return {
    ...(where ?? {}),
    voidedAt: null,
  };
}

export function closedPeriodMessage(periodMonth: string) {
  return `${periodMonth} 已结账，请先反结账后再调整财务数据。`;
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```powershell
npm --workspace apps/api run test -- src/financial-controls.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper**

Run:

```powershell
git add apps/api/src/financial-controls.ts apps/api/src/financial-controls.test.ts
git commit -m "feat: 增加财务期间控制工具"
```

Expected: commit only includes the helper and test.

## Task 3: Backup Planning And Filesystem Helper

**Files:**
- Create: `apps/api/src/database-backups.ts`
- Create: `apps/api/src/database-backups.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/database-backups.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BACKUP_KIND_MONTHLY_DB,
  buildBackupFileName,
  chooseOldBackupsToDelete,
  shouldSkipForDiskSpace,
  shouldRunMonthlyBackup,
} from "./database-backups";

describe("database backup helpers", () => {
  it("runs monthly backup only on the first day after 03:00 Asia/Shanghai", () => {
    expect(shouldRunMonthlyBackup(new Date("2026-06-30T19:01:00.000Z"))).toBe(true);
    expect(shouldRunMonthlyBackup(new Date("2026-06-30T18:59:00.000Z"))).toBe(false);
    expect(shouldRunMonthlyBackup(new Date("2026-07-01T19:01:00.000Z"))).toBe(false);
  });

  it("builds database-only backup file names", () => {
    expect(buildBackupFileName(new Date("2026-06-30T19:01:00.000Z"), "prod")).toBe(
      "haulhub-db-prod-2026-07-01.sqlite.gz",
    );
  });

  it("skips when free disk space is below 2GB", () => {
    expect(shouldSkipForDiskSpace(1_999_999_999)).toBe(true);
    expect(shouldSkipForDiskSpace(2_147_483_648)).toBe(false);
  });

  it("keeps newest 12 monthly db backups and deletes older overflow", () => {
    const records = Array.from({ length: 14 }, (_, index) => ({
      id: `backup-${index}`,
      backupKind: BACKUP_KIND_MONTHLY_DB,
      filePath: `/tmp/backup-${index}.sqlite.gz`,
      startedAt: new Date(`2026-${String(index + 1).padStart(2, "0")}-01T00:00:00.000Z`),
      fileSizeBytes: 100,
    }));

    expect(chooseOldBackupsToDelete(records, { keepCount: 12, maxTotalBytes: 2_147_483_648 })).toEqual([
      records[0],
      records[1],
    ]);
  });

  it("deletes oldest backups when total backup directory is above 2GB", () => {
    const records = [
      { id: "old", backupKind: BACKUP_KIND_MONTHLY_DB, filePath: "/tmp/old.gz", startedAt: new Date("2026-01-01"), fileSizeBytes: 1_500_000_000 },
      { id: "new", backupKind: BACKUP_KIND_MONTHLY_DB, filePath: "/tmp/new.gz", startedAt: new Date("2026-02-01"), fileSizeBytes: 800_000_000 },
    ];

    expect(chooseOldBackupsToDelete(records, { keepCount: 12, maxTotalBytes: 2_147_483_648 })).toEqual([
      records[0],
    ]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm --workspace apps/api run test -- src/database-backups.test.ts
```

Expected: FAIL because `database-backups.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `apps/api/src/database-backups.ts`:

```ts
import { createGzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

export const BACKUP_KIND_MONTHLY_DB = "monthly-db";
export const MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_BACKUP_DIR_BYTES = 2 * 1024 * 1024 * 1024;
export const MONTHLY_BACKUP_KEEP_COUNT = 12;

export type BackupRecordLike = {
  id: string;
  backupKind: string;
  filePath: string | null;
  startedAt: Date;
  fileSizeBytes: number | null;
};

function shanghaiParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return parts as { year: string; month: string; day: string; hour: string };
}

export function shouldRunMonthlyBackup(now = new Date()) {
  const parts = shanghaiParts(now);
  return parts.day === "01" && Number(parts.hour) >= 3;
}

export function buildBackupFileName(now = new Date(), envName = "prod") {
  const parts = shanghaiParts(now);
  return `haulhub-db-${envName}-${parts.year}-${parts.month}-${parts.day}.sqlite.gz`;
}

export function shouldSkipForDiskSpace(freeBytes: number) {
  return freeBytes < MIN_FREE_BYTES;
}

export function chooseOldBackupsToDelete(
  records: BackupRecordLike[],
  options = { keepCount: MONTHLY_BACKUP_KEEP_COUNT, maxTotalBytes: MAX_BACKUP_DIR_BYTES },
) {
  const sorted = records
    .filter((record) => record.backupKind === BACKUP_KIND_MONTHLY_DB && record.filePath)
    .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
  const deleteSet = new Set<BackupRecordLike>();

  while (sorted.length - deleteSet.size > options.keepCount) {
    const next = sorted.find((record) => !deleteSet.has(record));
    if (!next) break;
    deleteSet.add(next);
  }

  let remainingSize = sorted
    .filter((record) => !deleteSet.has(record))
    .reduce((total, record) => total + (record.fileSizeBytes ?? 0), 0);
  for (const record of sorted) {
    if (remainingSize <= options.maxTotalBytes) break;
    if (deleteSet.has(record)) continue;
    deleteSet.add(record);
    remainingSize -= record.fileSizeBytes ?? 0;
  }

  return [...deleteSet].sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
}

export async function gzipDatabaseFile(inputPath: string, outputPath: string) {
  await mkdir(dirname(outputPath), { recursive: true });
  await pipeline(createReadStream(inputPath), createGzip({ level: 9 }), createWriteStream(outputPath));
  const result = await stat(outputPath);
  return result.size;
}

export function backupOutputPath(backupRoot: string, fileName: string) {
  return join(backupRoot, "monthly-db", fileName);
}

export async function removeBackupFile(path: string) {
  await rm(path, { force: true });
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```powershell
npm --workspace apps/api run test -- src/database-backups.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit backup helper**

Run:

```powershell
git add apps/api/src/database-backups.ts apps/api/src/database-backups.test.ts
git commit -m "feat: 增加轻量数据库备份工具"
```

Expected: commit only includes backup helper and test.

## Task 4: Backend Financial Period APIs And Lock Checks

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: Add failing API tests**

Append tests to `apps/api/tests/api.test.ts` using the existing `createPrismaMock()` and `app.inject()` pattern:

```ts
it("closes and reopens a financial month with audit logs", async () => {
  const { prisma } = createPrismaMock();
  const app = buildApp({ prisma });

  const closeResponse = await app.inject({
    method: "POST",
    url: "/admin/financial-periods/2026-06/close",
    headers: accountantHeaders,
    payload: { note: "6月利润核对完成" },
  });
  expect(closeResponse.statusCode).toBe(200);
  expect(closeResponse.json().period).toMatchObject({ periodMonth: "2026-06", status: "closed" });

  const reopenResponse = await app.inject({
    method: "POST",
    url: "/admin/financial-periods/2026-06/reopen",
    headers: accountantHeaders,
    payload: { reason: "补录日期选错，需要修正" },
  });
  expect(reopenResponse.statusCode).toBe(200);
  expect(reopenResponse.json().period).toMatchObject({ periodMonth: "2026-06", status: "open" });
  expect(prisma.__state.auditLogs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ action: "financialPeriod.closed" }),
      expect.objectContaining({ action: "financialPeriod.reopened" }),
    ]),
  );
});

it("blocks manual completed billing for a closed month", async () => {
  const { prisma } = createPrismaMock();
  prisma.__state.closedPeriods = [{ teamId, periodMonth: "2026-06", status: "closed" }];
  const app = buildApp({ prisma });

  const response = await app.inject({
    method: "POST",
    url: "/admin/trips/manual-completed",
    headers: accountantHeaders,
    payload: {
      vehicleId: "vehicle-1",
      driverId,
      customerName: "客户A",
      actualFreight: "1000",
      settledAt: "2026-06-16",
      loadLocation: "上海",
      unloadLocation: "杭州",
      totalExpense: "200",
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json().message).toContain("2026-06 已结账");
});
```

Extend the mock state and Prisma mock with `financialPeriodClose.findFirst`, `findMany`, `upsert`, `update`, and expose `__state`:

```ts
closedPeriods: [] as Array<{ teamId: string; periodMonth: string; status: string; closeNote?: string | null; reopenReason?: string | null }>,
```

```ts
financialPeriodClose: {
  findFirst: async ({ where }: { where?: { teamId?: string; periodMonth?: string } } = {}) =>
    state.closedPeriods.find(
      (period) => (!where?.teamId || period.teamId === where.teamId) && (!where?.periodMonth || period.periodMonth === where.periodMonth),
    ) ?? null,
  findMany: async () => state.closedPeriods,
  upsert: async ({ where, create, update }: { where: { teamId_periodMonth: { teamId: string; periodMonth: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
    const existing = state.closedPeriods.find(
      (period) => period.teamId === where.teamId_periodMonth.teamId && period.periodMonth === where.teamId_periodMonth.periodMonth,
    );
    if (existing) {
      Object.assign(existing, update);
      return existing;
    }
    const created = { id: "period-close-1", ...create, status: String(create.status ?? "closed") };
    state.closedPeriods.push(created as (typeof state.closedPeriods)[number]);
    return created;
  },
  update: async ({ where, data }: { where: { teamId_periodMonth: { teamId: string; periodMonth: string } }; data: Record<string, unknown> }) => {
    const existing = state.closedPeriods.find(
      (period) => period.teamId === where.teamId_periodMonth.teamId && period.periodMonth === where.teamId_periodMonth.periodMonth,
    );
    if (!existing) throw new Error("Period not found");
    Object.assign(existing, data);
    return existing;
  },
},
__state: state,
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm --workspace apps/api run test -- tests/api.test.ts
```

Expected: FAIL because routes and lock checks do not exist yet.

- [ ] **Step 3: Implement period route helpers in `app.ts`**

At the top of `apps/api/src/app.ts`, add:

```ts
import {
  activeRecordWhere,
  closedPeriodMessage,
  financialMonthFromDate,
  financialMonthFromSalaryMonth,
  isClosedPeriod,
  validatePeriodMonth,
} from "./financial-controls";
```

Near existing helper functions, add:

```ts
async function findFinancialPeriod(tx: typeof prisma, teamId: string, periodMonth: string) {
  return tx.financialPeriodClose.findFirst({ where: { teamId, periodMonth } });
}

async function assertFinancialPeriodOpen(
  tx: typeof prisma,
  teamId: string,
  periodMonth: string,
  reply: FastifyReply,
) {
  const period = await findFinancialPeriod(tx, teamId, periodMonth);
  if (isClosedPeriod(period)) {
    reply.code(400);
    throw new Error(closedPeriodMessage(periodMonth));
  }
}
```

Use the project’s existing `reply.code(...).send(...)` style if thrown errors are not handled consistently. The final route behavior must return:

```json
{ "message": "2026-06 已结账，请先反结账后再调整财务数据。" }
```

- [ ] **Step 4: Add period APIs in `app.ts`**

Add routes before `app.get("/admin/reports/profit", ...)`:

```ts
app.get("/admin/financial-periods", async (request) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const query = z.object({ year: z.string().regex(/^\d{4}$/).optional() }).parse(request.query);
  const teamId = requiredTeamId(user);
  const where = query.year
    ? { teamId, periodMonth: { gte: `${query.year}-01`, lte: `${query.year}-12` } }
    : { teamId };
  const periods = await prisma.financialPeriodClose.findMany({ where, orderBy: { periodMonth: "asc" } });
  return { periods };
});

app.post("/admin/financial-periods/:month/close", async (request) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const { month } = z.object({ month: z.string() }).parse(request.params);
  const body = z.object({ note: z.string().trim().max(500).optional() }).parse(request.body ?? {});
  const periodMonth = validatePeriodMonth(month);
  const teamId = requiredTeamId(user);
  const period = await prisma.financialPeriodClose.upsert({
    where: { teamId_periodMonth: { teamId, periodMonth } },
    create: {
      teamId,
      periodMonth,
      status: "closed",
      closedById: user.id,
      closeNote: body.note ?? null,
    },
    update: {
      status: "closed",
      closedAt: new Date(),
      closedById: user.id,
      closeNote: body.note ?? null,
      reopenedAt: null,
      reopenedById: null,
      reopenReason: null,
    },
  });
  await prisma.auditLog.create({
    data: {
      teamId,
      actorId: user.id,
      targetType: "FinancialPeriodClose",
      targetId: period.id,
      action: "financialPeriod.closed",
      before: null,
      after: JSON.stringify({ periodMonth, note: body.note ?? null }),
    },
  });
  return { period };
});

app.post("/admin/financial-periods/:month/reopen", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const { month } = z.object({ month: z.string() }).parse(request.params);
  const body = z.object({ reason: z.string().trim().min(1, "请填写反结账原因。").max(500) }).parse(request.body ?? {});
  const periodMonth = validatePeriodMonth(month);
  const teamId = requiredTeamId(user);
  const existing = await prisma.financialPeriodClose.findFirst({ where: { teamId, periodMonth } });
  if (!existing || existing.status !== "closed") {
    return reply.code(400).send({ message: "该月份尚未结账，无需反结账。" });
  }
  const period = await prisma.financialPeriodClose.update({
    where: { teamId_periodMonth: { teamId, periodMonth } },
    data: {
      status: "open",
      reopenedAt: new Date(),
      reopenedById: user.id,
      reopenReason: body.reason,
    },
  });
  await prisma.auditLog.create({
    data: {
      teamId,
      actorId: user.id,
      targetType: "FinancialPeriodClose",
      targetId: period.id,
      action: "financialPeriod.reopened",
      before: JSON.stringify({ status: "closed" }),
      after: JSON.stringify({ periodMonth, reason: body.reason }),
    },
  });
  return { period };
});
```

- [ ] **Step 5: Apply lock checks to existing writes**

In `POST /admin/trips/manual-completed`, after computing `settledAt` and `vehicle.teamId`, add:

```ts
const periodMonth = financialMonthFromDate(settledAt);
const closedPeriod = await txPrisma.financialPeriodClose.findFirst({
  where: { teamId: vehicle.teamId, periodMonth },
});
if (isClosedPeriod(closedPeriod)) {
  throw new Error(closedPeriodMessage(periodMonth));
}
```

Wrap transaction errors so the response is `400` with the Chinese message.

For `POST /admin/driver-payrolls`, before create:

```ts
const periodMonth = financialMonthFromSalaryMonth(body.salaryMonth);
const closedPeriod = await prisma.financialPeriodClose.findFirst({ where: { teamId, periodMonth } });
if (isClosedPeriod(closedPeriod)) {
  return reply.code(400).send({ message: closedPeriodMessage(periodMonth) });
}
```

For payroll update/delete, maintenance create/update/delete, and admin expense update/delete, derive the business month from the existing record and apply the same check.

- [ ] **Step 6: Run API tests**

Run:

```powershell
npm --workspace apps/api run test -- tests/api.test.ts src/financial-controls.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit period APIs**

Run:

```powershell
git add apps/api/src/app.ts apps/api/tests/api.test.ts
git commit -m "feat: 增加月度结账锁定接口"
```

Expected: commit only includes API route and test changes.

## Task 5: Backend Financial Void And Profit Filtering

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: Add failing tests**

Append tests to `apps/api/tests/api.test.ts`:

```ts
it("voids payroll records and excludes them from profit report", async () => {
  const { prisma } = createPrismaMock();
  prisma.__state.driverPayrolls.push({
    id: "payroll-1",
    teamId,
    driverId,
    salaryMonth: "2026-06",
    type: "fixed",
    amount: decimal("5000.00"),
    tripCount: null,
    unitAmount: null,
    paidAt: null,
    note: "6月工资",
    createdBy: accountantId,
    createdAt: new Date("2026-06-18T00:00:00.000Z"),
    updatedAt: new Date("2026-06-18T00:00:00.000Z"),
    driver: { id: driverId, name: "Driver One", phone: "13900000001" },
    creator: { id: accountantId, name: "Accountant One" },
  });
  const app = buildApp({ prisma });

  const voidResponse = await app.inject({
    method: "POST",
    url: "/admin/financial-adjustments",
    headers: accountantHeaders,
    payload: { targetType: "driverPayroll", targetId: "payroll-1", action: "void", reason: "工资月份录错" },
  });
  expect(voidResponse.statusCode).toBe(200);

  const reportResponse = await app.inject({
    method: "GET",
    url: "/admin/reports/profit?period=month&from=2026-06-01&to=2026-06-30",
    headers: accountantHeaders,
  });
  expect(reportResponse.statusCode).toBe(200);
  expect(reportResponse.json().summary.driverPayrollTotal).toBe("0.00");
});
```

Extend mock `driverPayroll.findMany` so it respects `voidedAt: null`, and add `driverPayroll.update`.

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm --workspace apps/api run test -- tests/api.test.ts
```

Expected: FAIL because `POST /admin/financial-adjustments` does not exist or profit filtering ignores `voidedAt`.

- [ ] **Step 3: Add adjustment route**

In `apps/api/src/app.ts`, add:

```ts
const financialAdjustmentSchema = z.object({
  targetType: z.enum(["settlementSnapshot", "driverPayroll", "vehicleMaintenance", "expense"]),
  targetId: z.string().min(1),
  action: z.enum(["void"]),
  reason: z.string().trim().min(1, "请填写作废原因。").max(500),
});
```

Add route:

```ts
app.post("/admin/financial-adjustments", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const body = financialAdjustmentSchema.parse(request.body);
  const teamId = requiredTeamId(user);
  const now = new Date();

  if (body.targetType === "driverPayroll") {
    const existing = await prisma.driverPayroll.findFirst({ where: { id: body.targetId, teamId } });
    if (!existing) return reply.code(404).send({ message: "工资记录不存在。" });
    const periodMonth = financialMonthFromSalaryMonth(existing.salaryMonth);
    const period = await findFinancialPeriod(prisma, teamId, periodMonth);
    if (isClosedPeriod(period)) return reply.code(400).send({ message: closedPeriodMessage(periodMonth) });
    const updated = await prisma.driverPayroll.update({
      where: { id: existing.id },
      data: { voidedAt: now, voidedBy: user.id, voidReason: body.reason },
    });
    await prisma.auditLog.create({
      data: {
        teamId,
        actorId: user.id,
        targetType: "DriverPayroll",
        targetId: existing.id,
        action: "driverPayroll.voided",
        before: JSON.stringify({ amount: existing.amount.toString(), salaryMonth: existing.salaryMonth }),
        after: JSON.stringify({ reason: body.reason, voidedAt: now.toISOString() }),
      },
    });
    return { adjustment: { targetType: body.targetType, targetId: existing.id, action: body.action }, target: updated };
  }

  return reply.code(400).send({ message: "暂不支持该财务对象作废。" });
});
```

After payroll is passing, extend the same route for:

- `vehicleMaintenance`: find by `{ id, teamId }`, period from `occurredAt`, update `voidedAt`.
- `settlementSnapshot`: find by id with `trip.teamId`, period from `settledAt`, update `voidedAt`.
- `expense`: find by id with `trip.teamId`, period from settlement `settledAt` if trip completed, otherwise from `occurredAt`, update `voidedAt`.

Each branch must write `AuditLog` with action names:

```text
vehicleMaintenance.voided
settlementSnapshot.voided
expense.voided
```

- [ ] **Step 4: Filter profit report**

In `GET /admin/reports/profit`, update queries:

```ts
const settlements = await prisma.settlementSnapshot.findMany({
  where: {
    voidedAt: null,
    ...(Object.keys(settledAt).length > 0 ? { settledAt } : {}),
    ...(teamId ? { trip: { teamId } } : {}),
  },
  include: { ... },
});
```

For maintenance:

```ts
where: {
  voidedAt: null,
  ...(Object.keys(maintenanceOccurredAt).length > 0 ? { occurredAt: maintenanceOccurredAt } : {}),
  ...(teamId ? { teamId } : {}),
}
```

For payroll:

```ts
where: {
  voidedAt: null,
  ...(payrollTeamId ? { teamId: payrollTeamId } : {}),
}
```

When aggregating trip expense types from settlement trip expenses, skip voided expenses:

```ts
for (const expense of settlement.trip.expenses.filter((expense) => !expense.voidedAt)) {
  ...
}
```

- [ ] **Step 5: Run API tests**

Run:

```powershell
npm --workspace apps/api run test -- tests/api.test.ts src/financial-controls.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit void and filtering**

Run:

```powershell
git add apps/api/src/app.ts apps/api/tests/api.test.ts
git commit -m "feat: 增加财务作废和利润过滤"
```

Expected: commit only includes API and tests.

## Task 6: Backend Database Backup API And Scheduler

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: Add failing backup API test**

Append to `apps/api/tests/api.test.ts`:

```ts
it("lists database backup records for admins", async () => {
  const { prisma } = createPrismaMock();
  prisma.__state.backupRecords = [
    {
      id: "backup-1",
      status: "success",
      backupKind: "monthly-db",
      filePath: "/home/ubuntu/haulhub-backups/monthly-db/haulhub-db-prod-2026-07-01.sqlite.gz",
      fileSizeBytes: 1024,
      startedAt: new Date("2026-07-01T03:00:00.000+08:00"),
      finishedAt: new Date("2026-07-01T03:00:05.000+08:00"),
      failureReason: null,
      createdAt: new Date("2026-07-01T03:00:00.000+08:00"),
    },
  ];
  const app = buildApp({ prisma });
  const response = await app.inject({ method: "GET", url: "/admin/backups/database", headers: accountantHeaders });
  expect(response.statusCode).toBe(200);
  expect(response.json().backups[0]).toMatchObject({
    status: "success",
    backupKind: "monthly-db",
    fileSizeBytes: 1024,
  });
});
```

Extend mock:

```ts
backupRecords: [] as Array<Record<string, unknown>>,
databaseBackupRecord: {
  findMany: async () => state.backupRecords,
  create: async ({ data }: { data: Record<string, unknown> }) => {
    const created = { id: `backup-${state.backupRecords.length + 1}`, createdAt: new Date(), ...data };
    state.backupRecords.push(created);
    return created;
  },
  update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const record = state.backupRecords.find((item) => item.id === where.id);
    Object.assign(record ?? {}, data);
    return record;
  },
  deleteMany: async () => ({ count: 0 }),
},
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm --workspace apps/api run test -- tests/api.test.ts src/database-backups.test.ts
```

Expected: FAIL because backup route is missing.

- [ ] **Step 3: Add backup API**

In `apps/api/src/app.ts`, add:

```ts
app.get("/admin/backups/database", async (request) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const backups = await prisma.databaseBackupRecord.findMany({
    where: { backupKind: "monthly-db" },
    orderBy: { startedAt: "desc" },
    take: 24,
  });
  return { backups };
});
```

- [ ] **Step 4: Add backup runner function**

In `apps/api/src/server.ts`, after app startup code is clear, import and call a new function:

```ts
import { startDatabaseBackupScheduler } from "./database-backup-scheduler";
```

Create `apps/api/src/database-backup-scheduler.ts` if `server.ts` would become cluttered. The scheduler must:

```ts
export function startDatabaseBackupScheduler(input: {
  prisma: PrismaClient;
  databaseUrl: string;
  backupRoot: string;
  envName: string;
}) {
  const run = async () => {
    if (!shouldRunMonthlyBackup(new Date())) return;
    // check whether a successful backup already exists for today's file name
    // check free disk space
    // clean old records/files
    // gzip database file
    // record success or failed/skipped status
  };
  const timer = setInterval(() => {
    run().catch((error) => console.error("database backup failed", error));
  }, 60 * 60 * 1000);
  timer.unref?.();
  return { run, stop: () => clearInterval(timer) };
}
```

Use Node 20 `fs.statfs` if available:

```ts
import { statfs } from "node:fs/promises";

async function freeBytes(path: string) {
  const stats = await statfs(path);
  return Number(stats.bavail) * Number(stats.bsize);
}
```

Only support SQLite paths for automatic backups. If `DATABASE_URL` is not `file:...`, record status `skipped` with reason `当前自动备份仅支持 SQLite 数据库。`

- [ ] **Step 5: Run tests**

Run:

```powershell
npm --workspace apps/api run test -- src/database-backups.test.ts tests/api.test.ts
npm --workspace apps/api run lint
```

Expected: PASS.

- [ ] **Step 6: Commit backup API and scheduler**

Run:

```powershell
git add apps/api/src/app.ts apps/api/src/server.ts apps/api/src/env.ts apps/api/src/database-backup-scheduler.ts apps/api/tests/api.test.ts
git commit -m "feat: 增加数据库月备份状态接口"
```

Expected: commit only includes backup API, scheduler, env, and test changes.

## Task 7: Web Admin Types, Navigation, And UI Helpers

**Files:**
- Modify: `apps/admin-web/src/lib/api-client.ts`
- Modify: `apps/admin-web/src/components/admin/admin-shell-client.tsx`
- Modify: `apps/admin-web/src/components/admin/admin-shell-client.test.ts`
- Create: `apps/admin-web/src/components/admin/financial-controls-model.ts`
- Create: `apps/admin-web/src/components/admin/financial-controls-model.test.ts`

- [ ] **Step 1: Write failing UI helper tests**

Create `apps/admin-web/src/components/admin/financial-controls-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  backupStatusLabel,
  backupStatusTone,
  financialPeriodStatusLabel,
  financialPeriodStatusTone,
  requiresReason,
} from "./financial-controls-model";

describe("financial controls UI model", () => {
  it("labels period status", () => {
    expect(financialPeriodStatusLabel("closed")).toBe("已结账");
    expect(financialPeriodStatusLabel("open")).toBe("未结账");
  });

  it("uses restrained tones for period status", () => {
    expect(financialPeriodStatusTone("closed")).toBe("success");
    expect(financialPeriodStatusTone("open")).toBe("muted");
  });

  it("labels backup status", () => {
    expect(backupStatusLabel("success")).toBe("成功");
    expect(backupStatusLabel("failed")).toBe("失败");
    expect(backupStatusLabel("skipped")).toBe("已跳过");
  });

  it("uses warning tone for skipped or failed backups", () => {
    expect(backupStatusTone("success")).toBe("success");
    expect(backupStatusTone("skipped")).toBe("warning");
    expect(backupStatusTone("failed")).toBe("danger");
  });

  it("requires reason for destructive finance actions", () => {
    expect(requiresReason("reopen")).toBe(true);
    expect(requiresReason("void")).toBe(true);
    expect(requiresReason("close")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm --workspace apps/admin-web run test -- src/components/admin/financial-controls-model.test.ts
```

Expected: FAIL because model file does not exist.

- [ ] **Step 3: Implement UI helper**

Create `apps/admin-web/src/components/admin/financial-controls-model.ts`:

```ts
export type StatusTone = "success" | "warning" | "danger" | "muted";

export function financialPeriodStatusLabel(status: string | null | undefined) {
  return status === "closed" ? "已结账" : "未结账";
}

export function financialPeriodStatusTone(status: string | null | undefined): StatusTone {
  return status === "closed" ? "success" : "muted";
}

export function backupStatusLabel(status: string | null | undefined) {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  if (status === "skipped") return "已跳过";
  if (status === "running") return "执行中";
  return "未知";
}

export function backupStatusTone(status: string | null | undefined): StatusTone {
  if (status === "success") return "success";
  if (status === "failed") return "danger";
  if (status === "skipped") return "warning";
  return "muted";
}

export function requiresReason(action: "close" | "reopen" | "void") {
  return action === "reopen" || action === "void";
}
```

- [ ] **Step 4: Add API types**

Modify `apps/admin-web/src/lib/api-client.ts`:

```ts
export interface ApiFinancialPeriod {
  id: string;
  teamId: string;
  periodMonth: string;
  status: "open" | "closed" | string;
  closedAt: string | null;
  closedById: string | null;
  closeNote: string | null;
  reopenedAt: string | null;
  reopenedById: string | null;
  reopenReason: string | null;
}

export interface ApiDatabaseBackupRecord {
  id: string;
  status: "success" | "failed" | "skipped" | "running" | string;
  backupKind: string;
  filePath: string | null;
  fileSizeBytes: number | null;
  startedAt: string;
  finishedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}
```

- [ ] **Step 5: Add nav children**

Modify `apps/admin-web/src/components/admin/admin-shell-client.tsx` under `利润统计` children:

```tsx
{ href: "/reports/periods", label: "结账管理" },
{ href: "/reports/adjustments", label: "调整记录" },
```

Add utility child under settings only if the nav supports it; otherwise add a normal utility item:

```tsx
{ href: "/settings/backups", label: "数据库备份", icon: ShieldCheck, adminOnly: false },
```

Keep icon sizing and classes unchanged.

- [ ] **Step 6: Extend nav active tests**

Modify `apps/admin-web/src/components/admin/admin-shell-client.test.ts`:

```ts
it("keeps financial control report child routes under reports", () => {
  expect(isNavItemActive("/reports", "/reports/periods")).toBe(true);
  expect(isNavChildActive("/reports/periods", "/reports/periods")).toBe(true);
  expect(isNavChildActive("/reports", "/reports/periods")).toBe(false);
});
```

- [ ] **Step 7: Run tests**

Run:

```powershell
npm --workspace apps/admin-web run test -- src/components/admin/financial-controls-model.test.ts src/components/admin/admin-shell-client.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit web foundation**

Run:

```powershell
git add apps/admin-web/src/lib/api-client.ts apps/admin-web/src/components/admin/admin-shell-client.tsx apps/admin-web/src/components/admin/admin-shell-client.test.ts apps/admin-web/src/components/admin/financial-controls-model.ts apps/admin-web/src/components/admin/financial-controls-model.test.ts
git commit -m "feat: 增加财务控制后台导航"
```

Expected: commit only includes admin web foundation files.

## Task 8: Web Periods, Adjustments, And Backup Pages

**Files:**
- Modify: `apps/admin-web/src/app/reports/monthly/page.tsx`
- Create: `apps/admin-web/src/app/reports/periods/page.tsx`
- Create: `apps/admin-web/src/app/reports/adjustments/page.tsx`
- Create: `apps/admin-web/src/app/settings/backups/page.tsx`
- Modify: `apps/admin-web/src/app/globals.css`

- [ ] **Step 1: Create close/reopen page**

Create `apps/admin-web/src/app/reports/periods/page.tsx`:

```tsx
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { financialPeriodStatusLabel } from "@/components/admin/financial-controls-model";
import { apiGet, apiPost, type ApiFinancialPeriod } from "@/lib/api-client";
import { redirectWithActionError } from "@/lib/action-errors";

export const dynamic = "force-dynamic";

type PeriodsSearchParams = { year?: string };

function currentYear() {
  return new Date().getFullYear();
}

function normalizeYear(value: string | undefined) {
  return /^\d{4}$/.test(value ?? "") ? Number(value) : currentYear();
}

async function closePeriodAction(formData: FormData) {
  "use server";
  const month = String(formData.get("month") || "");
  const note = String(formData.get("note") || "");
  try {
    await apiPost(`/admin/financial-periods/${month}/close`, { note });
  } catch (error) {
    redirectWithActionError("/reports/periods", error);
  }
  revalidatePath("/reports/periods");
  revalidatePath("/reports/monthly");
  redirect(`/reports/periods?year=${month.slice(0, 4)}`);
}

async function reopenPeriodAction(formData: FormData) {
  "use server";
  const month = String(formData.get("month") || "");
  const reason = String(formData.get("reason") || "");
  try {
    await apiPost(`/admin/financial-periods/${month}/reopen`, { reason });
  } catch (error) {
    redirectWithActionError("/reports/periods", error);
  }
  revalidatePath("/reports/periods");
  revalidatePath("/reports/monthly");
  redirect(`/reports/periods?year=${month.slice(0, 4)}`);
}

export default async function FinancialPeriodsPage({ searchParams }: { searchParams: Promise<PeriodsSearchParams> }) {
  const params = await searchParams;
  const year = normalizeYear(params.year);
  const { periods } = await apiGet<{ periods: ApiFinancialPeriod[] }>(`/admin/financial-periods?year=${year}`);
  const periodMap = new Map(periods.map((period) => [period.periodMonth, period]));
  const rows = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    return { month, period: periodMap.get(month) };
  });

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>结账管理</h1>
          <p>按月份锁定利润相关数据，反结账需要填写原因。</p>
        </div>
      </section>
      <form className="table-toolbar">
        <label className="toolbar-search">
          <input name="year" inputMode="numeric" pattern="\d{4}" defaultValue={String(year)} />
        </label>
        <button className="secondary-button" type="submit">查询</button>
      </form>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{year} 年结账状态</h2>
            <p>未结账月份允许正常录入和修正；已结账月份需要先反结账。</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>月份</th>
                <th>状态</th>
                <th>备注 / 原因</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ month, period }) => {
                const closed = period?.status === "closed";
                return (
                  <tr key={month}>
                    <td className="strong">{month}</td>
                    <td><span className={closed ? "status-pill success" : "status-pill muted"}>{financialPeriodStatusLabel(period?.status)}</span></td>
                    <td>{closed ? period?.closeNote || "-" : period?.reopenReason || "-"}</td>
                    <td>
                      {closed ? (
                        <form action={reopenPeriodAction} className="inline-reason-form">
                          <input type="hidden" name="month" value={month} />
                          <input name="reason" placeholder="反结账原因" required />
                          <button className="danger-button" type="submit">反结账</button>
                        </form>
                      ) : (
                        <form action={closePeriodAction} className="inline-reason-form">
                          <input type="hidden" name="month" value={month} />
                          <input name="note" placeholder="结账备注，可选" />
                          <button className="secondary-button" type="submit">结账</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 2: Create adjustments page**

Create `apps/admin-web/src/app/reports/adjustments/page.tsx`:

```tsx
import { AdminShell } from "@/components/admin/admin-shell";
import { apiGet, formatDateTime, type ApiAuditLog } from "@/lib/api-client";

export const dynamic = "force-dynamic";

const actions = [
  "driverPayroll.voided",
  "vehicleMaintenance.voided",
  "settlementSnapshot.voided",
  "expense.voided",
  "financialPeriod.closed",
  "financialPeriod.reopened",
].join(",");

export default async function FinancialAdjustmentsPage() {
  const { logs } = await apiGet<{ logs: ApiAuditLog[] }>(`/admin/audit-logs?action=${encodeURIComponent(actions)}`);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>调整记录</h1>
          <p>查看财务作废、结账和反结账记录。</p>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>财务调整历史</h2>
            <p>这里保留操作人、时间、对象和原因，便于上线后查账。</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>动作</th>
                <th>对象</th>
                <th>原因 / 详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{log.actorName}</td>
                  <td>{log.action}</td>
                  <td>{log.targetType}</td>
                  <td className="payroll-note-cell">{JSON.stringify(log.after ?? {})}</td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state compact"><strong>暂无调整记录</strong><span>发生作废、结账或反结账后会显示在这里。</span></div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
```

If `/admin/audit-logs` does not support comma-separated actions, add backend support or fetch all recent logs and filter client-side on this page.

- [ ] **Step 3: Create backup page**

Create `apps/admin-web/src/app/settings/backups/page.tsx`:

```tsx
import { AdminShell } from "@/components/admin/admin-shell";
import { backupStatusLabel, backupStatusTone } from "@/components/admin/financial-controls-model";
import { apiGet, formatDateTime, type ApiDatabaseBackupRecord } from "@/lib/api-client";

export const dynamic = "force-dynamic";

function fileSize(bytes: number | null) {
  if (!bytes) return "-";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default async function DatabaseBackupsPage() {
  const { backups } = await apiGet<{ backups: ApiDatabaseBackupRecord[] }>("/admin/backups/database");
  const latest = backups[0];

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>数据库备份</h1>
          <p>每月自动备份一次数据库，不备份图片、附件、代码和日志。</p>
        </div>
      </section>
      <section className="metric-grid">
        <article className="metric-card">
          <span>备份策略</span>
          <strong>每月一次</strong>
          <small>保留 12 个月，目录上限 2GB</small>
        </article>
        <article className="metric-card">
          <span>最近状态</span>
          <strong>{latest ? backupStatusLabel(latest.status) : "暂无"}</strong>
          <small>{latest ? formatDateTime(latest.startedAt) : "尚未生成备份"}</small>
        </article>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>备份记录</h2>
            <p>这里只展示状态，数据库恢复仍由运维手动执行。</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>开始时间</th>
                <th>结束时间</th>
                <th>状态</th>
                <th>大小</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id}>
                  <td>{formatDateTime(backup.startedAt)}</td>
                  <td>{backup.finishedAt ? formatDateTime(backup.finishedAt) : "-"}</td>
                  <td><span className={`status-pill ${backupStatusTone(backup.status)}`}>{backupStatusLabel(backup.status)}</span></td>
                  <td>{fileSize(backup.fileSizeBytes)}</td>
                  <td>{backup.failureReason ?? "数据库备份文件已生成"}</td>
                </tr>
              ))}
              {backups.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state compact"><strong>暂无备份记录</strong><span>定时任务执行后会显示状态。</span></div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 4: Add minimal CSS**

Append to `apps/admin-web/src/app/globals.css` near existing table/form utility styles:

```css
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.status-pill.success {
  color: #0f6848;
  background: #e1f4ec;
}

.status-pill.warning {
  color: #8a5a00;
  background: #fff3d6;
}

.status-pill.danger {
  color: #9f1f1f;
  background: #fde4e4;
}

.status-pill.muted {
  color: var(--muted);
  background: #f2f5f9;
}

.inline-reason-form {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.inline-reason-form input {
  min-width: 180px;
}
```

- [ ] **Step 5: Run admin web verification**

Run:

```powershell
npm --workspace apps/admin-web run test
npm --workspace apps/admin-web run lint
npm --workspace apps/admin-web run build
```

Expected: PASS.

- [ ] **Step 6: Commit pages**

Run:

```powershell
git add apps/admin-web/src/app/reports/monthly/page.tsx apps/admin-web/src/app/reports/periods/page.tsx apps/admin-web/src/app/reports/adjustments/page.tsx apps/admin-web/src/app/settings/backups/page.tsx apps/admin-web/src/app/globals.css
git commit -m "feat: 增加结账和备份后台页面"
```

Expected: commit only includes Web page and CSS changes.

## Task 9: App Error Adaptation For Locked Periods

**Files:**
- Modify: `apps/driver-uni/src/api/client.ts`
- Modify: `apps/driver-uni/src/pages/admin/trips/index.vue`
- Modify: `apps/driver-uni/src/pages/admin/maintenance/index.vue`
- Create or modify tests if existing model tests expose submission error handling.

- [ ] **Step 1: Inspect current request error behavior**

Run:

```powershell
rg -n "throw new Error|message|showToast|showModal|request<" apps/driver-uni/src/api/client.ts apps/driver-uni/src/pages/admin/trips/index.vue apps/driver-uni/src/pages/admin/maintenance/index.vue
```

Expected: identify where backend error messages are converted to UI.

- [ ] **Step 2: Preserve backend Chinese messages**

If `apps/driver-uni/src/api/client.ts` discards API response messages, change request error handling to:

```ts
const errorPayload = await response.json().catch(() => null) as { message?: string } | null;
throw new Error(errorPayload?.message ?? `请求失败：${response.status}`);
```

Do not change normal successful response mapping.

- [ ] **Step 3: Show closed-period messages in existing style**

In manual billing submit catch block in `apps/driver-uni/src/pages/admin/trips/index.vue`, ensure it uses the caught error message:

```ts
catch (error) {
  uni.showToast({
    title: error instanceof Error ? error.message : "保存失败",
    icon: "none",
  });
}
```

In maintenance create/update/delete catch blocks in `apps/driver-uni/src/pages/admin/maintenance/index.vue`, apply the same pattern.

- [ ] **Step 4: Run app tests/build**

Run:

```powershell
npm --workspace apps/driver-uni run test
npm --workspace apps/driver-uni run lint
npm --workspace apps/driver-uni run build:h5
```

Expected: PASS.

- [ ] **Step 5: Commit app adaptation**

Run:

```powershell
git add apps/driver-uni/src/api/client.ts apps/driver-uni/src/pages/admin/trips/index.vue apps/driver-uni/src/pages/admin/maintenance/index.vue
git commit -m "feat: 适配财务锁账错误提示"
```

Expected: commit only includes App error-handling changes. Do not accidentally stage older driver trip list feature files unless they are explicitly part of this commit.

## Task 10: Full Verification

**Files:**
- No code files modified.

- [ ] **Step 1: Backend verification**

Run:

```powershell
npm --workspace apps/api run db:generate
npm --workspace apps/api run test
npm --workspace apps/api run lint
```

Expected: all pass.

- [ ] **Step 2: Web verification**

Run:

```powershell
npm --workspace apps/admin-web run test
npm --workspace apps/admin-web run lint
npm --workspace apps/admin-web run build
```

Expected: all pass.

- [ ] **Step 3: App verification**

Run:

```powershell
npm --workspace apps/driver-uni run test
npm --workspace apps/driver-uni run lint
npm --workspace apps/driver-uni run build:h5
```

Expected: all pass.

- [ ] **Step 4: Manual smoke with local services**

Start or reuse services:

```powershell
npm run dev:api
npm run dev:admin
npm run dev:driver:h5
```

Smoke checklist:

- Login page button and layout unchanged.
- Web `/reports/monthly` loads and shows month rows.
- Web `/reports/periods` can close a test month.
- After close, manual completed billing for that month shows Chinese error and preserves page style.
- Reopen requires a reason.
- Web `/settings/backups` loads without exposing database download.
- App admin manual billing and maintenance show backend closed-month error via existing toast style.
- Driver-facing pages still do not show freight, profit, payroll, backup, close, or adjustment data.

- [ ] **Step 5: Final git check**

Run:

```powershell
git status --short --branch
git log --oneline -8
```

Expected: feature commits are present. Unrelated pre-existing dirty files are still either untouched or explicitly handled by user instruction.

## Spec Coverage Self-Review

- Financial correction: covered by Tasks 1, 4, 5, 7, 8.
- Monthly close/reopen: covered by Tasks 1, 2, 4, 8, 9.
- Profit filtering: covered by Task 5 and full verification in Task 10.
- Database-only monthly backup: covered by Tasks 1, 3, 6, 8.
- Small server capacity protection: covered by Task 3 tests and Task 6 scheduler.
- No unrelated UI impact: covered by Scope notes, Task 8 minimal CSS, Task 9 limited App changes, and Task 10 smoke checklist.
- Audit logging: covered by Tasks 4 and 5.
- App behavior: covered by Task 9.
- Testing: each implementation task has focused tests and Task 10 has full regression commands.
