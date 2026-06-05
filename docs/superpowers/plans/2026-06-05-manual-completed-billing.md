# Manual Completed Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin workflow that records an already-completed external trip, creates expenses and a settlement snapshot, and feeds the existing profit reports.

**Architecture:** Reuse the existing `Trip` + `Expense` + `SettlementSnapshot` model instead of adding a separate billing table. The API creates manual completed trips in one transaction, while the admin web adds a dedicated form page and lightweight model helpers for expense-mode switching and profit preview.

**Tech Stack:** Fastify, Prisma, Zod, Vitest, Next.js App Router, React, TypeScript, `@haulhub/shared` finance helpers.

---

## File Structure

- Modify `apps/api/src/app.ts`: add request schemas, helper functions, `POST /admin/trips/manual-completed`, and admin receipt image endpoints.
- Modify `apps/api/tests/api.test.ts`: extend the Prisma mock for transactions and add API coverage for manual completed billing and admin receipt uploads.
- Modify `apps/admin-web/src/lib/api-client.ts`: add fields needed by the manual billing form, mainly `ApiExpense.expenseTypeId` if missing in the implementation branch.
- Create `apps/admin-web/src/components/admin/manual-completed-billing-model.ts`: pure helpers for form expense modes, totals, profit, and payload shaping.
- Create `apps/admin-web/src/components/admin/manual-completed-billing-model.test.ts`: unit coverage for totals, mode exclusivity, and zero-freight profit-rate display.
- Create `apps/admin-web/src/components/admin/manual-completed-billing-form.tsx`: client component for vehicle/driver filtering, expense entry, mode switching, and preview.
- Create `apps/admin-web/src/app/trips/manual-completed/new/page.tsx`: server page and server action for creating the manual completed bill.
- Modify `apps/admin-web/src/app/trips/page.tsx`: add entry link beside the existing create-trip button.
- Modify `apps/admin-web/src/app/reports/page.tsx`: add a secondary entry link for historical billing.
- Modify `apps/admin-web/src/app/trips/[tripId]/page.tsx`: show optional admin receipt upload controls for expense rows.

Do not modify the Prisma schema for this first version.

---

### Task 1: API Tests for Manual Completed Billing

**Files:**
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: Extend the mock state for transactional writes**

Add these fields inside `createPrismaMock().state`:

```ts
manualTrips: [] as unknown[],
manualExpenses: [] as unknown[],
manualSettlements: [] as unknown[],
expenseTypes: [
  { id: "expense-type-1", name: "油费", requiresReceipt: true, enabled: true, sortOrder: 1 },
  { id: "expense-type-2", name: "过路费", requiresReceipt: false, enabled: true, sortOrder: 2 },
],
```

Add a Prisma transaction wrapper at the same level as `trip`, `expense`, and `expenseType`:

```ts
$transaction: async <T>(callback: (tx: unknown) => Promise<T>) => callback(mock.prisma),
```

If TypeScript cannot reference `mock.prisma` before return initialization, replace it with a local `const prisma = { ... }` object and return `{ state, prisma }`.

- [ ] **Step 2: Make `trip.create`, `trip.findFirst`, `expense.create`, and settlement mock calls record writes**

Change `trip.create` to push the created manual trip:

```ts
create: async ({ data, include }: { data: Record<string, unknown>; include?: unknown }) => {
  const created = {
    ...tripSnapshot(),
    ...data,
    id: "trip-created",
    tripNo: String(data.tripNo ?? "HH20260527120000"),
    status: String(data.status ?? "assigned"),
    createdAt: new Date("2026-05-27T12:00:00.000Z"),
    completedAt: data.completedAt instanceof Date ? data.completedAt : null,
    submittedAt: null,
    reviewStartedAt: null,
    actualFreight: data.actualFreight ? decimal(String(data.actualFreight)) : null,
    estimatedFreight: data.estimatedFreight ? decimal(String(data.estimatedFreight)) : null,
    expenses: [],
    settlement: null,
    vehicle: { id: String(data.vehicleId), plateNumber: "沪A12345" },
    driver: { id: String(data.driverId), name: "司机老李" },
  };
  state.manualTrips.push(created);
  return created;
},
```

Update `trip.findFirst` so a freshly created manual trip can be read back by id:

```ts
findFirst: async (args: { where?: Record<string, unknown> } = {}) => {
  state.tripFindFirstArgs.push(args);
  const where = args.where ?? {};
  const manualTrip = state.manualTrips.find(
    (item) => typeof item === "object" && item != null && "id" in item && item.id === where.id,
  ) as ReturnType<typeof tripSnapshot> | undefined;
  if (manualTrip) {
    return {
      ...manualTrip,
      expenses: state.manualExpenses,
      settlement: state.manualSettlements[0]
        ? { profitRate: state.manualSettlements[0].profitRate }
        : null,
    };
  }

  const statusFilter = where.status as { in?: unknown } | string | undefined;
  const isConflictQuery =
    statusFilter === "in_progress" ||
    (typeof statusFilter === "object" && Array.isArray(statusFilter.in));
  if (isConflictQuery) {
    if (!state.conflictingTrip) return null;
    return {
      ...tripSnapshot(),
      id: state.conflictingTrip.id,
      status: state.conflictingTrip.status,
      vehicleId: state.conflictingTrip.vehicleId,
      driverId: state.conflictingTrip.driverId,
    };
  }

  if (typeof where.id === "string" && where.id !== tripId) {
    return null;
  }

  return tripSnapshot();
},
```

