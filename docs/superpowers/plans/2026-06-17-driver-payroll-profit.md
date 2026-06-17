# Driver Payroll Profit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add driver monthly payroll records, driver trip-count payroll lookup, and payroll-aware month/year profit reporting without breaking existing trip, maintenance, report, web, or app flows.

**Architecture:** Add a `DriverPayroll` Prisma model and admin API surface for payroll CRUD and trip-count lookup. Extend profit aggregation so month/year summaries include payroll as a top-level expense while week summaries keep payroll out and expose a notice. Web admin gets driver-management subpages for payroll and trip-count lookup plus profit subpages; app admin only adapts profit display.

**Tech Stack:** Prisma SQLite, Fastify API, Vitest, Next.js App Router, React server actions/client components, uni-app Vue admin pages.

---

## File Structure

- Modify `apps/api/prisma/schema.prisma`: add `DriverPayroll` model and relations.
- Create `apps/api/prisma/migrations/0010_driver_payroll/migration.sql`: payroll table and indexes.
- Modify `apps/api/src/app.ts`: payroll schemas, payroll CRUD routes, trip-count route, profit aggregation changes.
- Modify `apps/api/tests/api.test.ts`: regression tests for payroll CRUD, trip-count query, profit totals, role/team isolation.
- Modify `apps/admin-web/src/lib/api-client.ts`: payroll/report types.
- Modify `apps/admin-web/src/components/admin/admin-shell-client.tsx`: grouped/sub-nav support for driver and profit sections.
- Create `apps/admin-web/src/components/admin/payroll-model.ts`: money/month/trip-pay helper functions.
- Create `apps/admin-web/src/components/admin/payroll-model.test.ts`: web model tests.
- Create `apps/admin-web/src/app/drivers/payroll/page.tsx`: payroll list and create form.
- Create `apps/admin-web/src/app/drivers/payroll/[payrollId]/page.tsx`: payroll edit/delete page.
- Create `apps/admin-web/src/app/drivers/trip-payroll/page.tsx`: driver monthly trip-count lookup.
- Modify `apps/admin-web/src/app/reports/page.tsx`: profit overview with payroll cost.
- Create `apps/admin-web/src/app/reports/monthly/page.tsx`: monthly profit table.
- Create `apps/admin-web/src/app/reports/yearly/page.tsx`: yearly profit table.
- Create `apps/admin-web/src/app/reports/payroll/page.tsx`: payroll cost analysis.
- Modify `apps/admin-web/src/app/reports/export/route.ts`: export payroll-aware fields.
- Modify `apps/admin-web/src/app/page.tsx`: dashboard summary type compatibility.
- Modify `apps/admin-web/src/app/globals.css`: focused styles for sub-nav, payroll forms, profit breakdown.
- Modify `apps/driver-uni/src/api/client.ts`: report type additions and mapping.
- Modify `apps/driver-uni/src/pages/admin/reports/index.vue`: show payroll cost and week notice.
- Modify `apps/driver-uni/src/features/admin/manual-billing-model.test.ts` only if report type fixtures need shared setup changes; otherwise leave untouched.

---

## Task 1: Add Payroll Data Model and API Tests

**Files:**
- Modify: `apps/api/tests/api.test.ts`
- Later modified by Task 2: `apps/api/prisma/schema.prisma`, `apps/api/src/app.ts`

- [ ] **Step 1: Write failing tests for payroll CRUD**

Add tests near the existing admin finance/report tests in `apps/api/tests/api.test.ts`:

