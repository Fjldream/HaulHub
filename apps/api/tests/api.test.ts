import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { buildApp } from "../src/app";

const accountantId = "accountant-1";
const driverId = "driver-1";
const tripId = "trip-1";
const teamId = "team-default";
const otherTeamId = "team-other";
const accountantHeaders = {
  "x-user-id": accountantId,
  "x-user-role": "accountant",
};
const driverHeaders = {
  "x-user-id": driverId,
  "x-user-role": "driver",
};

function decimal(value: string) {
  return { toString: () => value };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function multipartImagePayload(input: {
  boundary: string;
  filename: string;
  contentType: string;
  image: Buffer;
}) {
  return Buffer.concat([
    Buffer.from(
      [
        `--${input.boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${input.filename}"`,
        `Content-Type: ${input.contentType}`,
        "",
        "",
      ].join("\r\n"),
    ),
    input.image,
    Buffer.from(["", `--${input.boundary}--`, ""].join("\r\n")),
  ]);
}

type MockUser = {
  id: string;
  teamId: string | null;
  name: string;
  phone: string;
  role: string;
  status: string;
};

type MockStoredTrip = Record<string, unknown> & {
  id: string;
  teamId: string;
  tripNo: string;
  status: string;
  completedAt: Date | null;
  driverId: string;
  driver: {
    id: string;
    name: string;
  };
  assistantDrivers?: Array<{
    driverId?: string;
    driver?: {
      id: string;
      name: string;
    };
  }>;
};

type MockDriverPayroll = {
  id: string;
  teamId: string;
  driverId: string;
  salaryMonth: string;
  type: string;
  amount: ReturnType<typeof decimal>;
  tripCount: number | null;
  unitAmount: ReturnType<typeof decimal> | null;
  paidAt: Date | null;
  note: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  driver: { id: string; name: string; phone?: string };
  creator: { id: string; name: string };
};

function createPrismaMock() {
  const state = {
    tripStatus: "in_progress",
    auditLogs: [] as unknown[],
    users: [
      { id: driverId, teamId, name: "Driver One", phone: "13900000001", role: "driver", status: "active" },
      { id: "driver-2", teamId, name: "Driver Two", phone: "13900000002", role: "driver", status: "active" },
      { id: "driver-other-team", teamId: otherTeamId, name: "Other Team Driver", phone: "13900000003", role: "driver", status: "active" },
      { id: accountantId, teamId, name: "Accountant One", phone: "13800000000", role: "accountant", status: "active" },
      { id: "accountant-other-team", teamId: otherTeamId, name: "Other Team Accountant", phone: "13800000003", role: "accountant", status: "active" },
    ] as MockUser[],
    driverPayrolls: [] as MockDriverPayroll[],
    receipts: [
      { id: "receipt-1", expenseId: "expense-1", storageKey: "r1.jpg", mimeType: "image/jpeg", sizeBytes: 1 },
    ] as Array<{
      id: string;
      expenseId?: unknown;
      storageKey: string;
      mimeType?: unknown;
      sizeBytes?: unknown;
    }>,
    bindings: [{ id: "binding-1", vehicleId: "vehicle-1", driverId }],
    tripAssistantDrivers: [] as Array<{ id: string; teamId: string; tripId: string; driverId: string }>,
    manualTrips: [] as unknown[],
    aiBillIntakeSessions: [] as Array<{
      id: string;
      teamId: string;
      userId: string;
      messagesJson: string;
      imageUrlsJson: string;
      currentDraftJson: string | null;
      reviewQuestionsJson: string;
      warningsJson: string;
      lastResultJson: string | null;
      status: string;
      submittedTripId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>,
    trips: [] as MockStoredTrip[],
    manualExpenses: [] as unknown[],
    manualSettlements: [] as unknown[],
    expenseTypes: [
      { id: "expense-type-1", name: "油费", requiresReceipt: true, enabled: true, sortOrder: 1 },
      { id: "expense-type-2", name: "过路费", requiresReceipt: false, enabled: true, sortOrder: 2 },
    ],
    conflictingTrip: null as null | {
      id: string;
      status: string;
      vehicleId: string;
      driverId: string;
    },
    updatedTrip: null as null | Record<string, unknown>,
    tripFindManyArgs: null as unknown,
    tripFindFirstArgs: [] as unknown[],
    vehicleFindManyArgs: null as unknown,
    driverFindManyArgs: null as unknown,
    expenseTypeFindManyArgs: null as unknown,
    settlementFindManyArgs: null as unknown,
    maintenanceFindManyArgs: null as unknown,
    maintenanceRecords: [] as Array<{
      id: string;
      vehicleId: string;
      component: string;
      amount: ReturnType<typeof decimal>;
      occurredAt: Date;
      voucherStorageKey: string | null;
      note: string | null;
      createdAt: Date;
      vehicle: { id: string; plateNumber: string };
      creator: { id: string; name: string };
    }>,
    auditLogFindManyArgs: null as unknown,
    teamStatus: "active",
  };

  function teamSnapshot() {
    return {
      id: teamId,
      name: "默认团队",
      status: state.teamStatus,
    };
  }

  const trip = {
    id: tripId,
    tripNo: "HH001",
    status: state.tripStatus,
    customerName: "恒通物流",
    loadLocation: "上海",
    unloadLocation: "杭州",
    loadAddress: null,
    loadLatitude: null,
    loadLongitude: null,
    loadPoiId: null,
    unloadAddress: null,
    unloadLatitude: null,
    unloadLongitude: null,
    unloadPoiId: null,
    locationProvider: null,
    estimatedFreight: decimal("1800.00"),
    actualFreight: null,
    returnReason: null,
    createdAt: new Date("2026-05-27T01:20:00.000Z"),
    submittedAt: null,
    reviewStartedAt: null,
    completedAt: null,
    vehicle: { id: "vehicle-1", plateNumber: "沪A12345" },
    driver: { id: driverId, name: "司机老李" },
    expenses: [
      {
        id: "expense-1",
        expenseTypeId: "expense-type-1",
        expenseTypeNameSnapshot: "油费",
        amount: decimal("300.00"),
        occurredAt: new Date("2026-05-27T03:08:00.000Z"),
        note: "加油",
        receiptImages: state.receipts,
        expenseType: { requiresReceipt: true },
      },
      {
        id: "expense-2",
        expenseTypeId: "expense-type-2",
        expenseTypeNameSnapshot: "停车费",
        amount: decimal("40.00"),
        occurredAt: new Date("2026-05-27T04:08:00.000Z"),
        note: "不强制票据",
        receiptImages: [],
        expenseType: { requiresReceipt: false },
      },
    ],
    settlement: null,
  };

  function tripSnapshot() {
    return {
      ...trip,
      ...(state.updatedTrip ?? {}),
      vehicleId: "vehicle-1",
      driverId,
      teamId,
      status: state.tripStatus,
      assistantDrivers: state.tripAssistantDrivers
        .filter((item) => item.tripId === tripId)
        .map((item) => ({
          ...item,
          driver: {
            id: item.driverId,
            name: item.driverId === "driver-2" ? "司机小王" : "司机老李",
          },
        })),
      expenses: trip.expenses,
    };
  }

  state.trips.push({
    ...tripSnapshot(),
    status: "completed",
    completedAt: new Date("2026-06-10T08:00:00.000Z"),
  });

  function matchesTripWhere(where: Record<string, unknown> | undefined): boolean {
    if (!where) return true;
    if (typeof where.id === "string" && where.id !== tripId) return false;
    if (typeof where.driverId === "string" && where.driverId !== driverId) return false;
    if (typeof where.status === "string" && where.status !== state.tripStatus) return false;
    if (typeof where.status === "object" && where.status != null) {
      const statusIn = (where.status as { in?: unknown }).in;
      const statusNot = (where.status as { not?: unknown }).not;
      if (Array.isArray(statusIn) && !statusIn.includes(state.tripStatus)) return false;
      if (typeof statusNot === "string" && statusNot === state.tripStatus) return false;
    }
    if (Array.isArray(where.OR)) {
      const matchesAny = where.OR.some((condition) => {
        if (typeof condition !== "object" || condition == null) return false;
        const item = condition as Record<string, unknown>;
        if (item.driverId === driverId) return true;
        const assistantDriverId = (
          item.assistantDrivers as
            | { some?: { driverId?: string | { in?: string[] } } }
            | undefined
        )?.some?.driverId;
        if (typeof assistantDriverId === "string") {
          return state.tripAssistantDrivers.some(
            (assistant) => assistant.tripId === tripId && assistant.driverId === assistantDriverId,
          );
        }
        if (typeof assistantDriverId === "object" && Array.isArray(assistantDriverId.in)) {
          return state.tripAssistantDrivers.some(
            (assistant) => assistant.tripId === tripId && assistantDriverId.in?.includes(assistant.driverId),
          );
        }
        return false;
      });
      if (!matchesAny) return false;
    }
    return true;
  }

  function matchesStoredTripWhere(
    storedTrip: (typeof state.trips)[number],
    where: Record<string, unknown> | undefined,
  ): boolean {
    if (!where) return true;
    if (typeof where.teamId === "string" && storedTrip.teamId !== where.teamId) return false;
    if (typeof where.status === "string" && storedTrip.status !== where.status) return false;
    const completedAtFilter = where.completedAt as { gte?: Date; lte?: Date } | undefined;
    if (completedAtFilter) {
      const completedAt = storedTrip.completedAt;
      if (!completedAt) return false;
      if (completedAtFilter.gte && completedAt < completedAtFilter.gte) return false;
      if (completedAtFilter.lte && completedAt > completedAtFilter.lte) return false;
    }
    if (Array.isArray(where.OR)) {
      const matchesAny = where.OR.some((condition) => {
        if (typeof condition !== "object" || condition == null) return false;
        const item = condition as Record<string, unknown>;
        if (item.driverId === storedTrip.driverId) return true;
        const assistantDriverId = (
          item.assistantDrivers as { some?: { driverId?: string } } | undefined
        )?.some?.driverId;
        if (typeof assistantDriverId === "string") {
          return storedTrip.assistantDrivers?.some(
            (assistant) => assistant.driverId === assistantDriverId || assistant.driver?.id === assistantDriverId,
          );
        }
        return false;
      });
      if (!matchesAny) return false;
    }
    return true;
  }

  function payrollWithRelations(payroll: (typeof state.driverPayrolls)[number]) {
    return {
      ...payroll,
      driver: state.users.find((user) => user.id === payroll.driverId) ?? payroll.driver,
      creator: state.users.find((user) => user.id === payroll.createdBy) ?? payroll.creator,
    };
  }

  function matchesPayrollWhere(
    payroll: (typeof state.driverPayrolls)[number],
    where: Record<string, unknown> | undefined,
  ): boolean {
    if (!where) return true;
    if (typeof where.id === "string" && payroll.id !== where.id) return false;
    if (typeof where.teamId === "string" && payroll.teamId !== where.teamId) return false;
    if (typeof where.salaryMonth === "string" && payroll.salaryMonth !== where.salaryMonth) return false;
    if (typeof where.driverId === "string" && payroll.driverId !== where.driverId) return false;
    if (typeof where.type === "string" && payroll.type !== where.type) return false;
    if (Array.isArray(where.OR)) {
      const related = payrollWithRelations(payroll);
      const matchesAny = where.OR.some((condition) => {
        if (typeof condition !== "object" || condition == null) return false;
        const item = condition as Record<string, unknown>;
        const note = (item.note as { contains?: string } | undefined)?.contains;
        if (note && payroll.note?.includes(note)) return true;
        const driver = item.driver as
          | { name?: { contains?: string }; phone?: { contains?: string } }
          | undefined;
        if (driver?.name?.contains && related.driver.name.includes(driver.name.contains)) return true;
        if (driver?.phone?.contains && related.driver.phone?.includes(driver.phone.contains)) return true;
        return false;
      });
      if (!matchesAny) return false;
    }
    return true;
  }

  const prisma = {
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => callback(prisma),
      aiBillIntakeSession: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const now = new Date("2026-07-09T00:00:00.000Z");
          const created = {
            id: String(data.id ?? "ai-session-1"),
            teamId: String(data.teamId),
            userId: String(data.userId),
            messagesJson: String(data.messagesJson ?? "[]"),
            imageUrlsJson: String(data.imageUrlsJson ?? "[]"),
            currentDraftJson: typeof data.currentDraftJson === "string" ? data.currentDraftJson : null,
            reviewQuestionsJson: String(data.reviewQuestionsJson ?? "[]"),
            warningsJson: String(data.warningsJson ?? "[]"),
            lastResultJson: typeof data.lastResultJson === "string" ? data.lastResultJson : null,
            status: String(data.status ?? "active"),
            submittedTripId: typeof data.submittedTripId === "string" ? data.submittedTripId : null,
            createdAt: now,
            updatedAt: now,
          };
          state.aiBillIntakeSessions.push(created);
          return created;
        },
        findUnique: async ({ where }: { where: { id?: string } }) =>
          state.aiBillIntakeSessions.find((session) => session.id === where.id) ?? null,
        findMany: async ({
          where,
          orderBy,
          take,
        }: {
          where?: { teamId?: string; userId?: string };
          orderBy?: { updatedAt?: "asc" | "desc" };
          take?: number;
        } = {}) => {
          const sessions = state.aiBillIntakeSessions
            .filter((session) => {
              if (where?.teamId && session.teamId !== where.teamId) return false;
              if (where?.userId && session.userId !== where.userId) return false;
              return true;
            })
            .sort((left, right) => {
              const diff = left.updatedAt.getTime() - right.updatedAt.getTime();
              return orderBy?.updatedAt === "asc" ? diff : -diff;
            });
          return typeof take === "number" ? sessions.slice(0, take) : sessions;
        },
        update: async ({ where, data }: { where: { id?: string }; data: Record<string, unknown> }) => {
          const index = state.aiBillIntakeSessions.findIndex((session) => session.id === where.id);
          if (index < 0) return null;
          const updated = {
            ...state.aiBillIntakeSessions[index],
            ...data,
            updatedAt: new Date("2026-07-09T00:01:00.000Z"),
          };
          state.aiBillIntakeSessions[index] = updated;
          return updated;
        },
      },
      trip: {
        findMany: async (args: { where?: Record<string, unknown> } = {}) => {
          state.tripFindManyArgs = args;
          if (args.where?.completedAt) {
            return state.trips.filter((storedTrip) => matchesStoredTripWhere(storedTrip, args.where));
          }
          return matchesTripWhere(args.where) ? [tripSnapshot()] : [];
        },
        findFirst: async (args: { where?: Record<string, unknown> } = {}) => {
          state.tripFindFirstArgs.push(args);
          const where = args.where ?? {};
          const manualTrip = state.manualTrips.find(
            (item) => typeof item === "object" && item != null && "id" in item && item.id === where.id,
          ) as ReturnType<typeof tripSnapshot> | undefined;
          if (manualTrip) {
            return {
              ...manualTrip,
              assistantDrivers: state.tripAssistantDrivers
                .filter((item) => item.tripId === manualTrip.id)
                .map((item) => ({
                  ...item,
                  driver: {
                    id: item.driverId,
                    name: item.driverId === "driver-2" ? "司机小王" : "司机老李",
                  },
                })),
              expenses: state.manualExpenses,
              settlement: state.manualSettlements[0]
                ? {
                    profitRate: (state.manualSettlements[0] as { profitRate?: unknown }).profitRate,
                  }
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

          return matchesTripWhere(where) ? tripSnapshot() : null;
        },
        findUnique: async () => tripSnapshot(),
        create: async ({ data }: { data: Record<string, unknown>; include?: unknown }) => {
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
        update: async ({ data }: { data: { status?: string; actualFreight?: string } & Record<string, unknown> }) => {
          state.tripStatus = data.status ?? state.tripStatus;
          state.updatedTrip = data;
          return {
            ...tripSnapshot(),
            ...data,
            actualFreight: data.status === "completed" ? decimal("1000.00") : null,
            submittedAt: data.status === "submitted" ? new Date("2026-05-27T07:42:00.000Z") : null,
            reviewStartedAt:
              data.status === "under_review" ? new Date("2026-05-27T08:00:00.000Z") : null,
            completedAt: data.status === "completed" ? new Date("2026-05-27T09:00:00.000Z") : null,
            settlement:
              data.status === "completed"
                ? {
                    profitRate: decimal("0.7000"),
                  }
                : null,
          };
        },
      },
      expense: {
        findFirst: async () => ({
          id: "expense-1",
          tripId,
          expenseTypeNameSnapshot: "油费",
          amount: decimal("300.00"),
          note: "加油",
          trip: tripSnapshot(),
        }),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const created = {
            id: `expense-created-${state.manualExpenses.length + 1}`,
            ...data,
            amount: decimal(String(data.amount)),
            occurredAt:
              data.occurredAt instanceof Date ? data.occurredAt : new Date(String(data.occurredAt)),
            receiptImages: [],
            expenseType: { requiresReceipt: false },
          };
          state.manualExpenses.push(created);
          return created;
        },
        update: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "expense-1",
          tripId,
          expenseTypeNameSnapshot: "油费",
          amount: decimal(String(data.amount ?? "300.00")),
          note: data.note,
        }),
        delete: async () => ({ id: "expense-1", tripId }),
      },
      expenseType: {
        findFirst: async ({
          where,
        }: {
          where?: { id?: string; name?: string; enabled?: boolean; teamId?: string };
        } = {}) => {
          const found = state.expenseTypes.find((type) => {
            if (where?.id && type.id !== where.id) return false;
            if (where?.name && type.name !== where.name) return false;
            if (where?.enabled != null && type.enabled !== where.enabled) return false;
            return true;
          });
          return found ?? null;
        },
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === "expense-type-1"
            ? {
                id: "expense-type-1",
                name: "油费",
                requiresReceipt: true,
                enabled: true,
                sortOrder: 1,
              }
            : null,
        findMany: async (args: { where?: { teamId?: string; enabled?: boolean } } = {}) => {
          state.expenseTypeFindManyArgs = args;
          return state.expenseTypes.filter((type) => {
            if (args.where?.enabled != null && type.enabled !== args.where.enabled) return false;
            return true;
          });
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          if (state.expenseTypes.some((type) => type.name === String(data.name))) {
            throw Object.assign(new Error("Unique constraint failed on the fields: (`teamId`,`name`)"), {
              code: "P2002",
            });
          }
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
        update: async ({
          data,
          where,
        }: {
          data: Record<string, unknown>;
          where: { id: string };
        }) => {
          const existingIndex = state.expenseTypes.findIndex((type) => type.id === where.id);
          const existing = state.expenseTypes[existingIndex] ?? {
            id: where.id,
            name: "油费",
            requiresReceipt: true,
            enabled: true,
            sortOrder: 1,
          };
          const updated = {
            ...existing,
            ...data,
            id: where.id,
          };
          if (existingIndex >= 0) {
            state.expenseTypes[existingIndex] = updated;
          }
          return updated;
        },
      },
      receiptImage: {
        findFirst: async ({ where }: { where: { id: string } }) => {
          const receipt = state.receipts.find((item) => item.id === where.id);
          return receipt
            ? {
                ...receipt,
                expense: {
                  id: "expense-1",
                  trip: tripSnapshot(),
                },
              }
            : null;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const created = {
            id: "receipt-created",
            expenseId: data.expenseId,
            storageKey: String(data.storageKey),
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
          };
          state.receipts.push(created);
          return created;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const deleted = state.receipts.find((item) => item.id === where.id) ?? { id: where.id };
          state.receipts = state.receipts.filter((item) => item.id !== where.id);
          return deleted;
        },
        deleteMany: async () => ({ count: state.receipts.length }),
      },
      auditLog: {
        create: async ({ data }: { data: unknown }) => {
          state.auditLogs.push(data);
          return data;
        },
        findMany: async (args: unknown = {}) => {
          state.auditLogFindManyArgs = args;
          return [
            {
              id: "audit-1",
              actorId: accountantId,
              targetType: "Trip",
              targetId: tripId,
              action: "trip.review_started",
              before: JSON.stringify({ status: "submitted" }),
              after: JSON.stringify({ status: "under_review" }),
              createdAt: new Date("2026-05-27T08:00:00.000Z"),
              actor: {
                id: accountantId,
                name: "会计小周",
                role: "accountant",
              },
            },
          ];
        },
      },
      vehicle: {
        findMany: async (args: { where?: { teamId?: string; status?: string } } = {}) => {
          state.vehicleFindManyArgs = args;
          return [
            {
              id: "vehicle-1",
              teamId,
              plateNumber: "沪A12345",
              status: "available",
              vehicleType: "9.6m van",
              note: null,
              driverBindings: state.bindings
                .filter((binding) => binding.vehicleId === "vehicle-1")
                .map((binding) => ({
                  ...binding,
                  teamId,
                  driver: {
                    id: binding.driverId,
                    name: binding.driverId === driverId ? "鍙告満鑰佹潕" : "鍙告満灏忕帇",
                    phone: binding.driverId === driverId ? "13900000001" : "13900000002",
                    status: "active",
                  },
                })),
            },
            {
              id: "vehicle-other-team",
              teamId: otherTeamId,
              plateNumber: "闽A99999",
              status: "available",
              vehicleType: "4.2m van",
              note: null,
              driverBindings: state.bindings
                .filter((binding) => binding.vehicleId === "vehicle-other-team")
                .map((binding) => ({
                  ...binding,
                  teamId: otherTeamId,
                  driver: {
                    id: binding.driverId,
                    name: binding.driverId === driverId ? "鍙告満鑰佹潕" : "鍙告満灏忕帇",
                    phone: binding.driverId === driverId ? "13900000001" : "13900000002",
                    status: "active",
                  },
                })),
            },
          ].filter((vehicle) => {
            if (args.where?.teamId && vehicle.teamId !== args.where.teamId) return false;
            if (args.where?.status && vehicle.status !== args.where.status) return false;
            return true;
          });
        },
        findFirst: async ({ where }: { where: { id: string; status?: string; teamId?: string } }) =>
          where.id === "vehicle-1" && (!where.status || where.status === "available")
            ? {
                id: "vehicle-1",
                teamId,
                plateNumber: "沪A12345",
                status: "available",
                vehicleType: "9.6米厢式货车",
                note: null,
                driverBindings: state.bindings.map((binding) => ({
                  ...binding,
                  driver: {
                    id: binding.driverId,
                    name: binding.driverId === driverId ? "司机老李" : "司机小王",
                    phone: binding.driverId === driverId ? "13900000001" : "13900000002",
                    status: "active",
                  },
                })),
              }
            : null,
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === "vehicle-1"
            ? {
                id: "vehicle-1",
                teamId,
                plateNumber: "沪A12345",
                status: "available",
                vehicleType: "9.6米厢式货车",
                note: null,
                driverBindings: state.bindings.map((binding) => ({
                  ...binding,
                  driver: {
                    id: binding.driverId,
                    name: binding.driverId === driverId ? "司机老李" : "司机小王",
                    phone: binding.driverId === driverId ? "13900000001" : "13900000002",
                    status: "active",
                  },
                })),
              }
            : null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "vehicle-created",
          teamId: data.teamId ?? teamId,
          status: "available",
          ...data,
        }),
        update: async ({ data, where }: { data: Record<string, unknown>; where: { id: string } }) => ({
          id: where.id,
          teamId,
          plateNumber: data.plateNumber ?? "娌狝12345",
          status: data.status ?? "available",
          vehicleType: data.vehicleType ?? "9.6m van",
          note: data.note ?? null,
          driverBindings: state.bindings.map((binding) => ({
            ...binding,
            driver: {
              id: binding.driverId,
              name: binding.driverId === driverId ? "鍙告満鑰佹潕" : "鍙告満灏忕帇",
              phone: binding.driverId === driverId ? "13900000001" : "13900000002",
              status: "active",
            },
          })),
        }),
      },
      user: {
        findMany: async (args: { where?: { role?: string | { in?: string[] }; teamId?: string; status?: string } } = {}) => {
          state.driverFindManyArgs = args;
          const roleFilter = args.where?.role;
          if (typeof roleFilter === "object" && roleFilter.in?.includes("administrator")) {
            return [
              {
                id: "administrator-1",
                teamId: null,
                name: "Administrator",
                phone: "13700000000",
                role: "administrator",
                status: "active",
                isFirstLogin: false,
                createdAt: new Date("2026-05-27T00:00:00.000Z"),
              },
              {
                id: accountantId,
                teamId,
                name: "会计小周",
                phone: "13800000000",
                role: "accountant",
                status: "active",
                isFirstLogin: false,
                createdAt: new Date("2026-05-27T00:10:00.000Z"),
              },
            ];
          }
          return state.users
            .filter((user) => {
              if (typeof roleFilter === "string" && user.role !== roleFilter) return false;
              if (args.where?.teamId && user.teamId !== args.where.teamId) return false;
              if (args.where?.status && user.status !== args.where.status) return false;
              return true;
            })
            .map((user) =>
              user.role === "driver"
                ? {
                    ...user,
                    driverBindings: state.bindings
                      .filter((binding) => binding.driverId === user.id)
                      .map((binding) => ({
                        ...binding,
                        teamId: user.teamId ?? teamId,
                        vehicle: {
                          id: binding.vehicleId,
                          plateNumber: binding.vehicleId === "vehicle-1" ? "娌狝12345" : "闂紸99999",
                          status: "available",
                          vehicleType: "9.6m van",
                        },
                      })),
                  }
                : user,
            );
        },
        findFirst: async ({
          where,
        }: {
          where: { id?: string; phone?: string; role?: string; status?: string; teamId?: string | null };
        }) => {
          if (where.phone === "13900000001" && (!where.status || where.status === "active")) {
            return {
              id: driverId,
              teamId,
              name: "司机老李",
              phone: "13900000001",
              passwordHash: "123456",
              role: "driver",
              status: "active",
              isFirstLogin: false,
              team: teamSnapshot(),
            };
          }
          if (where.phone === "13700000000" && (!where.status || where.status === "active")) {
            return {
              id: "administrator-1",
              teamId: null,
              name: "Administrator",
              phone: "13700000000",
              passwordHash: "123456",
              role: "administrator",
              status: "active",
            };
          }

          return [driverId, "driver-2"].includes(where.id ?? "") &&
            (!where.role || where.role === "driver") &&
            (where.teamId == null || where.teamId === teamId) &&
            (!where.status || where.status === "active")
            ? {
                id: where.id,
                teamId,
                name: "司机老李",
                phone: "13900000001",
                role: "driver",
                status: "active",
                isFirstLogin: false,
                driverBindings: state.bindings.map((binding) => ({
                  ...binding,
                  vehicle: {
                    id: binding.vehicleId,
                    plateNumber: binding.vehicleId === "vehicle-1" ? "沪A12345" : "苏B67890",
                    status: "available",
                    vehicleType: "9.6m van",
                  },
                })),
              }
            : state.users.find(
                  (user) =>
                    (!where.id || user.id === where.id) &&
                    (!where.phone || user.phone === where.phone) &&
                    (!where.role || user.role === where.role) &&
                    (where.teamId == null || user.teamId === where.teamId) &&
                    (!where.status || user.status === where.status),
                ) ?? null;
        },
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === driverId
            ? {
                id: driverId,
                teamId,
                name: "司机老李",
                phone: "13900000001",
                status: "active",
                role: "driver",
                isFirstLogin: false,
                team: teamSnapshot(),
                driverBindings: state.bindings.map((binding) => ({
                  ...binding,
                  vehicle: {
                    id: binding.vehicleId,
                    plateNumber: binding.vehicleId === "vehicle-1" ? "沪A12345" : "苏B67890",
                    status: "available",
                    vehicleType: "9.6米厢式货车",
                  },
                })),
              }
            : null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: data.role === "accountant" ? "member-created" : "driver-created",
          teamId: data.teamId ?? teamId,
          role: "driver",
          status: "active",
          isFirstLogin: true,
          createdAt: new Date("2026-05-27T00:20:00.000Z"),
          phone: "13800000009",
          ...data,
        }),
        update: async ({ data, where }: { data: Record<string, unknown>; where: { id: string } }) => ({
          id: where.id,
          teamId,
          name: where.id === driverId ? "司机老李" : where.id === accountantId ? "会计小周" : "Administrator",
          phone: where.id === driverId ? "13900000001" : where.id === accountantId ? "13800000000" : "13700000000",
          role: where.id === driverId ? "driver" : where.id === accountantId ? "accountant" : "administrator",
          status: "active",
          isFirstLogin: false,
          createdAt: new Date("2026-05-27T00:00:00.000Z"),
          driverBindings:
            where.id === driverId
              ? state.bindings.map((binding) => ({
                  ...binding,
                  vehicle: {
                    id: binding.vehicleId,
                    plateNumber: binding.vehicleId === "vehicle-1" ? "沪A12345" : "苏B67890",
                    status: "available",
                    vehicleType: "9.6m van",
                  },
                }))
              : [],
          ...data,
        }),
      },
      driverVehicleBinding: {
        findFirst: async ({
          where,
        }: {
          where: { vehicleId: string; driverId: string; teamId?: string };
        }) => {
          const binding = state.bindings.find(
            (item) => item.vehicleId === where.vehicleId && item.driverId === where.driverId,
          );
          return binding ? { ...binding, teamId: where.teamId ?? teamId } : null;
        },
        create: async ({ data }: { data: { vehicleId: string; driverId: string } }) => {
          const binding = { id: "binding-created", teamId, ...data };
          state.bindings.push(binding);
          return binding;
        },
        deleteMany: async ({ where }: { where: { vehicleId: string; driverId: string } }) => {
          const before = state.bindings.length;
          state.bindings = state.bindings.filter(
            (binding) =>
              binding.vehicleId !== where.vehicleId || binding.driverId !== where.driverId,
          );
          return { count: before - state.bindings.length };
        },
      },
      tripAssistantDriver: {
        createMany: async ({
          data,
        }: {
          data: Array<{ teamId: string; tripId: string; driverId: string }>;
        }) => {
          for (const item of data) {
            if (
              state.tripAssistantDrivers.some(
                (existing) => existing.tripId === item.tripId && existing.driverId === item.driverId,
              )
            ) {
              continue;
            }
            state.tripAssistantDrivers.push({
              id: `trip-assistant-${state.tripAssistantDrivers.length + 1}`,
              ...item,
            });
          }
          return { count: data.length };
        },
        deleteMany: async ({ where }: { where: { tripId: string } }) => {
          const before = state.tripAssistantDrivers.length;
          state.tripAssistantDrivers = state.tripAssistantDrivers.filter((item) => item.tripId !== where.tripId);
          return { count: before - state.tripAssistantDrivers.length };
        },
      },
      settlementSnapshot: {
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
        findMany: async (args: unknown = {}) => {
          state.settlementFindManyArgs = args;
          return (
          state.tripStatus === "completed"
            ? [
                {
                  id: "settlement-1",
                  actualFreight: decimal("1000.00"),
                  expenseTotal: decimal("340.00"),
                  profit: decimal("660.00"),
                  profitRate: decimal("0.6600"),
                  settledAt: new Date("2026-05-27T09:00:00.000Z"),
                  trip: {
                    ...tripSnapshot(),
                    status: "completed",
                    actualFreight: decimal("1000.00"),
                    vehicle: { id: "vehicle-1", plateNumber: "沪A12345" },
                    driver: { id: driverId, name: "司机老李" },
                  },
                },
              ]
            : []
          );
        },
      },
      driverPayroll: {
        findMany: async (args: { where?: Record<string, unknown>; skip?: number; take?: number } = {}) => {
          const matches = state.driverPayrolls
            .filter((payroll) => matchesPayrollWhere(payroll, args.where))
            .map(payrollWithRelations);
          const start = args.skip ?? 0;
          const end = args.take ? start + args.take : undefined;
          return matches.slice(start, end);
        },
        count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
          state.driverPayrolls.filter((payroll) => matchesPayrollWhere(payroll, where)).length,
        findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) => {
          const payroll = state.driverPayrolls.find((item) => matchesPayrollWhere(item, where));
          return payroll ? payrollWithRelations(payroll) : null;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const created = {
            id: `driver-payroll-${state.driverPayrolls.length + 1}`,
            teamId: String(data.teamId ?? teamId),
            driverId: String(data.driverId),
            salaryMonth: String(data.salaryMonth),
            type: String(data.type),
            amount: decimal(String(data.amount)),
            tripCount: data.tripCount == null ? null : Number(data.tripCount),
            unitAmount: data.unitAmount == null ? null : decimal(String(data.unitAmount)),
            paidAt: data.paidAt instanceof Date ? data.paidAt : null,
            note: data.note == null ? null : String(data.note),
            createdBy: String(data.createdBy),
            createdAt: new Date("2026-06-30T08:00:00.000Z"),
            updatedAt: new Date("2026-06-30T08:00:00.000Z"),
            driver: { id: String(data.driverId), name: "Driver One", phone: "13900000001" },
            creator: { id: String(data.createdBy), name: "Accountant One" },
          };
          state.driverPayrolls.push(created);
          return payrollWithRelations(created);
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const index = state.driverPayrolls.findIndex((item) => item.id === where.id);
          const existing = state.driverPayrolls[index];
          const updated = {
            ...existing,
            driverId: String(data.driverId ?? existing.driverId),
            salaryMonth: String(data.salaryMonth ?? existing.salaryMonth),
            type: String(data.type ?? existing.type),
            amount: data.amount == null ? existing.amount : decimal(String(data.amount)),
            tripCount: data.tripCount == null ? null : Number(data.tripCount),
            unitAmount: data.unitAmount == null ? null : decimal(String(data.unitAmount)),
            paidAt: data.paidAt instanceof Date ? data.paidAt : null,
            note: data.note == null ? null : String(data.note),
            updatedAt: new Date("2026-06-30T09:00:00.000Z"),
          };
          state.driverPayrolls[index] = updated;
          return payrollWithRelations(updated);
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = state.driverPayrolls.find((item) => item.id === where.id);
          state.driverPayrolls = state.driverPayrolls.filter((item) => item.id !== where.id);
          return existing;
        },
      },
      vehicleMaintenance: {
        findMany: async (args: { skip?: number; take?: number } = {}) => {
          state.maintenanceFindManyArgs = args;
          const start = args.skip ?? 0;
          const end = args.take ? start + args.take : undefined;
          return state.maintenanceRecords.slice(start, end);
        },
        count: async () => state.maintenanceRecords.length,
        findUnique: async ({ where }: { where: { id: string } }) =>
          state.maintenanceRecords.find((record) => record.id === where.id) ?? null,
        findFirst: async ({ where }: { where: { id: string } }) =>
          state.maintenanceRecords.find((record) => record.id === where.id) ?? null,
        create: async ({
          data,
        }: {
          data: {
            vehicleId: string;
            component: string;
            amount: string;
            occurredAt: Date;
            voucherStorageKey?: string | null;
            note?: string | null;
            createdBy: string;
          };
        }) => {
          const record = {
            id: "maintenance-created",
            vehicleId: data.vehicleId,
            component: data.component,
            amount: decimal(data.amount),
            occurredAt: data.occurredAt,
            voucherStorageKey: data.voucherStorageKey ?? null,
            note: data.note ?? null,
            createdAt: new Date("2026-05-27T10:00:00.000Z"),
            vehicle: { id: data.vehicleId, plateNumber: "沪A12345" },
            creator: { id: data.createdBy, name: "会计小周" },
          };
          state.maintenanceRecords.push(record);
          return record;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: {
            vehicleId: string;
            component: string;
            amount: string;
            occurredAt: Date;
            voucherStorageKey?: string | null;
            note?: string | null;
          };
        }) => {
          const index = state.maintenanceRecords.findIndex((item) => item.id === where.id);
          const updated = {
            ...state.maintenanceRecords[index],
            vehicleId: data.vehicleId,
            component: data.component,
            amount: decimal(data.amount),
            occurredAt: data.occurredAt,
            voucherStorageKey: data.voucherStorageKey ?? null,
            note: data.note ?? null,
            vehicle: { id: data.vehicleId, plateNumber: "娌狝12345" },
          };
          state.maintenanceRecords[index] = updated;
          return updated;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const record = state.maintenanceRecords.find((item) => item.id === where.id);
          state.maintenanceRecords = state.maintenanceRecords.filter((item) => item.id !== where.id);
          return record;
        },
      },
    };

  return {
    state,
    prisma,
  };
}