Change `expense.create` to record expenses:

```ts
create: async ({ data }: { data: Record<string, unknown> }) => {
  const created = {
    id: `expense-created-${state.manualExpenses.length + 1}`,
    ...data,
    amount: decimal(String(data.amount)),
    occurredAt: data.occurredAt instanceof Date ? data.occurredAt : new Date(String(data.occurredAt)),
    receiptImages: [],
    expenseType: { requiresReceipt: false },
  };
  state.manualExpenses.push(created);
  return created;
},
```

Add `settlementSnapshot.create` next to `settlementSnapshot.findMany`:

```ts
create: async ({ data }: { data: Record<string, unknown> }) => {
  const created = {
    id: "settlement-created",
    ...data,
    actualFreight: decimal(String(data.actualFreight)),
    expenseTotal: decimal(String(data.expenseTotal)),
    profit: decimal(String(data.profit)),
    profitRate: data.profitRate == null ? null : decimal(String(data.profitRate)),
    settledAt: data.settledAt instanceof Date ? data.settledAt : new Date(String(data.settledAt)),
  };
  state.manualSettlements.push(created);
  return created;
},
```

- [ ] **Step 3: Update expense type mock lookups**

Replace `expenseType.findFirst` and `expenseType.findMany` with versions that respect id, name, team, and enabled filters:

```ts
findFirst: async ({ where }: { where?: { id?: string; name?: string; enabled?: boolean; teamId?: string } } = {}) => {
  const found = state.expenseTypes.find((type) => {
    if (where?.id && type.id !== where.id) return false;
    if (where?.name && type.name !== where.name) return false;
    if (where?.enabled != null && type.enabled !== where.enabled) return false;
    return true;
  });
  return found ?? null;
},
findMany: async (args: unknown = {}) => {
  state.expenseTypeFindManyArgs = args;
  return state.expenseTypes;
},
create: async ({ data }: { data: Record<string, unknown> }) => {
  const created = {
    id: "expense-type-created",
    name: String(data.name),
    requiresReceipt: Boolean(data.requiresReceipt),
    enabled: Boolean(data.enabled ?? true),
    sortOrder: Number(data.sortOrder ?? 999),
  };
  state.expenseTypes.push(created);
  return created;
},
```

- [ ] **Step 4: Write the failing success test for detailed expenses**

Add this test near the existing admin trip tests:

```ts
it("creates a manual completed trip with detailed expenses and a settlement snapshot", async () => {
  const app = buildApp(mock.prisma as never);
  const response = await app.inject({
    method: "POST",
    url: "/admin/trips/manual-completed",
    headers: { "x-user-id": accountantId, "x-user-role": "accountant" },
    payload: {
      vehicleId: "vehicle-1",
      driverId,
      customerName: "恒通物流",
      loadLocation: "上海",
      unloadLocation: "杭州",
      actualFreight: "1000.00",
      settledAt: "2026-05-20",
      accountingNote: "历史补录",
      expenses: [
        { expenseTypeId: "expense-type-1", amount: "300.00", occurredAt: "2026-05-20", note: "油费" },
        { expenseTypeId: "expense-type-2", amount: "40.50", occurredAt: "2026-05-20", note: "过路费" },
      ],
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().trip.status).toBe("completed");
  expect(mock.state.manualExpenses).toHaveLength(2);
  expect(mock.state.manualSettlements[0]).toMatchObject({
    actualFreight: expect.objectContaining({ toString: expect.any(Function) }),
    expenseTotal: expect.objectContaining({ toString: expect.any(Function) }),
    profit: expect.objectContaining({ toString: expect.any(Function) }),
  });
  expect(mock.state.manualSettlements[0].expenseTotal.toString()).toBe("340.50");
  expect(mock.state.manualSettlements[0].profit.toString()).toBe("659.50");
  expect(mock.state.manualSettlements[0].settledAt.toISOString()).toBe("2026-05-20T00:00:00.000Z");
  expect(mock.state.auditLogs.at(-1)).toMatchObject({
    action: "trip.manual_completed_created",
    targetType: "Trip",
  });
});
```

- [ ] **Step 5: Write the failing success test for total expense mode**

```ts
it("creates a manual completed trip with a generated total-expense type", async () => {
  mock.state.expenseTypes = mock.state.expenseTypes.filter((type) => type.name !== "补录总费用");
  const app = buildApp(mock.prisma as never);
  const response = await app.inject({
    method: "POST",
    url: "/admin/trips/manual-completed",
    headers: { "x-user-id": accountantId, "x-user-role": "accountant" },
    payload: {
      vehicleId: "vehicle-1",
      driverId,
      customerName: "恒通物流",
      loadLocation: "上海",
      unloadLocation: "杭州",
      actualFreight: "800.00",
      settledAt: "2026-04-10",
      totalExpense: { amount: "120.00", note: "只有总成本" },
    },
  });

  expect(response.statusCode).toBe(200);
  expect(mock.state.expenseTypes.some((type) => type.name === "补录总费用")).toBe(true);
  expect(mock.state.manualExpenses).toHaveLength(1);
  expect(mock.state.manualExpenses[0].expenseTypeNameSnapshot).toBe("补录总费用");
  expect(mock.state.manualSettlements[0].profit.toString()).toBe("680.00");
});
```