```ts
it("lets accountant create, update, list, and delete driver payroll records", async () => {
  const mock = await buildTestApp();

  const createResponse = await mock.app.inject({
    method: "POST",
    url: "/admin/driver-payrolls",
    headers: accountantHeaders,
    payload: {
      driverId,
      salaryMonth: "2026-06",
      type: "trip",
      amount: "1200.50",
      tripCount: 12,
      unitAmount: "100.00",
      paidAt: "2026-07-05",
      note: "6月趟次工资",
    },
  });

  expect(createResponse.statusCode).toBe(200);
  expect(createResponse.json().payroll).toMatchObject({
    driverId,
    salaryMonth: "2026-06",
    type: "trip",
    amount: "1200.50",
    tripCount: 12,
    unitAmount: "100.00",
  });

  const payrollId = createResponse.json().payroll.id;
  const updateResponse = await mock.app.inject({
    method: "POST",
    url: `/admin/driver-payrolls/${payrollId}`,
    headers: accountantHeaders,
    payload: {
      driverId,
      salaryMonth: "2026-06",
      type: "bonus",
      amount: "300.00",
      note: "安全奖金",
    },
  });

  expect(updateResponse.statusCode).toBe(200);
  expect(updateResponse.json().payroll.type).toBe("bonus");

  const listResponse = await mock.app.inject({
    method: "GET",
    url: "/admin/driver-payrolls?month=2026-06",
    headers: accountantHeaders,
  });

  expect(listResponse.statusCode).toBe(200);
  expect(listResponse.json().summary.totalAmount).toBe("300.00");
  expect(listResponse.json().payrolls.map((item: { id: string }) => item.id)).toContain(payrollId);

  const deleteResponse = await mock.app.inject({
    method: "POST",
    url: `/admin/driver-payrolls/${payrollId}/delete`,
    headers: accountantHeaders,
  });

  expect(deleteResponse.statusCode).toBe(200);
  expect(mock.state.driverPayrolls.some((item) => item.id === payrollId)).toBe(false);
});
```

- [ ] **Step 2: Write failing tests for validation and driver-only denial**

```ts
it("validates driver payroll month, amount, and role", async () => {
  const mock = await buildTestApp();

  const invalidMonth = await mock.app.inject({
    method: "POST",
    url: "/admin/driver-payrolls",
    headers: accountantHeaders,
    payload: { driverId, salaryMonth: "2026-6", type: "fixed", amount: "1000" },
  });
  expect(invalidMonth.statusCode).toBe(400);

  const invalidAmount = await mock.app.inject({
    method: "POST",
    url: "/admin/driver-payrolls",
    headers: accountantHeaders,
    payload: { driverId, salaryMonth: "2026-06", type: "fixed", amount: "m" },
  });
  expect(invalidAmount.statusCode).toBe(400);

  const forbidden = await mock.app.inject({
    method: "POST",
    url: "/admin/driver-payrolls",
    headers: driverHeaders,
    payload: { driverId, salaryMonth: "2026-06", type: "fixed", amount: "1000" },
  });
  expect(forbidden.statusCode).toBe(403);
});
```

- [ ] **Step 3: Write failing tests for trip-count payroll lookup**

```ts
it("counts primary and assistant completed trips for driver payroll lookup", async () => {
  const mock = await buildTestApp();

  mock.state.trips.push({
    ...mock.state.trips[0],
    id: "assistant-completed-trip",
    tripNo: "HH-ASSIST-001",
    driverId: "driver-2",
    driver: mock.state.users.find((user) => user.id === "driver-2")!,
    status: "completed",
    completedAt: new Date("2026-06-18T08:00:00.000Z"),
    assistantDrivers: [{ driver: mock.state.users.find((user) => user.id === driverId)! }],
  });

  const response = await mock.app.inject({
    method: "GET",
    url: `/admin/driver-payrolls/trip-count?driverId=${driverId}&month=2026-06`,
    headers: accountantHeaders,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().summary).toMatchObject({
    primaryTripCount: 1,
    assistantTripCount: 1,
    payrollTripCount: 2,
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm --workspace apps/api run test -- tests/api.test.ts`

Expected: FAIL because `/admin/driver-payrolls` routes and mock state do not exist yet.

---

## Task 2: Implement Payroll Schema, Mock State, and API Routes

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/0010_driver_payroll/migration.sql`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: Add Prisma model**

In `User`, add:

```prisma
  payrollRecords DriverPayroll[] @relation("DriverPayrollDriver")
  createdPayrollRecords DriverPayroll[] @relation("DriverPayrollCreator")
```

In `Team`, add:

```prisma
  driverPayrolls DriverPayroll[]