async function buildTestApp() {
  const mock = createPrismaMock();
  const app = buildApp(mock.prisma as never);
  return { ...mock, app };
}

describe("HaulHub API", () => {
  let mock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    mock = createPrismaMock();
    vi.unstubAllGlobals();
    delete process.env.AMAP_WEB_SERVICE_KEY;
    delete process.env.HAULHUB_SERVICE_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AMAP_WEB_SERVICE_KEY;
    delete process.env.HAULHUB_SERVICE_TOKEN;
  });

  it("rejects internal AI billing context requests without a service token", async () => {
    process.env.HAULHUB_SERVICE_TOKEN = "service-token";
    const app = buildApp(mock.prisma as never);

    const response = await app.inject({
      method: "GET",
      url: `/internal/ai-billing/context?teamId=${teamId}&userId=${accountantId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects internal AI billing context requests with the wrong service token", async () => {
    process.env.HAULHUB_SERVICE_TOKEN = "service-token";
    const app = buildApp(mock.prisma as never);

    const response = await app.inject({
      method: "GET",
      url: `/internal/ai-billing/context?teamId=${teamId}&userId=${accountantId}`,
      headers: { authorization: "Bearer wrong-token" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns team-scoped billing context for the AI service", async () => {
    process.env.HAULHUB_SERVICE_TOKEN = "service-token";
    mock.state.bindings.push({ id: "binding-other-team", vehicleId: "vehicle-other-team", driverId: "driver-other-team" });
    const app = buildApp(mock.prisma as never);

    const response = await app.inject({
      method: "GET",
      url: `/internal/ai-billing/context?teamId=${teamId}&userId=${accountantId}`,
      headers: { authorization: "Bearer service-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      vehicles: [
        {
          id: "vehicle-1",
          plateNumber: "沪A12345",
          status: "available",
        },
      ],
      drivers: [
        {
          id: driverId,
          name: "Driver One",
          phone: "13900000001",
          status: "active",
          boundVehicleIds: ["vehicle-1"],
        },
        {
          id: "driver-2",
          name: "Driver Two",
          phone: "13900000002",
          status: "active",
          boundVehicleIds: [],
        },
      ],
      expenseTypes: [
        { id: "expense-type-1", name: "油费", enabled: true },
        { id: "expense-type-2", name: "过路费", enabled: true },
      ],
    });
    expect(JSON.stringify(response.json())).not.toContain("driver-other-team");
    expect(mock.state.vehicleFindManyArgs).toMatchObject({ where: { teamId } });
    expect(mock.state.driverFindManyArgs).toMatchObject({ where: { teamId, role: "driver" } });
    expect(mock.state.expenseTypeFindManyArgs).toMatchObject({ where: { teamId, enabled: true } });
  });

  it("allows administrators to request team-scoped AI billing context", async () => {
    process.env.HAULHUB_SERVICE_TOKEN = "service-token";
    mock.state.users.push({
      id: "administrator-1",
      teamId: null,
      name: "Administrator",
      phone: "13700000000",
      role: "administrator",
      status: "active",
    });
    const app = buildApp(mock.prisma as never);

    const response = await app.inject({
      method: "GET",
      url: `/internal/ai-billing/context?teamId=${teamId}&userId=administrator-1`,
      headers: { authorization: "Bearer service-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().vehicles).toEqual([
      expect.objectContaining({
        id: "vehicle-1",
        status: "available",
      }),
    ]);
  });

  it("persists AI bill intake sessions for the AI service", async () => {
    const previousServiceToken = process.env.HAULHUB_SERVICE_TOKEN;
    process.env.HAULHUB_SERVICE_TOKEN = "service-token";
    const app = buildApp(mock.prisma as never);
    const headers = { authorization: "Bearer service-token" };

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/internal/ai-bill-intake/sessions",
        headers,
        payload: { teamId, userId: accountantId },
      });
      expect(createResponse.statusCode).toBe(200);
      expect(createResponse.json().session).toMatchObject({
        id: "ai-session-1",
        teamId,
        userId: accountantId,
        messages: [],
        imageUrls: [],
        reviewQuestions: [],
        warnings: [],
      });

      const messageResponse = await app.inject({
        method: "POST",
        url: "/internal/ai-bill-intake/sessions/ai-session-1/messages",
        headers,
        payload: { role: "user", content: "车辆是沪A·12345" },
      });
      expect(messageResponse.statusCode).toBe(200);
      expect(messageResponse.json().session.messages).toEqual([{ role: "user", content: "车辆是沪A·12345" }]);

      const updateResponse = await app.inject({
        method: "POST",
        url: "/internal/ai-bill-intake/sessions/ai-session-1/analysis",
        headers,
        payload: {
          imageUrls: ["data:image/jpeg;base64,abc"],
          result: {
            provider: "test",
            rawAgentResult: {},
            draftPayload: {
              vehicle: { value: "沪A·12345", matchedVehicleId: "vehicle-1", confidence: "high", needsReview: false },
              driver: { value: "司机老李", matchedDriverId: driverId, confidence: "high", needsReview: false },
              customerName: { value: "宏达建材", confidence: "high", needsReview: false },
              loadLocation: { value: "上海", confidence: "high", needsReview: false },
              unloadLocation: { value: "杭州", confidence: "high", needsReview: false },
              actualFreight: { value: "800", confidence: "high", needsReview: false },
              settledAt: { value: "2026-07-08", confidence: "high", needsReview: false },
              expenseModeSuggestion: "details",
              expenses: [],
            },
            reviewQuestions: [],
            warnings: ["工具链警告"],
            reply: "草稿已生成",
            toolTrace: [],
          },
        },
      });
      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().session.currentDraft.customerName.value).toBe("宏达建材");
      expect(updateResponse.json().session.lastResult.reply).toBe("草稿已生成");
      expect(updateResponse.json().session.imageUrls).toEqual(["data:image/jpeg;base64,abc"]);

      const getResponse = await app.inject({
        method: "GET",
        url: "/internal/ai-bill-intake/sessions/ai-session-1",
        headers,
      });
      expect(getResponse.statusCode).toBe(200);
      expect(getResponse.json().session.messages).toEqual([{ role: "user", content: "车辆是沪A·12345" }]);
      expect(getResponse.json().session.warnings).toEqual(["工具链警告"]);

      const listResponse = await app.inject({
        method: "GET",
        url: `/internal/ai-bill-intake/sessions?teamId=${teamId}&userId=${accountantId}`,
        headers,
      });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().sessions).toEqual([
        expect.objectContaining({
          id: "ai-session-1",
          status: "active",
          customerName: "宏达建材",
          reviewQuestionCount: 0,
          warningCount: 1,
          imageCount: 1,
          messageCount: 1,
          lastReply: "草稿已生成",
        }),
      ]);

      const submissionResponse = await app.inject({
        method: "POST",
        url: "/internal/ai-bill-intake/sessions/ai-session-1/submission",
        headers,
        payload: { submittedTripId: "trip-created-by-ai" },
      });
      expect(submissionResponse.statusCode).toBe(200);
      expect(submissionResponse.json().session.status).toBe("submitted");
      expect(submissionResponse.json().session.submittedTripId).toBe("trip-created-by-ai");
    } finally {
      if (previousServiceToken === undefined) delete process.env.HAULHUB_SERVICE_TOKEN;
      else process.env.HAULHUB_SERVICE_TOKEN = previousServiceToken;
    }
  });

  it("allows administrators to persist AI bill intake sessions for the selected team", async () => {
    const previousServiceToken = process.env.HAULHUB_SERVICE_TOKEN;
    process.env.HAULHUB_SERVICE_TOKEN = "service-token";
    mock.state.users.push({
      id: "administrator-1",
      teamId: null,
      name: "Administrator",
      phone: "13700000000",
      role: "administrator",
      status: "active",
    });
    const app = buildApp(mock.prisma as never);
    const headers = { authorization: "Bearer service-token" };

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/internal/ai-bill-intake/sessions",
        headers,
        payload: { teamId, userId: "administrator-1" },
      });

      expect(createResponse.statusCode).toBe(200);
      expect(createResponse.json().session).toMatchObject({
        id: "ai-session-1",
        teamId,
        userId: "administrator-1",
      });

      const listResponse = await app.inject({
        method: "GET",
        url: `/internal/ai-bill-intake/sessions?teamId=${teamId}&userId=administrator-1`,
        headers,
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().sessions).toEqual([expect.objectContaining({ id: "ai-session-1" })]);
    } finally {
      if (previousServiceToken === undefined) delete process.env.HAULHUB_SERVICE_TOKEN;
      else process.env.HAULHUB_SERVICE_TOKEN = previousServiceToken;
    }
  });

  it("hides freight and profit fields from driver trip detail", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: `/driver/trips/${tripId}`,
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.trip.customerName).toBe("恒通物流");
    expect(body.trip.estimatedFreight).toBeUndefined();
    expect(body.trip.actualFreight).toBeUndefined();
    expect(body.trip.profit).toBeUndefined();
    expect(body.trip.profitRate).toBeUndefined();
  });

  it("exposes receipt requirements on driver trip expenses", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: `/driver/trips/${tripId}`,
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });

    expect(response.statusCode).toBe(200);
    const expenses = response.json().trip.expenses;
    expect(expenses[0].expenseTypeId).toBe("expense-type-1");
    expect(expenses[0].requiresReceipt).toBe(true);
    expect(expenses[1].requiresReceipt).toBe(false);
  });

  it("lets an assistant driver view assigned trips without financial fields", async () => {
    mock.state.tripAssistantDrivers.push({
      id: "assistant-view-1",
      teamId,
      tripId,
      driverId: "driver-2",
    });
    const app = buildApp(mock.prisma as never);
    const listResponse = await app.inject({
      method: "GET",
      url: "/driver/trips",
      headers: {
        "x-user-id": "driver-2",
        "x-user-role": "driver",
      },
    });
    const detailResponse = await app.inject({
      method: "GET",
      url: `/driver/trips/${tripId}`,
      headers: {
        "x-user-id": "driver-2",
        "x-user-role": "driver",
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().trips[0]).toMatchObject({
      id: tripId,
      participantRole: "assistant",
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().trip.participantRole).toBe("assistant");
    expect(detailResponse.json().trip.actualFreight).toBeUndefined();
  });

  it("keeps assistant driver trips read-only on driver actions", async () => {
    mock.state.tripAssistantDrivers.push({
      id: "assistant-action-1",
      teamId,
      tripId,
      driverId: "driver-2",
    });
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/driver/trips/${tripId}/submit`,
      headers: {
        "x-user-id": "driver-2",
        "x-user-role": "driver",
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns the current driver profile with bound vehicles but no password hash", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/driver/me",
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });

    expect(response.statusCode).toBe(200);
    const driver = response.json().driver;
    expect(driver.id).toBe(driverId);
    expect(driver.name).toBe("司机老李");
    expect(driver.boundVehicles[0].plateNumber).toBe("沪A12345");
    expect(driver.passwordHash).toBeUndefined();
  });

  it("logs a driver in with phone and password", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        phone: "13900000001",
        password: "123456",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().session).toMatchObject({
      userId: driverId,
      role: "driver",
      name: "司机老李",
    });
    expect(response.json().session.passwordHash).toBeUndefined();
  });

  it("logs a driver in with a password digest", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        phone: "13900000001",
        passwordDigest: sha256("123456"),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().session).toMatchObject({
      userId: driverId,
      role: "driver",
    });
  });

  it("rejects uploads without a signed-in user", async () => {
    const app = buildApp(mock.prisma as never);
    const boundary = "----haulhub-test-boundary";
    const response = await app.inject({
      method: "POST",
      url: "/files",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="receipt.jpg"',
        "Content-Type: image/jpeg",
        "",
        "fake-image",
        `--${boundary}--`,
        "",
      ].join("\r\n"),
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects non-image uploads", async () => {
    const app = buildApp(mock.prisma as never);
    const boundary = "----haulhub-test-boundary";
    const response = await app.inject({
      method: "POST",
      url: "/files",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
      payload: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="receipt.txt"',
        "Content-Type: text/plain",
        "",
        "not image",
        `--${boundary}--`,
        "",
      ].join("\r\n"),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("仅支持上传图片文件");
  });

  it("stores image uploads and returns a file url", async () => {
    const app = buildApp(mock.prisma as never);
    const boundary = "----haulhub-test-boundary";
    const image = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: "#1262b8",
      },
    })
      .jpeg()
      .toBuffer();
    const response = await app.inject({
      method: "POST",
      url: "/files",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
      payload: multipartImagePayload({
        boundary,
        filename: "receipt.jpg",
        contentType: "image/jpeg",
        image,
      }),
    });

    expect(response.statusCode).toBe(200);
    const file = response.json().file;
    expect(file.storageKey).toMatch(/^uploads\/.+\.jpg$/);
    expect(file.url).toMatch(/^\/files\/.+\.jpg$/);
    expect(file.mimeType).toBe("image/jpeg");
    expect(file.sizeBytes).toBeGreaterThan(0);
  });

  it("compresses uploaded images to jpeg files no larger than 200KB", async () => {
    const app = buildApp(mock.prisma as never);
    const boundary = "----haulhub-test-boundary";
    const pixels = randomBytes(1400 * 1400 * 3);
    const image = await sharp(pixels, {
      raw: { width: 1400, height: 1400, channels: 3 },
    })
      .png()
      .toBuffer();
    expect(image.length).toBeGreaterThan(200 * 1024);

    const response = await app.inject({
      method: "POST",
      url: "/files",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
      payload: multipartImagePayload({
        boundary,
        filename: "receipt.png",
        contentType: "image/png",
        image,
      }),
    });

    expect(response.statusCode).toBe(200);
    const file = response.json().file;
    expect(file.storageKey).toMatch(/^uploads\/.+\.jpg$/);
    expect(file.url).toMatch(/^\/files\/.+\.jpg$/);
    expect(file.mimeType).toBe("image/jpeg");
    expect(file.sizeBytes).toBeLessThanOrEqual(200 * 1024);
  }, 15000);

  it("logs an administrator in with phone and password", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        phone: "13700000000",
        password: "123456",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().session).toMatchObject({
      userId: "administrator-1",
      role: "administrator",
      name: "Administrator",
    });
  });

  it("rejects login with an invalid password", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        phone: "13900000001",
        password: "bad-password",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects login for users in a disabled team", async () => {
    mock.state.teamStatus = "disabled";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        phone: "13900000001",
        password: "123456",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toBe("所属团队已停用，请联系管理员");
  });

  it("rejects existing driver sessions after their team is disabled", async () => {
    mock.state.teamStatus = "disabled";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/driver/me",
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toBe("所属团队已停用，请联系管理员");
  });

  it("rejects existing backend sessions after their team is disabled", async () => {
    mock.state.teamStatus = "disabled";
    mock.prisma.user.findUnique = async () => ({
      id: accountantId,
      teamId,
      name: "会计小周",
      phone: "13800000000",
      status: "active",
      role: "accountant",
      isFirstLogin: false,
      createdAt: new Date("2026-05-27T00:10:00.000Z"),
      team: {
        id: teamId,
        name: "默认团队",
        status: mock.state.teamStatus,
      },
      driverBindings: [],
    });
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/me",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
        "x-team-id": teamId,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toBe("所属团队已停用，请联系管理员");
  });

  it("allows a driver to submit an editable trip with required receipts", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/driver/trips/${tripId}/submit`,
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.status).toBe("submitted");
  });

  it("lets a driver start an assigned trip", async () => {
    mock.state.tripStatus = "assigned";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/driver/trips/${tripId}/start`,
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.status).toBe("in_progress");
  });

  it("rejects starting a trip when the driver already has one in progress", async () => {
    mock.state.tripStatus = "assigned";
    mock.state.conflictingTrip = {
      id: "trip-other",
      status: "in_progress",
      vehicleId: "vehicle-2",
      driverId,
    };
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/driver/trips/${tripId}/start`,
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe("你已有进行中的趟次，请先提交后再开始新的趟次");
  });

  it("exposes driver expense types and receipt image upload", async () => {
    const app = buildApp(mock.prisma as never);
    const typesResponse = await app.inject({
      method: "GET",
      url: "/driver/expense-types",
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });
    const receiptResponse = await app.inject({
      method: "POST",
      url: "/driver/expenses/expense-1/receipt-images",
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
      payload: {
        storageKey: "receipt-local.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1200,
      },
    });

    expect(typesResponse.statusCode).toBe(200);
    expect(typesResponse.json().expenseTypes[0].name).toBe("油费");
    expect(receiptResponse.statusCode).toBe(200);
    expect(receiptResponse.json().receiptImage.storageKey).toBe("receipt-local.jpg");
  });

  it("lets a driver delete their own receipt image while the trip is editable", async () => {
    mock.state.tripStatus = "in_progress";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/driver/receipt-images/receipt-1/delete",
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().deleted.id).toBe("receipt-1");
  });

  it("lets a driver update and delete an expense while the trip is editable", async () => {
    mock.state.tripStatus = "in_progress";
    const app = buildApp(mock.prisma as never);
    const updateResponse = await app.inject({
      method: "POST",
      url: "/driver/expenses/expense-1",
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
      payload: {
        amount: "380.00",
        occurredAt: "2026-05-27T05:08:00.000Z",
        note: "司机修正费用",
      },
    });
    const deleteResponse = await app.inject({
      method: "POST",
      url: "/driver/expenses/expense-1/delete",
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().expense.amount).toBe("380.00");
    expect(updateResponse.json().expense.note).toBe("司机修正费用");
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().deleted.id).toBe("expense-1");
  });

  it("rejects driver expense edits after review starts", async () => {
    mock.state.tripStatus = "under_review";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/driver/expenses/expense-1",
      headers: {
        "x-user-id": driverId,
        "x-user-role": "driver",
      },
      payload: {
        amount: "380.00",
        occurredAt: "2026-05-27T05:08:00.000Z",
        note: "不应允许",
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it("returns admin trip detail", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: `/admin/trips/${tripId}`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.estimatedFreight).toBe("1800.00");
    expect(response.json().trip.createdAt).toBe("2026-05-27T01:20:00.000Z");
  });

  it("passes admin trip filters to the database query", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/trips?status=submitted&q=%E6%B2%AAA12345",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mock.state.tripFindManyArgs).toMatchObject({
      where: {
        status: "submitted",
        AND: expect.arrayContaining([
          {
            OR: expect.arrayContaining([
              { tripNo: { contains: "沪A12345" } },
              { vehicle: { plateNumber: { contains: "沪A12345" } } },
              { driver: { name: { contains: "沪A12345" } } },
              { assistantDrivers: { some: { driver: { name: { contains: "沪A12345" } } } } },
            ]),
          },
        ]),
      },
    });
  });

  it("passes admin trip driver and vehicle filters to the database query", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: `/admin/trips?driverId=${driverId}&vehicleId=vehicle-1`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mock.state.tripFindManyArgs).toMatchObject({
      where: {
        vehicleId: "vehicle-1",
        AND: expect.arrayContaining([
          {
            OR: [{ driverId }, { assistantDrivers: { some: { driverId } } }],
          },
        ]),
      },
    });
  });

  it("passes multiple admin trip vehicle filters to the database query", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/trips?vehicleId=vehicle-1&vehicleId=vehicle-2",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mock.state.tripFindManyArgs).toMatchObject({
      where: {
        vehicleId: { in: ["vehicle-1", "vehicle-2"] },
      },
    });
  });

  it("ignores invalid admin trip status filters", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/trips?status=not-a-status",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mock.state.tripFindManyArgs).toMatchObject({
      where: {},
    });
  });

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
    const settlement = mock.state.manualSettlements[0] as {
      actualFreight: ReturnType<typeof decimal>;
      expenseTotal: ReturnType<typeof decimal>;
      profit: ReturnType<typeof decimal>;
      settledAt: Date;
    };
    expect(settlement).toMatchObject({
      actualFreight: expect.objectContaining({ toString: expect.any(Function) }),
      expenseTotal: expect.objectContaining({ toString: expect.any(Function) }),
      profit: expect.objectContaining({ toString: expect.any(Function) }),
    });
    expect(settlement.expenseTotal.toString()).toBe("340.50");
    expect(settlement.profit.toString()).toBe("659.50");
    expect(settlement.settledAt.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    expect(mock.state.auditLogs.at(-1)).toMatchObject({
      action: "trip.manual_completed_created",
      targetType: "Trip",
    });
  });

  it("creates a manual completed trip with a generated total-expense type", async () => {
    const manualTotalExpenseTypeName = "补录总费用";
    mock.state.expenseTypes = mock.state.expenseTypes.filter(
      (type) => type.name !== manualTotalExpenseTypeName,
    );
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
    expect(mock.state.expenseTypes.some((type) => type.name === manualTotalExpenseTypeName)).toBe(
      true,
    );
    expect(mock.state.manualExpenses).toHaveLength(1);
    const expense = mock.state.manualExpenses[0] as { expenseTypeNameSnapshot: string };
    const settlement = mock.state.manualSettlements[0] as { profit: ReturnType<typeof decimal> };
    expect(expense.expenseTypeNameSnapshot).toBe(manualTotalExpenseTypeName);
    expect(settlement.profit.toString()).toBe("680.00");
  });

  it("re-enables an existing disabled manual completed total-expense type without creating a duplicate", async () => {
    const manualTotalExpenseTypeName = "补录总费用";
    mock.state.expenseTypes.push({
      id: "expense-type-disabled-total",
      name: manualTotalExpenseTypeName,
      requiresReceipt: true,
      enabled: false,
      sortOrder: 7,
    });
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

    expect(response.statusCode).toBe(200);
    const matchingTypes = mock.state.expenseTypes.filter(
      (type) => type.name === manualTotalExpenseTypeName,
    );
    expect(matchingTypes).toHaveLength(1);
    expect(matchingTypes[0]).toMatchObject({
      id: "expense-type-disabled-total",
      requiresReceipt: false,
      enabled: true,
      sortOrder: 999,
    });
    expect(mock.state.manualExpenses[0]).toMatchObject({
      expenseTypeId: "expense-type-disabled-total",
      expenseTypeNameSnapshot: manualTotalExpenseTypeName,
    });
  });

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

  it("searches amap places through the backend without exposing the map key", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-map-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        expect(String(url)).toContain("key=test-map-key");
        expect(String(url)).toContain("keywords=%E5%98%89%E5%AE%9A");
        return new Response(
          JSON.stringify({
            status: "1",
            pois: [
              {
                id: "B001",
                name: "上海嘉定物流园3号门",
                address: "上海市嘉定区胜辛路88号",
                pname: "上海市",
                cityname: "上海市",
                adname: "嘉定区",
                location: "121.250801,31.366942",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/maps/places/search?q=嘉定",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().places).toEqual([
      {
        id: "B001",
        name: "上海嘉定物流园3号门",
        address: "上海市嘉定区胜辛路88号",
        city: "上海市",
        district: "嘉定区",
        latitude: 31.366942,
        longitude: 121.250801,
        provider: "amap",
      },
    ]);
  });

  it("returns a clear map configuration error when amap key is missing", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/maps/places/search?q=嘉定",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().message).toBe("地图服务未配置，请先设置 AMAP_WEB_SERVICE_KEY");
  });

  it("lets accountant create an assigned trip for an available bound driver and vehicle", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/trips",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        driverId,
        customerName: "恒通物流",
        loadLocation: "上海嘉定",
        unloadLocation: "杭州萧山",
        estimatedFreight: "1800.00",
        driverNote: "到仓库后联系王经理。",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.status).toBe("assigned");
    expect(response.json().trip.customerName).toBe("恒通物流");
    expect(response.json().trip.vehicle.id).toBe("vehicle-1");
    expect(response.json().trip.driver.id).toBe(driverId);
  });

  it("lets accountant add assistant drivers to a trip", async () => {
    mock.state.bindings.push({ id: "binding-2", vehicleId: "vehicle-1", driverId: "driver-2" });
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/trips",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        driverId,
        assistantDriverIds: ["driver-2"],
        customerName: "客户A",
        loadLocation: "上海嘉定",
        unloadLocation: "杭州萧山",
        estimatedFreight: "1800.00",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.assistantDrivers).toEqual([{ id: "driver-2", name: "司机小王" }]);
    expect(mock.state.tripAssistantDrivers).toMatchObject([
      { tripId: "trip-created", driverId: "driver-2" },
    ]);
  });

  it("persists precise trip locations when accountant creates a trip", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/trips",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        driverId,
        customerName: "恒通物流",
        loadLocation: "上海嘉定物流园3号门",
        loadAddress: "上海市嘉定区胜辛路88号",
        loadLatitude: 31.366942,
        loadLongitude: 121.250801,
        loadPoiId: "B001",
        unloadLocation: "杭州萧山仓库A区",
        unloadAddress: "杭州市萧山区建设一路99号",
        unloadLatitude: 30.183806,
        unloadLongitude: 120.264253,
        unloadPoiId: "B002",
        locationProvider: "amap",
        estimatedFreight: "1800.00",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.loadLocation).toBe("上海嘉定物流园3号门");
    expect(response.json().trip.loadAddress).toBe("上海市嘉定区胜辛路88号");
    expect(response.json().trip.loadLatitude).toBe(31.366942);
    expect(response.json().trip.loadLongitude).toBe(121.250801);
    expect(response.json().trip.unloadAddress).toBe("杭州市萧山区建设一路99号");
    expect(response.json().trip.unloadLatitude).toBe(30.183806);
    expect(response.json().trip.unloadLongitude).toBe(120.264253);
    expect(response.json().trip.locationProvider).toBe("amap");
  });

  it("rejects creating a trip when the vehicle already has an unsubmitted trip", async () => {
    mock.state.conflictingTrip = {
      id: "trip-other",
      status: "assigned",
      vehicleId: "vehicle-1",
      driverId: "driver-2",
    };
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/trips",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        driverId,
        customerName: "Test Customer",
        loadLocation: "涓婃捣鍢夊畾",
        unloadLocation: "鏉窞钀у北",
        estimatedFreight: "1800.00",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe("该车辆已有未提交趟次，请先提交或取消后再派单");
  });

  it("rejects creating an admin member with an existing phone number", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/members",
      headers: {
        "x-user-id": "administrator-1",
        "x-user-role": "administrator",
      },
      payload: {
        name: "重复管理员",
        phone: "13700000000",
        password: "123456",
        role: "administrator",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe("该手机号已存在，请换一个手机号");
  });

  it("lets accountant update an unfinished trip with a bound driver and vehicle", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/trips/${tripId}`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        driverId,
        customerName: "更新客户",
        loadLocation: "上海青浦",
        unloadLocation: "苏州吴中",
        estimatedFreight: "2100.00",
        driverNote: "更新司机备注",
        accountingNote: "内部备注",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.customerName).toBe("更新客户");
    expect(response.json().trip.loadLocation).toBe("上海青浦");
    expect(response.json().trip.estimatedFreight).toBe("2100.00");
  });

  it("keeps precise trip locations optional when accountant edits old trip data", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/trips/${tripId}`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        driverId,
        customerName: "更新客户",
        loadLocation: "上海青浦",
        unloadLocation: "苏州吴中",
        estimatedFreight: "2100.00",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.loadAddress).toBeNull();
    expect(response.json().trip.loadLatitude).toBeNull();
    expect(response.json().trip.unloadLongitude).toBeNull();
  });

  it("rejects updating a trip to a driver with another unsubmitted trip", async () => {
    mock.state.conflictingTrip = {
      id: "trip-other",
      status: "returned",
      vehicleId: "vehicle-2",
      driverId,
    };
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/trips/${tripId}`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        driverId,
        customerName: "鏇存柊瀹㈡埛",
        loadLocation: "涓婃捣闈掓郸",
        unloadLocation: "鑻忓窞鍚翠腑",
        estimatedFreight: "2100.00",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe("该司机已有未提交趟次，请先提交或取消后再派单");
  });

  it("rejects direct edits to a completed trip", async () => {
    mock.state.tripStatus = "completed";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/trips/${tripId}`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        driverId,
        customerName: "更新客户",
        loadLocation: "上海青浦",
        unloadLocation: "苏州吴中",
        estimatedFreight: "2100.00",
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it("lets accountant cancel an assigned trip with a reason", async () => {
    mock.state.tripStatus = "assigned";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/trips/${tripId}/cancel`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        reason: "客户取消运输计划",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.status).toBe("cancelled");
    expect(response.json().trip.returnReason).toBe("客户取消运输计划");
    expect(mock.state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "trip.cancelled",
        targetId: tripId,
      }),
    );
  });

  it("rejects cancelling trips after transport starts", async () => {
    mock.state.tripStatus = "in_progress";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/trips/${tripId}/cancel`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        reason: "客户取消运输计划",
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it("lets accountant create a vehicle", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/vehicles",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        plateNumber: "沪D·88990",
        vehicleType: "4.2米厢式货车",
        note: "新购车辆",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().vehicle.plateNumber).toBe("沪D·88990");
    expect(response.json().vehicle.status).toBe("available");
  });

  it("passes admin vehicle filters to the database query", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/vehicles?status=available&q=%E6%B2%AAA12345",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mock.state.vehicleFindManyArgs).toMatchObject({
      where: {
        status: "available",
        OR: expect.arrayContaining([
          { plateNumber: { contains: "沪A12345" } },
          { vehicleType: { contains: "沪A12345" } },
        ]),
      },
    });
  });

  it("lets accountant update a vehicle profile and status", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/vehicles/vehicle-1",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        plateNumber: "娌狝12345",
        vehicleType: "9.6m van",
        note: "杩涘満淇濆吇",
        status: "maintenance",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().vehicle.status).toBe("maintenance");
    expect(response.json().vehicle.vehicleType).toBe("9.6m van");
  });

  it("lets accountant create a driver account", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/drivers",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        name: "司机小赵",
        phone: "13900000009",
        initialPassword: "123456",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().driver.name).toBe("司机小赵");
    expect(response.json().driver.role).toBe("driver");
    expect(response.json().driver.status).toBe("active");
  });

  it("rejects creating a driver with an existing phone number", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/drivers",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        name: "重复司机",
        phone: "13900000001",
        initialPassword: "123456",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe("该手机号已存在，请换一个手机号");
  });

  it("passes admin driver filters to the database query", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/drivers?status=active&q=13900000001",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mock.state.driverFindManyArgs).toMatchObject({
      where: {
        role: "driver",
        status: "active",
        OR: expect.arrayContaining([
          { name: { contains: "13900000001" } },
          { phone: { contains: "13900000001" } },
        ]),
      },
    });
  });

  it("lets accountant update a driver profile and status", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/drivers/${driverId}`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        name: "鍙告満鑰佹潕",
        phone: "13900000001",
        status: "disabled",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().driver.status).toBe("disabled");
    expect(response.json().driver.phone).toBe("13900000001");
  });

  it("lets accountant reset a driver password and require first login", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/drivers/${driverId}/password`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        password: "123456",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().driver.isFirstLogin).toBe(true);
    expect(response.json().driver.role).toBe("driver");
  });

  it("lets accountant create an expense type", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/expense-types",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        name: "洗车费",
        requiresReceipt: false,
        sortOrder: 9,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().expenseType.name).toBe("洗车费");
    expect(response.json().expenseType.enabled).toBe(true);
  });

  it("passes admin expense type filters to the database query", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/expense-types?receiptRule=required&q=%E6%B2%B9%E8%B4%B9",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mock.state.expenseTypeFindManyArgs).toMatchObject({
      where: {
        requiresReceipt: true,
        name: { contains: "油费" },
      },
    });
  });

  it("returns and updates an expense type", async () => {
    const app = buildApp(mock.prisma as never);
    const detailResponse = await app.inject({
      method: "GET",
      url: "/admin/expense-types/expense-type-1",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });
    const updateResponse = await app.inject({
      method: "POST",
      url: "/admin/expense-types/expense-type-1",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        name: "燃油费",
        requiresReceipt: true,
        sortOrder: 2,
        enabled: false,
      },
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().expenseType.name).toBe("油费");
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().expenseType.name).toBe("燃油费");
    expect(updateResponse.json().expenseType.enabled).toBe(false);
    expect(updateResponse.json().expenseType.sortOrder).toBe(2);
  });

  it("returns vehicle detail with bound drivers", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/vehicles/vehicle-1",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().vehicle.plateNumber).toBe("沪A12345");
    expect(response.json().vehicle.boundDrivers[0].id).toBe(driverId);
  });

  it("lets accountant bind and unbind a driver to a vehicle", async () => {
    const app = buildApp(mock.prisma as never);
    const bindResponse = await app.inject({
      method: "POST",
      url: "/admin/vehicles/vehicle-1/drivers",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        driverId: "driver-2",
      },
    });
    const unbindResponse = await app.inject({
      method: "POST",
      url: "/admin/vehicles/vehicle-1/drivers/driver-2/unbind",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(bindResponse.statusCode).toBe(200);
    expect(bindResponse.json().binding.driverId).toBe("driver-2");
    expect(unbindResponse.statusCode).toBe(200);
    expect(unbindResponse.json().removed).toBe(1);
  });

  it("returns driver detail with bound vehicles", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: `/admin/drivers/${driverId}`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().driver.name).toBe("司机老李");
    expect(response.json().driver.boundVehicles[0].id).toBe("vehicle-1");
  });

  it("lets accountant bind and unbind a vehicle from a driver detail page", async () => {
    const app = buildApp(mock.prisma as never);
    const bindResponse = await app.inject({
      method: "POST",
      url: `/admin/drivers/${driverId}/vehicles`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
      },
    });
    const unbindResponse = await app.inject({
      method: "POST",
      url: `/admin/drivers/${driverId}/vehicles/vehicle-1/unbind`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(bindResponse.statusCode).toBe(200);
    expect(bindResponse.json().binding.vehicleId).toBe("vehicle-1");
    expect(unbindResponse.statusCode).toBe(200);
    expect(unbindResponse.json().removed).toBeGreaterThanOrEqual(1);
  });

  it("lets accountant start review and writes an audit log", async () => {
    mock.state.tripStatus = "submitted";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/trips/${tripId}/review`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.status).toBe("under_review");
    expect(mock.state.auditLogs).toHaveLength(1);
  });

  it("settles an under-review trip", async () => {
    mock.state.tripStatus = "under_review";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: `/admin/trips/${tripId}/settle`,
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        actualFreight: "1000.00",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.status).toBe("completed");
    expect(response.json().trip.profit).toBe("660.00");
  });

  it("returns profit report grouped by vehicle driver and expense type", async () => {
    mock.state.tripStatus = "completed";
    mock.state.tripAssistantDrivers.push({
      id: "trip-assistant-1",
      teamId,
      tripId,
      driverId: "driver-2",
    });
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/reports/profit",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.summary.tripCount).toBe(1);
    expect(body.byVehicle[0]).toMatchObject({
      id: "vehicle-1",
      label: "沪A12345",
      tripCount: 1,
      actualFreightTotal: "1000.00",
      expenseTotal: "340.00",
      profitTotal: "660.00",
    });
    expect(body.byDriver).toEqual([
      { id: driverId, label: "司机老李", tripCount: 1 },
      { id: "driver-2", label: "司机小王", tripCount: 1 },
    ]);
    expect(body.byExpenseType[0]).toMatchObject({
      label: "油费",
      total: "300.00",
    });
  });

  it("filters profit report by settlement date range", async () => {
    mock.state.tripStatus = "completed";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/reports/profit?from=2026-05-01&to=2026-05-31",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mock.state.settlementFindManyArgs).toMatchObject({
      where: {
        settledAt: {
          gte: new Date("2026-05-01T00:00:00.000+08:00"),
          lte: new Date("2026-05-31T23:59:59.999+08:00"),
        },
      },
    });
  });

  it("returns 400 for invalid profit report query values", async () => {
    const app = buildApp(mock.prisma as never);

    const invalidPeriod = await app.inject({
      method: "GET",
      url: "/admin/reports/profit?period=quarter",
      headers: accountantHeaders,
    });
    expect(invalidPeriod.statusCode).toBe(400);

    const invalidFrom = await app.inject({
      method: "GET",
      url: "/admin/reports/profit?period=month&from=abc&to=2026-06-30",
      headers: accountantHeaders,
    });
    expect(invalidFrom.statusCode).toBe(400);

    const invalidCalendarDate = await app.inject({
      method: "GET",
      url: "/admin/reports/profit?period=month&from=2026-02-31&to=2026-06-30",
      headers: accountantHeaders,
    });
    expect(invalidCalendarDate.statusCode).toBe(400);
  });

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
    const payrollId = createResponse.json().payroll.id;
    expect(createResponse.json().payroll).toMatchObject({
      id: payrollId,
      driverId,
      salaryMonth: "2026-06",
      type: "trip",
      amount: "1200.50",
      tripCount: 12,
      unitAmount: "100.00",
    });
    expect(mock.state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "driver_payroll.created",
        targetId: payrollId,
      }),
    );

    const detailResponse = await mock.app.inject({
      method: "GET",
      url: `/admin/driver-payrolls/${payrollId}`,
      headers: accountantHeaders,
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().payroll).toMatchObject({
      id: payrollId,
      driverId,
      salaryMonth: "2026-06",
    });

    const otherTeamDetailResponse = await mock.app.inject({
      method: "GET",
      url: `/admin/driver-payrolls/${payrollId}`,
      headers: { ...accountantHeaders, "x-team-id": otherTeamId },
    });
    expect(otherTeamDetailResponse.statusCode).toBe(200);
    expect(otherTeamDetailResponse.json().payroll.id).toBe(payrollId);

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
    expect(mock.state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "driver_payroll.updated",
        targetId: payrollId,
      }),
    );

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
    expect(mock.state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "driver_payroll.deleted",
        targetId: payrollId,
      }),
    );
    expect(mock.state.auditLogs.map((log) => (log as { action: string }).action)).toEqual([
      "driver_payroll.created",
      "driver_payroll.updated",
      "driver_payroll.deleted",
    ]);
  });

  it("scopes driver payroll lists and details to the current team", async () => {
    const mock = await buildTestApp();

    const createResponse = await mock.app.inject({
      method: "POST",
      url: "/admin/driver-payrolls",
      headers: accountantHeaders,
      payload: { driverId, salaryMonth: "2026-06", type: "fixed", amount: "1000.00" },
    });
    expect(createResponse.statusCode).toBe(200);

    const defaultPayroll = mock.state.driverPayrolls[0];
    mock.state.driverPayrolls.push({
      ...defaultPayroll,
      id: "driver-payroll-other-team",
      teamId: otherTeamId,
      driverId: "driver-other-team",
      driver: { id: "driver-other-team", name: "Other Team Driver", phone: "13900000003" },
    });

    const listResponse = await mock.app.inject({
      method: "GET",
      url: "/admin/driver-payrolls?month=2026-06",
      headers: accountantHeaders,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().payrolls.map((item: { id: string }) => item.id)).toEqual([
      createResponse.json().payroll.id,
    ]);

    const detailResponse = await mock.app.inject({
      method: "GET",
      url: "/admin/driver-payrolls/driver-payroll-other-team",
      headers: accountantHeaders,
    });
    expect(detailResponse.statusCode).toBe(404);
  });

  it("does not let an accountant spoof x-team-id to read another team's payrolls", async () => {
    const mock = await buildTestApp();

    const createResponse = await mock.app.inject({
      method: "POST",
      url: "/admin/driver-payrolls",
      headers: accountantHeaders,
      payload: { driverId, salaryMonth: "2026-06", type: "fixed", amount: "1000.00" },
    });
    expect(createResponse.statusCode).toBe(200);

    const defaultPayroll = mock.state.driverPayrolls[0];
    mock.state.driverPayrolls.push({
      ...defaultPayroll,
      id: "driver-payroll-other-team",
      teamId: otherTeamId,
      driverId: "driver-other-team",
      driver: { id: "driver-other-team", name: "Other Team Driver", phone: "13900000003" },
    });

    const spoofedListResponse = await mock.app.inject({
      method: "GET",
      url: "/admin/driver-payrolls?month=2026-06",
      headers: { ...accountantHeaders, "x-team-id": otherTeamId },
    });
    expect(spoofedListResponse.statusCode).toBe(200);
    expect(spoofedListResponse.json().payrolls.map((item: { id: string }) => item.id)).toEqual([
      createResponse.json().payroll.id,
    ]);

    const spoofedDetailResponse = await mock.app.inject({
      method: "GET",
      url: "/admin/driver-payrolls/driver-payroll-other-team",
      headers: { ...accountantHeaders, "x-team-id": otherTeamId },
    });
    expect(spoofedDetailResponse.statusCode).toBe(404);
  });

  it("validates driver payroll month, amount, type, role, and driver scope", async () => {
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

    const invalidCalendarPaidAt = await mock.app.inject({
      method: "POST",
      url: "/admin/driver-payrolls",
      headers: accountantHeaders,
      payload: { driverId, salaryMonth: "2026-06", type: "fixed", amount: "1000", paidAt: "2026-02-31" },
    });
    expect(invalidCalendarPaidAt.statusCode).toBe(400);

    const invalidPaidAtMonth = await mock.app.inject({
      method: "POST",
      url: "/admin/driver-payrolls",
      headers: accountantHeaders,
      payload: { driverId, salaryMonth: "2026-06", type: "fixed", amount: "1000", paidAt: "2026-99-99" },
    });
    expect(invalidPaidAtMonth.statusCode).toBe(400);

    const invalidCreateType = await mock.app.inject({
      method: "POST",
      url: "/admin/driver-payrolls",
      headers: accountantHeaders,
      payload: { driverId, salaryMonth: "2026-06", type: "unexpected", amount: "1000" },
    });
    expect(invalidCreateType.statusCode).toBe(400);

    const createResponse = await mock.app.inject({
      method: "POST",
      url: "/admin/driver-payrolls",
      headers: accountantHeaders,
      payload: { driverId, salaryMonth: "2026-06", type: "fixed", amount: "1000" },
    });
    expect(createResponse.statusCode).toBe(200);

    const invalidUpdateType = await mock.app.inject({
      method: "POST",
      url: `/admin/driver-payrolls/${createResponse.json().payroll.id}`,
      headers: accountantHeaders,
      payload: { driverId, salaryMonth: "2026-06", type: "unexpected", amount: "1000" },
    });
    expect(invalidUpdateType.statusCode).toBe(400);

    const invalidListType = await mock.app.inject({
      method: "GET",
      url: "/admin/driver-payrolls?type=unexpected",
      headers: accountantHeaders,
    });
    expect(invalidListType.statusCode).toBe(400);

    const otherTeamDriver = await mock.app.inject({
      method: "POST",
      url: "/admin/driver-payrolls",
      headers: accountantHeaders,
      payload: { driverId: "driver-other-team", salaryMonth: "2026-06", type: "fixed", amount: "1000" },
    });
    expect(otherTeamDriver.statusCode).toBe(404);

    const nonDriverUser = await mock.app.inject({
      method: "POST",
      url: "/admin/driver-payrolls",
      headers: accountantHeaders,
      payload: { driverId: accountantId, salaryMonth: "2026-06", type: "fixed", amount: "1000" },
    });
    expect(nonDriverUser.statusCode).toBe(404);

    const forbidden = await mock.app.inject({
      method: "POST",
      url: "/admin/driver-payrolls",
      headers: driverHeaders,
      payload: { driverId, salaryMonth: "2026-06", type: "fixed", amount: "1000" },
    });
    expect(forbidden.statusCode).toBe(403);
  });

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

  it("returns 400 for invalid driver payroll trip-count query", async () => {
    const mock = await buildTestApp();

    const response = await mock.app.inject({
      method: "GET",
      url: "/admin/driver-payrolls/trip-count?driverId=&month=2026-6",
      headers: accountantHeaders,
    });

    expect(response.statusCode).toBe(400);
  });

  it("lets accountant create vehicle maintenance expense records", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/vehicle-maintenance",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        component: "轮胎更换",
        amount: "680.00",
        occurredAt: "2026-05-18",
        voucherStorageKey: "maintenance/tire.jpg",
        note: "右后轮更换",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().record).toMatchObject({
      id: "maintenance-created",
      vehicleId: "vehicle-1",
      component: "轮胎更换",
      amount: "680.00",
      voucherStorageKey: "maintenance/tire.jpg",
      note: "右后轮更换",
    });
  });

  it("paginates and deletes vehicle maintenance records", async () => {
    mock.state.maintenanceRecords.push(
      {
        id: "maintenance-1",
        vehicleId: "vehicle-1",
        component: "轮胎更换",
        amount: decimal("680.00"),
        occurredAt: new Date("2026-05-18T03:00:00.000Z"),
        voucherStorageKey: null,
        note: null,
        createdAt: new Date("2026-05-18T03:10:00.000Z"),
        vehicle: { id: "vehicle-1", plateNumber: "沪A12345" },
        creator: { id: accountantId, name: "会计小周" },
      },
      {
        id: "maintenance-2",
        vehicleId: "vehicle-1",
        component: "刹车保养",
        amount: decimal("320.00"),
        occurredAt: new Date("2026-05-20T03:00:00.000Z"),
        voucherStorageKey: null,
        note: null,
        createdAt: new Date("2026-05-20T03:10:00.000Z"),
        vehicle: { id: "vehicle-1", plateNumber: "沪A12345" },
        creator: { id: accountantId, name: "会计小周" },
      },
    );
    const app = buildApp(mock.prisma as never);
    const listResponse = await app.inject({
      method: "GET",
      url: "/admin/vehicle-maintenance?page=1&pageSize=1",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });
    const deleteResponse = await app.inject({
      method: "DELETE",
      url: "/admin/vehicle-maintenance/maintenance-1",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(listResponse.json().records).toHaveLength(1);
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().deleted).toBe(true);
    expect(mock.state.maintenanceRecords.map((record) => record.id)).toEqual(["maintenance-2"]);
  });

  it("lets accountant update vehicle maintenance records", async () => {
    mock.state.maintenanceRecords.push({
      id: "maintenance-1",
      vehicleId: "vehicle-1",
      component: "杞儙鏇存崲",
      amount: decimal("680.00"),
      occurredAt: new Date("2026-05-18T03:00:00.000Z"),
      voucherStorageKey: null,
      note: null,
      createdAt: new Date("2026-05-18T03:10:00.000Z"),
      vehicle: { id: "vehicle-1", plateNumber: "娌狝12345" },
      creator: { id: accountantId, name: "浼氳灏忓懆" },
    });
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/vehicle-maintenance/maintenance-1",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        vehicleId: "vehicle-1",
        component: "鍒硅溅淇濆吇",
        amount: "320.00",
        occurredAt: "2026-05-20",
        voucherStorageKey: "maintenance/brake.jpg",
        note: "淇濆吇鍒硅溅",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().record).toMatchObject({
      id: "maintenance-1",
      component: "鍒硅溅淇濆吇",
      amount: "320.00",
      voucherStorageKey: "maintenance/brake.jpg",
      note: "淇濆吇鍒硅溅",
    });
    expect(mock.state.maintenanceRecords[0]?.component).toBe("鍒硅溅淇濆吇");
  });

  it("includes vehicle maintenance expenses in profit report and period groups", async () => {
    mock.state.tripStatus = "completed";
    mock.state.maintenanceRecords.push({
      id: "maintenance-1",
      vehicleId: "vehicle-1",
      component: "轮胎更换",
      amount: decimal("680.00"),
      occurredAt: new Date("2026-05-18T03:00:00.000Z"),
      voucherStorageKey: null,
      note: null,
      createdAt: new Date("2026-05-18T03:10:00.000Z"),
      vehicle: { id: "vehicle-1", plateNumber: "沪A12345" },
      creator: { id: accountantId, name: "会计小周" },
    });
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/reports/profit?period=month",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.summary).toMatchObject({
      tripExpenseTotal: "340.00",
      maintenanceExpenseTotal: "680.00",
      expenseTotal: "1020.00",
      profitTotal: "-20.00",
    });
    expect(body.byVehicle[0]).toMatchObject({
      expenseTotal: "1020.00",
      profitTotal: "-20.00",
    });
    expect(body.byExpenseType).toContainEqual({
      id: "vehicle-maintenance",
      label: "车辆维修",
      total: "680.00",
    });
    expect(body.byPeriod[0]).toMatchObject({
      period: "2026-05",
      tripExpenseTotal: "340.00",
      maintenanceExpenseTotal: "680.00",
      totalExpense: "1020.00",
      profitTotal: "-20.00",
    });
  });

  it("includes monthly and yearly driver payroll expenses in profit reports", async () => {
    mock.state.driverPayrolls.push({
      id: "driver-payroll-report-1",
      teamId,
      driverId,
      salaryMonth: "2026-06",
      type: "fixed",
      amount: decimal("1000.00"),
      tripCount: null,
      unitAmount: null,
      paidAt: null,
      note: null,
      createdBy: accountantId,
      createdAt: new Date("2026-06-30T08:00:00.000Z"),
      updatedAt: new Date("2026-06-30T08:00:00.000Z"),
      driver: { id: driverId, name: "Driver One", phone: "13900000001" },
      creator: { id: accountantId, name: "Accountant One" },
    });
    const app = buildApp(mock.prisma as never);

    const monthlyResponse = await app.inject({
      method: "GET",
      url: "/admin/reports/profit?period=month&from=2026-06-01&to=2026-06-30",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(monthlyResponse.statusCode).toBe(200);
    const monthlyBody = monthlyResponse.json();
    expect(monthlyBody.summary).toMatchObject({
      driverPayrollTotal: "1000.00",
      expenseTotal: "1000.00",
      profitTotal: "-1000.00",
      profitRate: null,
      payrollNotice: null,
    });
    expect(monthlyBody.byPeriod[0]).toMatchObject({
      period: "2026-06",
      driverPayrollTotal: "1000.00",
      totalExpense: "1000.00",
      profitTotal: "-1000.00",
    });
    expect(monthlyBody.byExpenseType).toContainEqual({
      id: "driver-payroll",
      label: "司机工资",
      total: "1000.00",
    });

    const yearlyResponse = await app.inject({
      method: "GET",
      url: "/admin/reports/profit?period=year&from=2026-01-01&to=2026-12-31",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(yearlyResponse.statusCode).toBe(200);
    const yearlyBody = yearlyResponse.json();
    expect(yearlyBody.summary.driverPayrollTotal).toBe("1000.00");
    expect(yearlyBody.byPeriod[0]).toMatchObject({
      period: "2026",
      driverPayrollTotal: "1000.00",
    });
  });

  it("does not let an accountant spoof x-team-id to include another team's payrolls in profit reports", async () => {
    mock.state.driverPayrolls.push({
      id: "driver-payroll-report-1",
      teamId,
      driverId,
      salaryMonth: "2026-06",
      type: "fixed",
      amount: decimal("1000.00"),
      tripCount: null,
      unitAmount: null,
      paidAt: null,
      note: null,
      createdBy: accountantId,
      createdAt: new Date("2026-06-30T08:00:00.000Z"),
      updatedAt: new Date("2026-06-30T08:00:00.000Z"),
      driver: { id: driverId, name: "Driver One", phone: "13900000001" },
      creator: { id: accountantId, name: "Accountant One" },
    });
    mock.state.driverPayrolls.push({
      id: "driver-payroll-report-other-team",
      teamId: otherTeamId,
      driverId: "driver-other-team",
      salaryMonth: "2026-06",
      type: "fixed",
      amount: decimal("9999.00"),
      tripCount: null,
      unitAmount: null,
      paidAt: null,
      note: null,
      createdBy: "accountant-other-team",
      createdAt: new Date("2026-06-30T08:00:00.000Z"),
      updatedAt: new Date("2026-06-30T08:00:00.000Z"),
      driver: { id: "driver-other-team", name: "Other Team Driver", phone: "13900000003" },
      creator: { id: "accountant-other-team", name: "Other Team Accountant" },
    });
    const app = buildApp(mock.prisma as never);

    const response = await app.inject({
      method: "GET",
      url: "/admin/reports/profit?period=month&from=2026-06-01&to=2026-06-30",
      headers: { ...accountantHeaders, "x-team-id": otherTeamId },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.summary.driverPayrollTotal).toBe("1000.00");
    expect(body.summary.driverPayrollTotal).not.toBe("9999.00");
    expect(body.byExpenseType).toContainEqual(
      expect.objectContaining({ id: "driver-payroll", total: "1000.00" }),
    );
    expect(body.byExpenseType).not.toContainEqual(
      expect.objectContaining({ id: "driver-payroll", total: "9999.00" }),
    );
  });

  it("excludes monthly driver payroll expenses from weekly profit reports", async () => {
    mock.state.driverPayrolls.push({
      id: "driver-payroll-report-1",
      teamId,
      driverId,
      salaryMonth: "2026-06",
      type: "fixed",
      amount: decimal("1000.00"),
      tripCount: null,
      unitAmount: null,
      paidAt: null,
      note: null,
      createdBy: accountantId,
      createdAt: new Date("2026-06-30T08:00:00.000Z"),
      updatedAt: new Date("2026-06-30T08:00:00.000Z"),
      driver: { id: driverId, name: "Driver One", phone: "13900000001" },
      creator: { id: accountantId, name: "Accountant One" },
    });
    const app = buildApp(mock.prisma as never);

    const response = await app.inject({
      method: "GET",
      url: "/admin/reports/profit?period=week&from=2026-06-01&to=2026-06-30",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.summary).toMatchObject({
      driverPayrollTotal: "0.00",
      expenseTotal: "0.00",
      profitTotal: "0.00",
      payrollNotice: expect.stringContaining("按月归属"),
    });
    expect(body.byExpenseType).not.toContainEqual(
      expect.objectContaining({ id: "driver-payroll" }),
    );
  });

  it("lets administrator manage backend members", async () => {
    const app = buildApp(mock.prisma as never);
    const listResponse = await app.inject({
      method: "GET",
      url: "/admin/members",
      headers: {
        "x-user-id": "administrator-1",
        "x-user-role": "administrator",
      },
    });
    const createResponse = await app.inject({
      method: "POST",
      url: "/admin/members",
      headers: {
        "x-user-id": "administrator-1",
        "x-user-role": "administrator",
      },
      payload: {
        name: "会计小陈",
        phone: "13800000009",
        password: "123456",
        role: "accountant",
      },
    });
    const disableResponse = await app.inject({
      method: "POST",
      url: "/admin/members/accountant-1/status",
      headers: {
        "x-user-id": "administrator-1",
        "x-user-role": "administrator",
      },
      payload: { status: "disabled" },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().members[0].role).toBe("administrator");
    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().member.role).toBe("accountant");
    expect(disableResponse.statusCode).toBe(200);
    expect(disableResponse.json().member.status).toBe("disabled");
  });

  it("rejects accountant access to backend member management", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/members",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns audit logs with filters and parsed payloads", async () => {
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "GET",
      url: "/admin/audit-logs?targetType=Trip&action=trip.review_started",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mock.state.auditLogFindManyArgs).toMatchObject({
      where: {
        targetType: "Trip",
        action: "trip.review_started",
      },
      take: 100,
    });
    expect(response.json().logs[0]).toMatchObject({
      actorName: "会计小周",
      action: "trip.review_started",
      before: { status: "submitted" },
      after: { status: "under_review" },
    });
  });

  it("lets accountant update and delete expenses during review with audit logs", async () => {
    mock.state.tripStatus = "under_review";
    const app = buildApp(mock.prisma as never);
    const updateResponse = await app.inject({
      method: "POST",
      url: "/admin/expenses/expense-1",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        amount: "350.00",
        note: "会计修正金额",
      },
    });
    const deleteResponse = await app.inject({
      method: "POST",
      url: "/admin/expenses/expense-1/delete",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().expense.amount).toBe("350.00");
    expect(deleteResponse.statusCode).toBe(200);
    expect(mock.state.auditLogs).toHaveLength(2);
  });

  it("lets accountant attach a receipt image to an admin expense", async () => {
    mock.state.tripStatus = "completed";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/expenses/expense-1/receipt-images",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        storageKey: "receipt-admin.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().receiptImage).toMatchObject({
      id: "receipt-created",
      expenseId: "expense-1",
      storageKey: "receipt-admin.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 2048,
    });
    expect(mock.state.receipts.at(-1)?.storageKey).toBe("receipt-admin.jpg");
  });

  it("lets accountant delete an admin receipt image", async () => {
    mock.state.tripStatus = "completed";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/receipt-images/receipt-1/delete",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().deleted.id).toBe("receipt-1");
    expect(mock.state.receipts.some((receipt) => receipt.id === "receipt-1")).toBe(false);
  });

  it("rejects accountant receipt image changes on cancelled trips", async () => {
    mock.state.tripStatus = "cancelled";
    const app = buildApp(mock.prisma as never);
    const attachResponse = await app.inject({
      method: "POST",
      url: "/admin/expenses/expense-1/receipt-images",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        storageKey: "receipt-admin.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
      },
    });
    const deleteResponse = await app.inject({
      method: "POST",
      url: "/admin/receipt-images/receipt-1/delete",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
    });

    expect(attachResponse.statusCode).toBe(409);
    expect(attachResponse.json().message).toBe("已撤销趟次不能上传票据");
    expect(deleteResponse.statusCode).toBe(409);
    expect(deleteResponse.json().message).toBe("已撤销趟次不能删除票据");
  });

  it("rejects accountant expense edits before review starts", async () => {
    mock.state.tripStatus = "submitted";
    const app = buildApp(mock.prisma as never);
    const response = await app.inject({
      method: "POST",
      url: "/admin/expenses/expense-1",
      headers: {
        "x-user-id": accountantId,
        "x-user-role": "accountant",
      },
      payload: {
        amount: "350.00",
        note: "会计修正金额",
      },
    });

    expect(response.statusCode).toBe(409);
  });
});