- [ ] **Step 6: Write failing validation tests**

Add focused tests for the main guards:

```ts
it("rejects manual completed billing when expense modes are both present", async () => {
  const app = buildApp(mock.prisma as never);
  const response = await app.inject({
    method: "POST",
    url: "/admin/trips/manual-completed",
    headers: { "x-user-id": accountantId, "x-user-role": "accountant" },
    payload: {
      vehicleId: "vehicle-1",
      driverId,
      customerName: "恒通物流",
      loadLocation: "上海",
      unloadLocation: "杭州",
      actualFreight: "800.00",
      settledAt: "2026-04-10",
      expenses: [{ expenseTypeId: "expense-type-1", amount: "1.00" }],
      totalExpense: { amount: "120.00" },
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json().message).toBe("费用明细和总费用只能选择一种录入方式。");
});

it("rejects manual completed billing when driver is not bound to the vehicle", async () => {
  mock.state.bindings = [];
  const app = buildApp(mock.prisma as never);
  const response = await app.inject({
    method: "POST",
    url: "/admin/trips/manual-completed",
    headers: { "x-user-id": accountantId, "x-user-role": "accountant" },
    payload: {
      vehicleId: "vehicle-1",
      driverId,
      customerName: "恒通物流",
      loadLocation: "上海",
      unloadLocation: "杭州",
      actualFreight: "800.00",
      settledAt: "2026-04-10",
      totalExpense: { amount: "120.00" },
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json().message).toBe("该司机未绑定所选车辆，请重新选择。");
});
```

- [ ] **Step 7: Run the failing tests**

Run:

```powershell
npm --workspace apps/api run test -- --run tests/api.test.ts -t "manual completed"
```

Expected: tests fail because `POST /admin/trips/manual-completed` does not exist.

---

### Task 2: API Implementation for Manual Completed Billing

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/api.test.ts`

- [ ] **Step 1: Add schemas and helper functions**

Add near the existing Zod schemas:

```ts
const moneyStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
const manualCompletedExpenseSchema = z.object({
  expenseTypeId: z.string().min(1),
  amount: moneyStringSchema,
  occurredAt: z.string().optional(),
  note: z.string().optional(),
});
const manualCompletedTripSchema = z
  .object({
    vehicleId: z.string().min(1),
    driverId: z.string().min(1),
    customerName: z.string().min(1),
    loadLocation: z.string().min(1),
    unloadLocation: z.string().min(1),
    actualFreight: moneyStringSchema,
    settledAt: z.string().min(1),
    accountingNote: z.string().optional(),
    expenses: z.array(manualCompletedExpenseSchema).optional(),
    totalExpense: z.object({ amount: moneyStringSchema, note: z.string().optional() }).optional(),
  })
  .superRefine((value, context) => {
    const hasDetails = Boolean(value.expenses?.length);
    const hasTotal = Boolean(value.totalExpense);
    if (hasDetails && hasTotal) {
      context.addIssue({ code: "custom", message: "费用明细和总费用只能选择一种录入方式。" });
    }
    if (!hasDetails && !hasTotal) {
      context.addIssue({ code: "custom", message: "请录入费用明细，或切换为只填总费用。" });
    }
  });