```

Add model:

```prisma
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
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  team    Team @relation(fields: [teamId], references: [id])
  driver  User @relation("DriverPayrollDriver", fields: [driverId], references: [id])
  creator User @relation("DriverPayrollCreator", fields: [createdBy], references: [id])

  @@index([teamId, salaryMonth])
  @@index([teamId, driverId, salaryMonth])
  @@index([teamId, type, salaryMonth])
}
```

- [ ] **Step 2: Add SQL migration**

Create `apps/api/prisma/migrations/0010_driver_payroll/migration.sql`:

```sql
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
```

- [ ] **Step 3: Add route constants and serializers**

In `apps/api/src/app.ts`, near other schemas:

```ts
const payrollTypes = ["fixed", "trip", "bonus", "deduction", "other"] as const;
const salaryMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "工资月份格式应为 YYYY-MM");
const payrollPayloadSchema = z.object({
  driverId: z.string().min(1),
  salaryMonth: salaryMonthSchema,
  type: z.enum(payrollTypes),
  amount: decimalStringSchema,
  tripCount: z.coerce.number().int().min(0).optional(),
  unitAmount: decimalStringSchema.optional(),
  paidAt: z.string().optional(),
  note: z.string().optional(),
});
```

Add helpers:

```ts
function salaryMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    start: new Date(year, monthNumber - 1, 1),
    end: new Date(year, monthNumber, 0, 23, 59, 59, 999),
  };
}