function parseLocalDate(value: string) {
  const date = localDateBoundary(value, "start");
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error("请选择完成/结算日期。"), { statusCode: 400 });
  }
  return date;
}
```

- [ ] **Step 2: Add a custom Zod error handler for this route**

Inside the route implementation, wrap parsing so the super-refine message is returned:

```ts
const parsed = manualCompletedTripSchema.safeParse(request.body);
if (!parsed.success) {
  return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? "补录账单保存失败，请检查信息后重试。" });
}
const body = parsed.data;
```

- [ ] **Step 3: Implement the route**

Add before `/admin/trips/:tripId` routes so it is not captured as a trip id:

```ts
app.post("/admin/trips/manual-completed", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const parsed = manualCompletedTripSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? "补录账单保存失败，请检查信息后重试。" });
  }
  const body = parsed.data;
  const teamId = scopedTeamId(user);
  const settledAt = parseLocalDate(body.settledAt);

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: body.vehicleId, status: "available", ...(teamId ? { teamId } : {}) },
  });
  if (!vehicle) {
    return reply.code(400).send({ message: "车辆不可用，不能补录完成账单。" });
  }

  const driver = await prisma.user.findFirst({
    where: { id: body.driverId, role: "driver", status: "active", teamId: vehicle.teamId },
  });
  if (!driver) {
    return reply.code(400).send({ message: "司机不可用，不能补录完成账单。" });
  }

  const binding = await prisma.driverVehicleBinding.findFirst({
    where: { vehicleId: body.vehicleId, driverId: body.driverId, teamId: vehicle.teamId },
  });
  if (!binding) {
    return reply.code(400).send({ message: "该司机未绑定所选车辆，请重新选择。" });
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        teamId: vehicle.teamId,
        tripNo: generateTripNo(),
        vehicleId: body.vehicleId,
        driverId: body.driverId,
        customerName: body.customerName,
        loadLocation: body.loadLocation,
        unloadLocation: body.unloadLocation,
        estimatedFreight: body.actualFreight,
        actualFreight: body.actualFreight,
        status: "completed",
        accountingNote: body.accountingNote,
        createdBy: user.id,
        completedAt: settledAt,
      },
      include: tripInclude,
    });

    const expenseInputs = body.expenses?.length
      ? await Promise.all(
          body.expenses.map(async (expense) => {
            const expenseType = await tx.expenseType.findFirst({
              where: { id: expense.expenseTypeId, enabled: true, teamId: vehicle.teamId },
            });
            if (!expenseType) {
              throw Object.assign(new Error("该费用类型已停用，请重新选择。"), { statusCode: 400 });
            }
            return {
              expenseTypeId: expenseType.id,
              expenseTypeNameSnapshot: expenseType.name,
              amount: expense.amount,
              occurredAt: expense.occurredAt ? parseLocalDate(expense.occurredAt) : settledAt,
              note: expense.note,
            };
          }),
        )
      : [
          {
            expenseTypeId: (await findOrCreateManualTotalExpenseType(tx, vehicle.teamId)).id,
            expenseTypeNameSnapshot: "补录总费用",
            amount: body.totalExpense?.amount ?? "0.00",
            occurredAt: settledAt,
            note: body.totalExpense?.note,
          },
        ];

    const expenses = [];
    for (const expense of expenseInputs) {
      expenses.push(
        await tx.expense.create({
          data: {
            tripId: trip.id,
            ...expense,
            createdBy: user.id,
          },
        }),
      );
    }

    const settlement = calculateSettlement(
      body.actualFreight,
      expenses.map((expense: ExpenseAmount) => expense.amount.toString()),
    );

    await tx.settlementSnapshot.create({
      data: {
        tripId: trip.id,
        actualFreight: settlement.actualFreight,
        expenseTotal: settlement.expenseTotal,
        profit: settlement.profit,
        profitRate: settlement.profitRate,
        settledBy: user.id,
        settledAt,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        teamId: vehicle.teamId,
        targetType: "Trip",
        targetId: trip.id,
        action: "trip.manual_completed_created",
        before: null,
        after: JSON.stringify({
          vehicleId: body.vehicleId,
          driverId: body.driverId,
          actualFreight: settlement.actualFreight,
          expenseTotal: settlement.expenseTotal,
          profit: settlement.profit,
          settledAt: settledAt.toISOString(),
          expenseMode: body.expenses?.length ? "details" : "total",
        }),
      },
    });

    return tx.trip.findFirst({ where: { id: trip.id }, include: tripInclude });
    });
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      return reply.code(Number(error.statusCode)).send({ message: error.message });
    }
    throw error;
  }

  if (!result) {
    return reply.code(500).send({ message: "补录账单保存失败，请检查信息后重试。" });
  }

  return { trip: serializeTripForAdmin(result) };
});
```

- [ ] **Step 4: Add `findOrCreateManualTotalExpenseType`**

Add above `buildApp` or near report helpers:

```ts
async function findOrCreateManualTotalExpenseType(
  prismaLike: Pick<PrismaClient, "expenseType">,
  teamId: string,
) {
  const existing = await prismaLike.expenseType.findFirst({
    where: { teamId, name: "补录总费用", enabled: true },
  });
  if (existing) return existing;
  return prismaLike.expenseType.create({
    data: {
      teamId,
      name: "补录总费用",
      requiresReceipt: false,
      enabled: true,
      sortOrder: 999,
    },
  });
}
```

If the `Pick<PrismaClient, "expenseType">` type is too narrow for transaction clients, replace it with:

```ts
type ExpenseTypeWriter = {
  expenseType: {
    findFirst: PrismaClient["expenseType"]["findFirst"];
    create: PrismaClient["expenseType"]["create"];
  };
};
```

- [ ] **Step 5: Run focused API tests**

Run:

```powershell
npm --workspace apps/api run test -- --run tests/api.test.ts -t "manual completed"
```

Expected: the manual completed tests pass.

- [ ] **Step 6: Commit API endpoint**

```powershell
git add apps/api/src/app.ts apps/api/tests/api.test.ts
git commit -m "feat: add manual completed billing API"
```

---

### Task 3: Admin Receipt Upload Endpoints

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tests/api.test.ts`

- [ ] **Step 1: Write failing tests for admin receipt upload and delete**

Add:

```ts
it("allows an accountant to attach a receipt image to an admin expense", async () => {
  const app = buildApp(mock.prisma as never);
  const response = await app.inject({
    method: "POST",
    url: "/admin/expenses/expense-1/receipt-images",
    headers: { "x-user-id": accountantId, "x-user-role": "accountant" },
    payload: {
      storageKey: "uploads/manual-receipt.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().receiptImage).toMatchObject({
    expenseId: "expense-1",
    storageKey: "uploads/manual-receipt.jpg",
  });
});

it("allows an accountant to delete an admin receipt image", async () => {
  const app = buildApp(mock.prisma as never);
  const response = await app.inject({
    method: "POST",
    url: "/admin/receipt-images/receipt-1/delete",
    headers: { "x-user-id": accountantId, "x-user-role": "accountant" },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().deleted.id).toBe("receipt-1");
});
```

- [ ] **Step 2: Implement `POST /admin/expenses/:expenseId/receipt-images`**

Add after admin expense update/delete routes:

```ts
app.post("/admin/expenses/:expenseId/receipt-images", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const { expenseId } = z.object({ expenseId: z.string() }).parse(request.params);
  const body = z
    .object({
      storageKey: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.coerce.number().int().positive(),
    })
    .parse(request.body);
  const teamId = scopedTeamId(user);
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, trip: { ...(teamId ? { teamId } : {}) } },
    include: { trip: true },
  });
  if (!expense) {
    return reply.code(404).send({ message: "费用记录不存在或已被删除" });
  }
  if (expense.trip.status === "cancelled") {
    return reply.code(409).send({ message: "已撤销趟次不能上传票据" });
  }
  const receiptImage = await prisma.receiptImage.create({
    data: {
      expenseId: expense.id,
      storageKey: body.storageKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    },
  });
  return { receiptImage };
});
```

- [ ] **Step 3: Implement `POST /admin/receipt-images/:receiptImageId/delete`**

```ts
app.post("/admin/receipt-images/:receiptImageId/delete", async (request, reply) => {
  const user = getCurrentUser(request);
  requireRole(user, "accountant");
  const { receiptImageId } = z.object({ receiptImageId: z.string() }).parse(request.params);
  const receiptImage = await prisma.receiptImage.findFirst({
    where: {
      id: receiptImageId,
      expense: { trip: { ...(scopedTeamId(user) ? { teamId: scopedTeamId(user) } : {}) } },
    },
    include: { expense: { include: { trip: true } } },
  });
  if (!receiptImage) {
    return reply.code(404).send({ message: "票据不存在或已被删除" });
  }
  if (receiptImage.expense.trip.status === "cancelled") {
    return reply.code(409).send({ message: "已撤销趟次不能删除票据" });
  }
  const deleted = await prisma.receiptImage.delete({ where: { id: receiptImage.id } });
  return { deleted };
});
```

- [ ] **Step 4: Run receipt endpoint tests**

Run:

```powershell
npm --workspace apps/api run test -- --run tests/api.test.ts -t "receipt image"
```

Expected: admin and existing driver receipt tests pass.

- [ ] **Step 5: Commit receipt endpoints**

```powershell
git add apps/api/src/app.ts apps/api/tests/api.test.ts
git commit -m "feat: add admin receipt image endpoints"
```

---

### Task 4: Frontend Manual Billing Model

**Files:**
- Create: `apps/admin-web/src/components/admin/manual-completed-billing-model.ts`
- Create: `apps/admin-web/src/components/admin/manual-completed-billing-model.test.ts`

- [ ] **Step 1: Write model tests**

Create the test file:

```ts
import { describe, expect, it } from "vitest";
import {
  calculateManualBillingPreview,
  manualBillingPayload,
  type ManualBillingExpenseRow,
} from "./manual-completed-billing-model";

const expenseRows: ManualBillingExpenseRow[] = [
  { id: "row-1", expenseTypeId: "expense-type-1", amount: "100.10", occurredAt: "2026-05-20", note: "油费" },
  { id: "row-2", expenseTypeId: "expense-type-2", amount: "20.20", occurredAt: "2026-05-20", note: "过路费" },
];

describe("manual completed billing model", () => {
  it("calculates preview totals from detailed expenses", () => {
    expect(calculateManualBillingPreview("500.00", "details", expenseRows, "")).toEqual({
      actualFreight: "500.00",
      expenseTotal: "120.30",
      profit: "379.70",
      profitRate: "0.7594",
    });
  });

  it("calculates preview totals from total expense mode", () => {
    expect(calculateManualBillingPreview("500.00", "total", expenseRows, "77.77").expenseTotal).toBe("77.77");
  });

  it("returns null profit rate when freight is zero", () => {
    expect(calculateManualBillingPreview("0", "total", [], "10").profitRate).toBeNull();
  });

  it("only serializes the active expense mode", () => {
    expect(manualBillingPayload("details", expenseRows, "77.77")).toEqual({
      expenses: [
        { expenseTypeId: "expense-type-1", amount: "100.10", occurredAt: "2026-05-20", note: "油费" },
        { expenseTypeId: "expense-type-2", amount: "20.20", occurredAt: "2026-05-20", note: "过路费" },
      ],
    });
    expect(manualBillingPayload("total", expenseRows, "77.77")).toEqual({
      totalExpense: { amount: "77.77" },
    });
  });
});
```

- [ ] **Step 2: Run the failing model test**

Run:

```powershell
npm --workspace apps/admin-web run test -- --run src/components/admin/manual-completed-billing-model.test.ts
```

Expected: FAIL because the model file does not exist.

- [ ] **Step 3: Implement the model**

Create:

```ts
import {
  calculateExpenseTotal,
  calculateProfit,
  calculateProfitRate,
} from "@haulhub/shared";

export type ManualBillingExpenseMode = "details" | "total";

export interface ManualBillingExpenseRow {
  id: string;
  expenseTypeId: string;
  amount: string;
  occurredAt: string;
  note: string;
}

export function calculateManualBillingPreview(
  actualFreight: string,
  mode: ManualBillingExpenseMode,
  expenses: ManualBillingExpenseRow[],
  totalExpense: string,
) {
  const freight = actualFreight || "0";
  const expenseTotal =
    mode === "details"
      ? calculateExpenseTotal(expenses.map((expense) => expense.amount || "0"))
      : calculateExpenseTotal([totalExpense || "0"]);
  const profit = calculateProfit(freight, expenseTotal);
  return {
    actualFreight: freight,
    expenseTotal,
    profit,
    profitRate: calculateProfitRate(freight, profit),
  };
}

export function manualBillingPayload(
  mode: ManualBillingExpenseMode,
  expenses: ManualBillingExpenseRow[],
  totalExpense: string,
) {
  if (mode === "details") {
    return {
      expenses: expenses.map((expense) => ({
        expenseTypeId: expense.expenseTypeId,
        amount: expense.amount,
        occurredAt: expense.occurredAt,
        note: expense.note,
      })),
    };
  }
  return { totalExpense: { amount: totalExpense } };
}
```

- [ ] **Step 4: Run model tests**

Run:

```powershell
npm --workspace apps/admin-web run test -- --run src/components/admin/manual-completed-billing-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit frontend model**

```powershell
git add apps/admin-web/src/components/admin/manual-completed-billing-model.ts apps/admin-web/src/components/admin/manual-completed-billing-model.test.ts
git commit -m "feat: add manual billing form model"
```

---

### Task 5: Manual Completed Billing Page and Navigation

**Files:**
- Create: `apps/admin-web/src/components/admin/manual-completed-billing-form.tsx`
- Create: `apps/admin-web/src/app/trips/manual-completed/new/page.tsx`
- Modify: `apps/admin-web/src/app/trips/page.tsx`
- Modify: `apps/admin-web/src/app/reports/page.tsx`
- Modify: `apps/admin-web/src/lib/api-client.ts`

- [ ] **Step 1: Add `expenseTypeId` to `ApiExpense` when needed**

Ensure `apps/admin-web/src/lib/api-client.ts` has:

```ts
export interface ApiExpense {
  id: string;
  expenseTypeId: string;
  expenseTypeName: string;
  amount: string | null;
  occurredAt: string;
  note: string | null;
  receiptImages: ApiReceiptImage[];
}
```

- [ ] **Step 2: Create the client form component**

Create `ManualCompletedBillingForm` with this public shape:

```tsx
"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ApiDriver, ApiExpenseType, ApiVehicle } from "@/lib/api-client";
import { formatMoney } from "@/lib/api-client";
import { getDriversBoundToVehicle } from "./trip-dispatch-fields-model";
import {
  calculateManualBillingPreview,
  manualBillingPayload,
  type ManualBillingExpenseMode,
  type ManualBillingExpenseRow,
} from "./manual-completed-billing-model";