function serializeDriverPayroll(payroll: DriverPayroll & { driver: User; creator?: User | null }) {
  return {
    id: payroll.id,
    teamId: payroll.teamId,
    driverId: payroll.driverId,
    driverName: payroll.driver.name,
    salaryMonth: payroll.salaryMonth,
    type: payroll.type,
    amount: payroll.amount.toString(),
    tripCount: payroll.tripCount,
    unitAmount: payroll.unitAmount?.toString() ?? null,
    paidAt: payroll.paidAt ? payroll.paidAt.toISOString().slice(0, 10) : null,
    note: payroll.note,
    createdBy: payroll.createdBy,
    creatorName: payroll.creator?.name ?? null,
    createdAt: payroll.createdAt.toISOString(),
    updatedAt: payroll.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 4: Add payroll list and detail routes**

Add before `/admin/reports/profit`:

```ts
app.get("/admin/driver-payrolls", async (request) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const query = z.object({
    month: salaryMonthSchema.optional(),
    driverId: z.string().optional(),
    type: z.enum(payrollTypes).optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  }).parse(request.query);
  const teamId = scopedTeamId(user);
  const where = {
    ...(teamId ? { teamId } : {}),
    ...(query.month ? { salaryMonth: query.month } : {}),
    ...(query.driverId ? { driverId: query.driverId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.q?.trim() ? { driver: { name: { contains: query.q.trim() } } } : {}),
  };
  const [payrolls, total] = await Promise.all([
    prisma.driverPayroll.findMany({
      where,
      include: { driver: true, creator: true },
      orderBy: [{ salaryMonth: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.driverPayroll.count({ where }),
  ]);
  const totalAmount = payrolls.reduce((sum, item) => sum + Number(item.amount), 0);
  return {
    payrolls: payrolls.map(serializeDriverPayroll),
    page: query.page,
    pageSize: query.pageSize,
    total,
    summary: { totalAmount: totalAmount.toFixed(2) },
  };
});
```

Add detail route:

```ts
app.get("/admin/driver-payrolls/:payrollId", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const { payrollId } = z.object({ payrollId: z.string() }).parse(request.params);
  const teamId = scopedTeamId(user);
  const payroll = await prisma.driverPayroll.findFirst({
    where: { id: payrollId, ...(teamId ? { teamId } : {}) },
    include: { driver: true, creator: true },
  });
  if (!payroll) {
    return reply.code(404).send({ message: "工资记录不存在或已被删除" });
  }
  return { payroll: serializeDriverPayroll(payroll) };
});
```

- [ ] **Step 5: Add create/update/delete payroll routes**

Create route:

```ts
app.post("/admin/driver-payrolls", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const body = payrollPayloadSchema.parse(request.body);
  const teamId = requiredTeamId(user);
  const driver = await prisma.user.findFirst({
    where: { id: body.driverId, role: "driver", teamId },
  });
  if (!driver) return reply.code(404).send({ message: "司机不存在或不属于当前团队" });

  const payroll = await prisma.driverPayroll.create({
    data: {
      teamId,
      driverId: body.driverId,
      salaryMonth: body.salaryMonth,
      type: body.type,
      amount: body.amount,
      tripCount: body.tripCount ?? null,
      unitAmount: body.unitAmount || null,
      paidAt: body.paidAt ? localDateBoundary(body.paidAt, "start") : null,
      note: body.note || null,
      createdBy: user.id,
    },
    include: { driver: true, creator: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      teamId,
      targetType: "DriverPayroll",
      targetId: payroll.id,
      action: "driver_payroll.created",
      before: null,
      after: JSON.stringify(serializeDriverPayroll(payroll)),
    },
  });

  return { payroll: serializeDriverPayroll(payroll) };
});
```

Update route uses the same schema, fetches the existing payroll by `{ id, teamId }`, validates the new driver by `{ id: body.driverId, role: "driver", teamId }`, updates all editable fields, and writes `driver_payroll.updated` audit with serialized before/after payloads.

Delete route fetches by `{ id, teamId }`, deletes the row, and writes `driver_payroll.deleted` audit with serialized `before` and `after: null`.

- [ ] **Step 6: Add trip-count lookup route**

```ts
app.get("/admin/driver-payrolls/trip-count", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const query = z.object({
    month: salaryMonthSchema,
    driverId: z.string().min(1),
  }).parse(request.query);
  const teamId = scopedTeamId(user);
  const { start, end } = salaryMonthRange(query.month);
  const driver = await prisma.user.findFirst({
    where: { id: query.driverId, role: "driver", ...(teamId ? { teamId } : {}) },
  });
  if (!driver) return reply.code(404).send({ message: "司机不存在或不属于当前团队" });
  const trips = await prisma.trip.findMany({
    where: {
      status: "completed",
      completedAt: { gte: start, lte: end },
      ...(teamId ? { teamId } : {}),
      OR: [
        { driverId: query.driverId },
        { assistantDrivers: { some: { driverId: query.driverId } } },
      ],
    },
    include: { vehicle: true, driver: true, assistantDrivers: { include: { driver: true } } },
    orderBy: { completedAt: "asc" },
  });
  const primaryTrips = trips.filter((trip) => trip.driverId === query.driverId);
  const assistantTrips = trips.filter((trip) => trip.driverId !== query.driverId);
  return {
    driver: { id: driver.id, name: driver.name },
    month: query.month,
    summary: {
      primaryTripCount: primaryTrips.length,
      assistantTripCount: assistantTrips.length,
      payrollTripCount: trips.length,
    },
    trips: trips.map((trip) => ({
      id: trip.id,
      tripNo: trip.tripNo,
      completedAt: trip.completedAt?.toISOString() ?? null,
      vehiclePlateNumber: trip.vehicle.plateNumber,
      customerName: trip.customerName,
      route: `${trip.loadLocation} → ${trip.unloadLocation}`,
      role: trip.driverId === query.driverId ? "primary" : "assistant",
      actualFreight: trip.actualFreight?.toString() ?? null,
    })),
  };
});
```

- [ ] **Step 7: Update API test mocks**

In the mock state builder, add `driverPayrolls: []`. Add mocked Prisma methods:

```ts
driverPayroll: {
  findMany: async ({ where, include }: { where?: any; include?: any } = {}) =>
    state.driverPayrolls.filter((item) => matchesPayrollWhere(item, where)).map((item) => ({
      ...item,
      driver: state.users.find((user) => user.id === item.driverId)!,
      creator: state.users.find((user) => user.id === item.createdBy)!,
    })),
  count: async ({ where }: { where?: any } = {}) =>
    state.driverPayrolls.filter((item) => matchesPayrollWhere(item, where)).length,
  create: async ({ data }: { data: any }) => {
    const created = { id: "payroll-created", createdAt: new Date(), updatedAt: new Date(), ...data };
    state.driverPayrolls.push(created);
    return { ...created, driver: state.users.find((user) => user.id === created.driverId)! };
  },
  update: async ({ where, data }: { where: { id: string }; data: any }) => {
    const index = state.driverPayrolls.findIndex((item) => item.id === where.id);
    state.driverPayrolls[index] = { ...state.driverPayrolls[index], ...data, updatedAt: new Date() };
    const updated = state.driverPayrolls[index];
    return { ...updated, driver: state.users.find((user) => user.id === updated.driverId)! };
  },
  delete: async ({ where }: { where: { id: string } }) => {
    const deleted = state.driverPayrolls.find((item) => item.id === where.id)!;
    state.driverPayrolls = state.driverPayrolls.filter((item) => item.id !== where.id);
    return deleted;
  },
  findFirst: async ({ where }: { where?: any } = {}) =>
    state.driverPayrolls.find((item) => matchesPayrollWhere(item, where)) ?? null,
}
```

- [ ] **Step 8: Run API tests**

Run: `npm --workspace apps/api run test -- tests/api.test.ts`

Expected: all API tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/0010_driver_payroll/migration.sql apps/api/src/app.ts apps/api/tests/api.test.ts
git commit -m "feat: add driver payroll api"
```

---

## Task 3: Extend Profit Aggregation With Payroll

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: Write failing profit tests**

Add API tests:

```ts
it("includes driver payroll in monthly and yearly profit totals", async () => {
  const mock = await buildTestApp();
  mock.state.driverPayrolls.push({
    id: "payroll-1",
    teamId: teamId,
    driverId,
    salaryMonth: "2026-06",
    type: "fixed",
    amount: decimal("1000.00"),
    tripCount: null,
    unitAmount: null,
    paidAt: new Date("2026-07-05T00:00:00.000Z"),
    note: null,
    createdBy: accountantId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const response = await mock.app.inject({
    method: "GET",
    url: "/admin/reports/profit?period=month&from=2026-06-01&to=2026-06-30",
    headers: accountantHeaders,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().summary.driverPayrollTotal).toBe("1000.00");
  expect(response.json().summary.expenseTotal).toBe("1200.00");
  expect(response.json().summary.profitTotal).toBe("17800.00");
  expect(response.json().byPeriod[0].driverPayrollTotal).toBe("1000.00");
});

it("does not include driver payroll in weekly profit totals", async () => {
  const mock = await buildTestApp();
  mock.state.driverPayrolls.push({
    id: "payroll-1",
    teamId: teamId,
    driverId,
    salaryMonth: "2026-06",
    type: "fixed",
    amount: decimal("1000.00"),
    tripCount: null,
    unitAmount: null,
    paidAt: new Date("2026-07-05T00:00:00.000Z"),
    note: null,
    createdBy: accountantId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const response = await mock.app.inject({
    method: "GET",
    url: "/admin/reports/profit?period=week&from=2026-06-01&to=2026-06-30",
    headers: accountantHeaders,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().summary.driverPayrollTotal).toBe("0.00");
  expect(response.json().summary.payrollNotice).toContain("按月归属");
});
```

- [ ] **Step 2: Query payroll records in report route**

In `/admin/reports/profit`, compute salary month filters from `from/to`:

```ts
const payrollMonths = period === "week" ? [] : monthsBetween(query.from, query.to);
const payrollRecords = period === "week"
  ? []
  : await prisma.driverPayroll.findMany({
      where: {
        ...(teamId ? { teamId } : {}),
        ...(payrollMonths.length > 0 ? { salaryMonth: { in: payrollMonths } } : {}),
      },
      include: { driver: true },
    });
```

Add `monthsBetween(from?: string, to?: string)` helper returning `["2026-06"]` for June range.

- [ ] **Step 3: Add payroll to period and expense groups**

For each payroll:

```ts
const amount = Number(payroll.amount);
const expenseGroup = byExpenseType.get("driver-payroll") ?? {
  id: "driver-payroll",
  label: "司机工资",
  total: 0,
};
expenseGroup.total += amount;
byExpenseType.set("driver-payroll", expenseGroup);

const periodGroup = getPeriodGroup(new Date(`${payroll.salaryMonth}-01T00:00:00.000Z`));
periodGroup.driverPayrollTotal += amount;
periodGroup.totalExpense += amount;
periodGroup.profitTotal -= amount;
```

Add `driverPayrollTotal: 0` to `byPeriod` group initialization and serialization.

- [ ] **Step 4: Update summary**

```ts
const driverPayrollTotal = period === "week"
  ? 0
  : payrollRecords.reduce((total, item) => total + Number(item.amount), 0);
const totalExpense = tripExpenseTotal + maintenanceExpenseTotal + driverPayrollTotal;
```

Return:

```ts
driverPayrollTotal: driverPayrollTotal.toFixed(2),
profitRate: actualFreightTotal > 0 ? ((actualFreightTotal - totalExpense) / actualFreightTotal).toFixed(4) : null,
payrollNotice: period === "week" ? "司机工资按月归属，不计入周度统计。" : null,
```

- [ ] **Step 5: Run tests**

Run: `npm --workspace apps/api run test -- tests/api.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.ts apps/api/tests/api.test.ts
git commit -m "feat: include payroll in profit reports"
```

---

## Task 4: Add Web API Types and Payroll Model Tests

**Files:**
- Modify: `apps/admin-web/src/lib/api-client.ts`
- Create: `apps/admin-web/src/components/admin/payroll-model.ts`
- Create: `apps/admin-web/src/components/admin/payroll-model.test.ts`

- [ ] **Step 1: Add failing web model tests**

```ts
import { describe, expect, it } from "vitest";
import { calculateTripPayrollAmount, isSalaryMonth, payrollTypeLabel } from "./payroll-model";

describe("payroll model", () => {
  it("validates salary month values", () => {
    expect(isSalaryMonth("2026-06")).toBe(true);
    expect(isSalaryMonth("2026-6")).toBe(false);
    expect(isSalaryMonth("2026-13")).toBe(false);
  });

  it("calculates trip payroll amount", () => {
    expect(calculateTripPayrollAmount("12", "100.50")).toBe("1206.00");
    expect(calculateTripPayrollAmount("m", "100")).toBeNull();
  });

  it("labels payroll types", () => {
    expect(payrollTypeLabel("fixed")).toBe("固定工资");
    expect(payrollTypeLabel("deduction")).toBe("扣款/调整");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm --workspace apps/admin-web run test -- src/components/admin/payroll-model.test.ts`

Expected: FAIL because model file is missing.

- [ ] **Step 3: Implement model**

```ts
export const payrollTypes = ["fixed", "trip", "bonus", "deduction", "other"] as const;
export type PayrollType = (typeof payrollTypes)[number];

export function isSalaryMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function payrollTypeLabel(type: string) {
  const labels: Record<string, string> = {
    fixed: "固定工资",
    trip: "趟次工资",
    bonus: "奖金/补贴",
    deduction: "扣款/调整",
    other: "其他",
  };
  return labels[type] ?? type;
}

export function calculateTripPayrollAmount(tripCount: string, unitAmount: string) {
  if (!/^\d+$/.test(tripCount)) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(unitAmount)) return null;
  return (Number(tripCount) * Number(unitAmount)).toFixed(2);
}
```

- [ ] **Step 4: Add API types**

Add `ApiDriverPayroll`, `DriverPayrollList`, `DriverPayrollTripCount`, and extend `ProfitSummary` / `ProfitPeriodGroup`:

```ts
export interface ApiDriverPayroll {
  id: string;
  driverId: string;
  driverName: string;
  salaryMonth: string;
  type: "fixed" | "trip" | "bonus" | "deduction" | "other" | string;
  amount: string;
  tripCount: number | null;
  unitAmount: string | null;
  paidAt: string | null;
  note: string | null;
}
```

- [ ] **Step 5: Run web model tests**

Run: `npm --workspace apps/admin-web run test -- src/components/admin/payroll-model.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/lib/api-client.ts apps/admin-web/src/components/admin/payroll-model.ts apps/admin-web/src/components/admin/payroll-model.test.ts
git commit -m "feat: add web payroll models"
```

---

## Task 5: Add Web Driver Payroll Pages

**Files:**
- Create: `apps/admin-web/src/app/drivers/payroll/page.tsx`
- Create: `apps/admin-web/src/app/drivers/payroll/[payrollId]/page.tsx`
- Create: `apps/admin-web/src/app/drivers/trip-payroll/page.tsx`
- Modify: `apps/admin-web/src/app/globals.css`

- [ ] **Step 1: Create payroll list page**

Create a server page that:

- Reads `month`, `driverId`, `type`, `q`.
- Fetches `/admin/drivers` and `/admin/driver-payrolls`.
- Renders summary cards and table.
- Provides a create form posting to `createPayrollAction`.

Action payload:

```ts
await apiPost("/admin/driver-payrolls", {
  driverId: String(formData.get("driverId")),
  salaryMonth: String(formData.get("salaryMonth")),
  type: String(formData.get("type")),
  amount: String(formData.get("amount")),
  tripCount: formData.get("tripCount") ? Number(formData.get("tripCount")) : undefined,
  unitAmount: String(formData.get("unitAmount") || ""),
  paidAt: String(formData.get("paidAt") || ""),
  note: String(formData.get("note") || ""),
});
```

- [ ] **Step 2: Create payroll edit page**

Fetch `GET /admin/driver-payrolls/:payrollId`, render the same fields as the create form, and post updates to `POST /admin/driver-payrolls/:payrollId`. Add a delete form that posts to `POST /admin/driver-payrolls/:payrollId/delete` and redirects back to `/drivers/payroll`.

- [ ] **Step 3: Create trip-count lookup page**

Fetch drivers and call:

`/admin/driver-payrolls/trip-count?driverId=${driverId}&month=${month}`

Render cards:

- 主司机趟次
- 协同趟次
- 合计计薪趟次

Render trip table with `role` label.

- [ ] **Step 4: Add styles**

Add focused classes:

```css
.subpage-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.payroll-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.payroll-form-grid { display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 12px; align-items: end; }
.payroll-role-chip { border-radius: 999px; padding: 4px 8px; background: var(--brand-50); color: var(--brand-900); font-weight: 800; }
```

- [ ] **Step 5: Run web checks**

Run:

```bash
npm --workspace apps/admin-web run lint
npm --workspace apps/admin-web run build
```

Expected: 0 errors; existing vehicle image warnings may remain.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/app/drivers/payroll apps/admin-web/src/app/drivers/trip-payroll apps/admin-web/src/app/globals.css
git commit -m "feat: add web driver payroll pages"
```

---

## Task 6: Add Navigation Subitems

**Files:**
- Modify: `apps/admin-web/src/components/admin/admin-shell-client.tsx`
- Modify: `apps/admin-web/src/app/globals.css`

- [ ] **Step 1: Convert nav items to support children**

Update `navItems` entries:

```ts
{
  href: "/drivers",
  label: "司机管理",
  icon: Users,
  children: [
    { href: "/drivers", label: "司机档案" },
    { href: "/drivers/payroll", label: "工资记录" },
    { href: "/drivers/trip-payroll", label: "趟次计薪查询" },
  ],
},
{
  href: "/reports",
  label: "利润统计",
  icon: BarChart3,
  children: [
    { href: "/reports", label: "利润总览" },
    { href: "/reports/monthly", label: "月度利润" },
    { href: "/reports/yearly", label: "年度利润" },
    { href: "/reports/payroll", label: "工资成本" },
  ],
},
```

- [ ] **Step 2: Render children only when section is active**

Inside nav map after parent link:

```tsx
{isActive && item.children ? (
  <div className="nav-sub-list">
    {item.children.map((child) => {
      const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
      return (
        <Link className={childActive ? "nav-sub-item active" : "nav-sub-item"} href={child.href} key={child.href}>
          {child.label}
        </Link>
      );
    })}
  </div>
) : null}
```

- [ ] **Step 3: Add styles**

```css
.nav-sub-list { display: grid; gap: 4px; margin: -4px 0 6px 36px; }
.nav-sub-item { border-radius: 10px; color: var(--text-muted); padding: 7px 10px; font-size: 13px; font-weight: 800; text-decoration: none; }
.nav-sub-item.active, .nav-sub-item:hover { background: var(--brand-50); color: var(--brand-900); }
```

- [ ] **Step 4: Run web tests**

Run: `npm --workspace apps/admin-web run test`

Expected: existing `admin-shell-client.test.ts` may need updates for new subitems. Update snapshots/assertions only for intended nav text.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-web/src/components/admin/admin-shell-client.tsx apps/admin-web/src/app/globals.css apps/admin-web/src/components/admin/admin-shell-client.test.ts
git commit -m "feat: add payroll report subnavigation"
```

---

## Task 7: Upgrade Web Profit Pages

**Files:**
- Modify: `apps/admin-web/src/app/reports/page.tsx`
- Create: `apps/admin-web/src/app/reports/monthly/page.tsx`
- Create: `apps/admin-web/src/app/reports/yearly/page.tsx`
- Create: `apps/admin-web/src/app/reports/payroll/page.tsx`
- Modify: `apps/admin-web/src/app/reports/export/route.ts`
- Modify: `apps/admin-web/src/app/page.tsx`
- Modify: `apps/admin-web/src/app/globals.css`

- [ ] **Step 1: Update profit overview**

Add payroll metric card and expense breakdown:

```tsx
<article className="metric-card">
  <span>司机工资</span>
  <strong>{formatMoney(summary.driverPayrollTotal)}</strong>
  <small>{summary.payrollNotice ?? "按工资月份计入月/年利润"}</small>
</article>
```

Update text: 总支出 = 趟次 + 维修 + 工资.

- [ ] **Step 2: Create monthly page**

Fetch `/admin/reports/profit?period=month&from=${year}-01-01&to=${year}-12-31`.

Render table with `driverPayrollTotal`.

- [ ] **Step 3: Create yearly page**

Use `period=year`; render year rows. If only current year is needed first, default range to current year.

- [ ] **Step 4: Create payroll cost page**

Fetch `/admin/driver-payrolls?month=${month}&pageSize=100` and `/admin/reports/profit?period=month&from=${month}-01&to=${monthEnd}`.

Render:

- 工资总额
- 工资占收入比例
- 每趟平均工资成本
- 按类型汇总
- 司机工资排行

- [ ] **Step 5: Update export route**

Add `driverPayrollTotal` to CSV header and rows.

- [ ] **Step 6: Run checks**

Run:

```bash
npm --workspace apps/admin-web run test
npm --workspace apps/admin-web run lint
npm --workspace apps/admin-web run build
```

Expected: PASS with no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-web/src/app/reports apps/admin-web/src/app/page.tsx apps/admin-web/src/app/globals.css
git commit -m "feat: add payroll-aware profit analysis"
```

---

## Task 8: Adapt App Admin Profit Display

**Files:**
- Modify: `apps/driver-uni/src/api/client.ts`
- Modify: `apps/driver-uni/src/pages/admin/reports/index.vue`

- [ ] **Step 1: Update app report types**

Add:

```ts
driverPayrollTotal: string;
profitRate?: string | null;
payrollNotice?: string | null;
```

to summary and `driverPayrollTotal` to byPeriod items.

- [ ] **Step 2: Update empty report**

```ts
driverPayrollTotal: "¥ 0.00",
profitRate: null,
payrollNotice: null,
```

- [ ] **Step 3: Update UI**

In metric grid add:

```vue
<view><text>司机工资</text><text>{{ report.summary.driverPayrollTotal }}</text></view>
```

In hero subtitle:

```vue
<text>{{ report.summary.tripCount }} 趟 · 工资 {{ report.summary.driverPayrollTotal }} · 总支出 {{ report.summary.expenseTotal }}</text>
```

Show notice:

```vue
<view v-if="report.summary.payrollNotice" class="notice-card">{{ report.summary.payrollNotice }}</view>
```

- [ ] **Step 4: Run app checks**

Run:

```bash
npm --workspace apps/driver-uni run lint
npm --workspace apps/driver-uni run test
npm --workspace apps/driver-uni run build:h5
npm --workspace apps/driver-uni run build:mp-weixin
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/driver-uni/src/api/client.ts apps/driver-uni/src/pages/admin/reports/index.vue
git commit -m "feat: show payroll cost in app reports"
```

---

## Task 9: Full Verification and Deployment Prep

**Files:**
- No code changes expected.

- [ ] **Step 1: Validate Prisma schema**

Run:

```powershell
$env:DATABASE_URL='file:E:/code/HaulHub/apps/api/prisma/dev.db'
npx prisma validate --schema apps/api/prisma/schema.prisma
```

Expected: schema valid.

- [ ] **Step 2: Run full workspace tests**

Run:

```bash
npm run lint --workspaces --if-present
npm run test --workspaces --if-present
```

Expected: no errors. Existing web vehicle `<img>` warnings can remain if unchanged.

- [ ] **Step 3: Run production builds**

Run:

```bash
npm --workspace apps/admin-web run build
npm --workspace apps/driver-uni run build:h5
npm --workspace apps/driver-uni run build:mp-weixin
```

Expected: builds complete.

- [ ] **Step 4: Smoke test locally**

Verify:

- `/admin/driver-payrolls` API creates payroll.
- `/admin/driver-payrolls/trip-count` returns primary + assistant counts.
- `/admin/reports/profit?period=month` includes payroll.
- Web `/drivers/payroll`, `/drivers/trip-payroll`, `/reports`, `/reports/monthly`, `/reports/yearly`, `/reports/payroll` render.
- App H5 `/pages/admin/reports/index` renders payroll field.

- [ ] **Step 5: Confirm no uncommitted verification fixes**

Run:

```bash
git status --short
```

Expected: no unstaged business-code changes. If verification created legitimate fixes, stage the exact files shown by `git status --short` and commit them with `git commit -m "fix: stabilize payroll profit reporting"`.

- [ ] **Step 6: Deployment note**

Before server deployment, include `apps/api/prisma/migrations/0010_driver_payroll/migration.sql`. Server deploy must run:

```bash
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Expected: `0010_driver_payroll` applied or no pending migrations if already applied.