export function ManualCompletedBillingForm({
  vehicles,
  drivers,
  expenseTypes,
  action,
}: {
  vehicles: ApiVehicle[];
  drivers: ApiDriver[];
  expenseTypes: ApiExpenseType[];
  action: (formData: FormData) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [mode, setMode] = useState<ManualBillingExpenseMode>("details");
  const [actualFreight, setActualFreight] = useState("");
  const [settledAt, setSettledAt] = useState(today);
  const [totalExpense, setTotalExpense] = useState("");
  const [expenses, setExpenses] = useState<ManualBillingExpenseRow[]>([
    { id: "row-1", expenseTypeId: expenseTypes[0]?.id ?? "", amount: "", occurredAt: today, note: "" },
  ]);
  const eligibleDrivers = useMemo(() => getDriversBoundToVehicle(drivers, vehicleId), [drivers, vehicleId]);
  const preview = calculateManualBillingPreview(actualFreight, mode, expenses, totalExpense);
  const payload = JSON.stringify(manualBillingPayload(mode, expenses, totalExpense));

  return (
    <form action={action} className="form-panel">
      <input type="hidden" name="expensePayload" value={payload} />
      <section className="form-section">
        <div className="form-section-head">
          <h2>车辆与司机</h2>
          <p>司机会按所选车辆的绑定关系过滤。</p>
        </div>
        <div className="form-grid">
          <label>
            车辆
            <select name="vehicleId" required value={vehicleId} onChange={(event) => { setVehicleId(event.target.value); setDriverId(""); }}>
              <option value="" disabled>选择车辆</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber}</option>)}
            </select>
          </label>
          <label>
            司机
            <select name="driverId" required value={driverId} disabled={!vehicleId || eligibleDrivers.length === 0} onChange={(event) => setDriverId(event.target.value)}>
              <option value="" disabled>{vehicleId && eligibleDrivers.length === 0 ? "该车辆暂无可用司机" : "选择司机"}</option>
              {eligibleDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} - {driver.phone}</option>)}
            </select>
          </label>
        </div>
      </section>
      <section className="form-section">
        <div className="form-section-head"><h2>运输信息</h2><p>完成日期会作为利润统计归档日期。</p></div>
        <div className="form-grid">
          <label>客户名称<input name="customerName" required /></label>
          <label>实际运费<input name="actualFreight" inputMode="decimal" pattern="\d+(\.\d{1,2})?" required value={actualFreight} onChange={(event) => setActualFreight(event.target.value)} /></label>
          <label>完成/结算日期<input name="settledAt" type="date" required value={settledAt} onChange={(event) => setSettledAt(event.target.value)} /></label>
          <label>装货地<input name="loadLocation" required /></label>
          <label>卸货地<input name="unloadLocation" required /></label>
          <label>会计备注<textarea name="accountingNote" /></label>
        </div>
      </section>
      <section className="form-section">
        <div className="form-section-head"><h2>费用录入</h2><p>可填明细，也可切换为只填总费用。</p></div>
        <div className="segmented-control">
          <button type="button" className={mode === "details" ? "active" : ""} onClick={() => setMode("details")}>费用明细</button>
          <button type="button" className={mode === "total" ? "active" : ""} onClick={() => setMode("total")}>只填总费用</button>
        </div>
        {mode === "details" ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>费用类型</th><th>金额</th><th>发生日期</th><th>备注</th><th>操作</th></tr></thead>
              <tbody>{expenses.map((expense) => (
                <tr key={expense.id}>
                  <td><select value={expense.expenseTypeId} onChange={(event) => setExpenses((items) => items.map((item) => item.id === expense.id ? { ...item, expenseTypeId: event.target.value } : item))}>{expenseTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></td>
                  <td><input inputMode="decimal" pattern="\d+(\.\d{1,2})?" required value={expense.amount} onChange={(event) => setExpenses((items) => items.map((item) => item.id === expense.id ? { ...item, amount: event.target.value } : item))} /></td>
                  <td><input type="date" required value={expense.occurredAt || settledAt} onChange={(event) => setExpenses((items) => items.map((item) => item.id === expense.id ? { ...item, occurredAt: event.target.value } : item))} /></td>
                  <td><input value={expense.note} onChange={(event) => setExpenses((items) => items.map((item) => item.id === expense.id ? { ...item, note: event.target.value } : item))} /></td>
                  <td><button className="icon-button" type="button" aria-label="删除费用" onClick={() => setExpenses((items) => items.filter((item) => item.id !== expense.id))}><Trash2 size={16} /></button></td>
                </tr>
              ))}</tbody>
            </table>
            <button className="secondary-button" type="button" onClick={() => setExpenses((items) => [...items, { id: `row-${Date.now()}`, expenseTypeId: expenseTypes[0]?.id ?? "", amount: "", occurredAt: settledAt, note: "" }])}><Plus size={16} />新增费用</button>
          </div>
        ) : (
          <label>总费用<input inputMode="decimal" pattern="\d+(\.\d{1,2})?" required value={totalExpense} onChange={(event) => setTotalExpense(event.target.value)} /></label>
        )}
      </section>
      <aside className="review-panel">
        <h2>保存前预览</h2>
        <div className="summary-row"><span>实际运费</span><strong>{formatMoney(preview.actualFreight)}</strong></div>
        <div className="summary-row"><span>费用合计</span><strong>{formatMoney(preview.expenseTotal)}</strong></div>
        <div className="summary-row total"><span>预计利润</span><strong>{formatMoney(preview.profit)}</strong></div>
        <div className="summary-row"><span>利润率</span><strong>{preview.profitRate == null ? "不可计算" : `${Math.round(Number(preview.profitRate) * 10000) / 100}%`}</strong></div>
      </aside>
      <div className="form-actions"><button className="primary-button" type="submit">保存并计入利润统计</button></div>
    </form>
  );
}
```

If `.segmented-control` has no existing CSS, add a small style block to `apps/admin-web/src/app/globals.css` using existing button colors.

- [ ] **Step 3: Create the page and server action**

Create `apps/admin-web/src/app/trips/manual-completed/new/page.tsx`:

```tsx
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { ManualCompletedBillingForm } from "@/components/admin/manual-completed-billing-form";
import { redirectWithActionError } from "@/lib/action-errors";
import { apiGet, apiPost, type ApiDriver, type ApiExpenseType, type ApiTrip, type ApiVehicle } from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function createManualCompletedTripAction(formData: FormData) {
  "use server";
  const expensePayload = JSON.parse(String(formData.get("expensePayload") || "{}")) as Record<string, unknown>;
  let tripId = "";
  try {
    const { trip } = await apiPost<{ trip: ApiTrip }>("/admin/trips/manual-completed", {
      vehicleId: String(formData.get("vehicleId") || ""),
      driverId: String(formData.get("driverId") || ""),
      customerName: String(formData.get("customerName") || ""),
      loadLocation: String(formData.get("loadLocation") || ""),
      unloadLocation: String(formData.get("unloadLocation") || ""),
      actualFreight: String(formData.get("actualFreight") || ""),
      settledAt: String(formData.get("settledAt") || ""),
      accountingNote: String(formData.get("accountingNote") || ""),
      ...expensePayload,
    });
    tripId = trip.id;
  } catch (error) {
    redirectWithActionError("/trips/manual-completed/new", error);
  }
  redirect(`/trips/${tripId}`);
}

export default async function NewManualCompletedTripPage() {
  const [{ vehicles }, { drivers }, { expenseTypes }] = await Promise.all([
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    apiGet<{ drivers: ApiDriver[] }>("/admin/drivers"),
    apiGet<{ expenseTypes: ApiExpenseType[] }>("/admin/expense-types"),
  ]);
  return (
    <AdminShell>
      <section className="page-heading">
        <div><h1>补录完成账单</h1><p>一次性录入系统外已完成运输，并计入利润统计。</p></div>
        <Link className="secondary-button" href="/trips"><ArrowLeft size={16} />返回趟次</Link>
      </section>
      <ManualCompletedBillingForm
        vehicles={vehicles.filter((vehicle) => vehicle.status === "available")}
        drivers={drivers.filter((driver) => driver.status === "active")}
        expenseTypes={expenseTypes.filter((type) => type.enabled)}
        action={createManualCompletedTripAction}
      />
    </AdminShell>
  );
}
```

- [ ] **Step 4: Add navigation links**

In `apps/admin-web/src/app/trips/page.tsx`, add beside the existing new-trip link:

```tsx
<Link className="secondary-button" href="/trips/manual-completed/new">
  补录完成账单
</Link>
```

In `apps/admin-web/src/app/reports/page.tsx`, add to the page heading action area:

```tsx
<Link className="secondary-button" href="/trips/manual-completed/new">
  补录完成账单
</Link>
```

- [ ] **Step 5: Run admin tests and type check**

Run:

```powershell
npm --workspace apps/admin-web run test -- --run src/components/admin/manual-completed-billing-model.test.ts
npm --workspace apps/admin-web run lint
```

Expected: tests pass and lint reports no TypeScript or ESLint errors.

- [ ] **Step 6: Commit page and navigation**

```powershell
git add apps/admin-web/src/lib/api-client.ts apps/admin-web/src/components/admin/manual-completed-billing-form.tsx apps/admin-web/src/app/trips/manual-completed/new/page.tsx apps/admin-web/src/app/trips/page.tsx apps/admin-web/src/app/reports/page.tsx apps/admin-web/src/app/globals.css
git commit -m "feat: add manual completed billing page"
```

---

### Task 6: Admin Receipt Upload UI and Final Verification

**Files:**
- Modify: `apps/admin-web/src/app/trips/[tripId]/page.tsx`
- Modify: `apps/admin-web/src/lib/api-client.ts` if helper typing is needed

- [ ] **Step 1: Add server actions for admin receipt attach/delete**

In `apps/admin-web/src/app/trips/[tripId]/page.tsx`, add:

```tsx
async function attachReceiptImageAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const expenseId = String(formData.get("expenseId"));
  try {
    await apiPost(`/admin/expenses/${expenseId}/receipt-images`, {
      storageKey: String(formData.get("storageKey") || ""),
      mimeType: String(formData.get("mimeType") || "image/jpeg"),
      sizeBytes: Number(formData.get("sizeBytes") || 1),
    });
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function deleteReceiptImageAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const receiptImageId = String(formData.get("receiptImageId"));
  try {
    await apiPost(`/admin/receipt-images/${receiptImageId}/delete`);
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}
```

For first implementation, use `storageKey` text input because the app already uploads files via `/files`; full multipart upload from the admin detail page can be added after the endpoint is proven.

- [ ] **Step 2: Add optional receipt controls to each expense row**

In the expense receipt cell, below existing thumbnails, render for admin:

```tsx
<form className="inline-form" action={attachReceiptImageAction}>
  <input type="hidden" name="tripId" value={trip.id} />
  <input type="hidden" name="expenseId" value={expense.id} />
  <input name="storageKey" placeholder="uploads/receipt.jpg" />
  <input type="hidden" name="mimeType" value="image/jpeg" />
  <input type="hidden" name="sizeBytes" value="1" />
  <button className="text-button" type="submit">补传票据</button>
</form>
```

For each existing receipt image, add a delete form next to the preview link:

```tsx
<form action={deleteReceiptImageAction}>
  <input type="hidden" name="tripId" value={trip.id} />
  <input type="hidden" name="receiptImageId" value={image.id} />
  <button className="text-button danger-text" type="submit">删除</button>
</form>
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm --workspace apps/api run test -- --run tests/api.test.ts -t "manual completed|receipt image"
npm --workspace apps/admin-web run test -- --run src/components/admin/manual-completed-billing-model.test.ts
npm --workspace apps/api run lint
npm --workspace apps/admin-web run lint
```

Expected: all commands pass.

- [ ] **Step 4: Start dev servers for browser verification**

Run these in separate terminals or background sessions:

```powershell
npm run dev:api
npm run dev:admin
```

Open `http://localhost:3000/trips/manual-completed/new` in the in-app browser. Verify:

- Vehicle selection filters drivers.
- A vehicle with no bound drivers shows the no-driver hint.
- Switching between details and total modes changes the submitted payload mode.
- Preview updates actual freight, expense total, profit, and profit rate.
- Saving redirects to the new trip detail page.
- The new trip appears in the profit report for the chosen settlement date.

- [ ] **Step 5: Commit receipt UI and verification fixes**

```powershell
git add apps/admin-web/src/app/trips/[tripId]/page.tsx apps/admin-web/src/lib/api-client.ts
git commit -m "feat: add admin receipt controls for manual bills"
```

---

## Final Acceptance

Run:

```powershell
npm test
npm run lint
```

Expected:

- API tests pass.
- Admin web tests pass.
- Shared package tests pass.
- TypeScript and ESLint checks pass for all workspaces that define lint scripts.

Manual acceptance:

- Admin can create a completed bill from `/trips/manual-completed/new`.
- The created trip has status `completed`.
- The trip detail shows actual freight, expense total, profit, and profit rate.
- Profit report includes the bill in the selected settlement month.
- Invalid vehicle, driver, binding, money, and expense-mode inputs return clear messages.
