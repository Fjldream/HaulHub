import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { buildApp } from "../src/app";

const accountantId = "accountant-1";
const driverId = "driver-1";
const tripId = "trip-1";
const teamId = "team-default";

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

function createPrismaMock() {
  const state = {
    tripStatus: "in_progress",
    auditLogs: [] as unknown[],
    receipts: [{ id: "receipt-1", storageKey: "r1.jpg" }],
    bindings: [{ id: "binding-1", vehicleId: "vehicle-1", driverId }],
    conflictingTrip: null as null | {
      id: string;
      status: string;
      vehicleId: string;
      driverId: string;
    },
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
  };

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
      vehicleId: "vehicle-1",
      driverId,
      teamId,
      status: state.tripStatus,
      expenses: trip.expenses,
    };
  }

  return {
    state,
    prisma: {
      trip: {
        findMany: async (args: { where?: { driverId?: string } } = {}) => {
          state.tripFindManyArgs = args;
          return args.where?.driverId === driverId || !args.where?.driverId ? [tripSnapshot()] : [];
        },
        findFirst: async (args: { where?: Record<string, unknown> } = {}) => {
          state.tripFindFirstArgs.push(args);
          const where = args.where ?? {};

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
        findUnique: async () => tripSnapshot(),
        create: async ({ data }: { data: Record<string, string | undefined> }) => ({
          ...tripSnapshot(),
          ...data,
          id: "trip-created",
          tripNo: "HH20260527120000",
          createdAt: new Date("2026-05-27T12:00:00.000Z"),
          submittedAt: null,
          reviewStartedAt: null,
          completedAt: null,
          actualFreight: null,
          expenses: [],
          settlement: null,
          vehicle: { id: data.vehicleId, plateNumber: "沪A12345" },
          driver: { id: data.driverId, name: "司机老李" },
        }),
        update: async ({ data }: { data: { status?: string; actualFreight?: string } }) => {
          state.tripStatus = data.status ?? state.tripStatus;
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
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "expense-created",
          ...data,
        }),
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
        findFirst: async () => ({
          id: "expense-type-1",
          name: "油费",
          enabled: true,
          requiresReceipt: true,
          sortOrder: 1,
        }),
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
        findMany: async (args: unknown = {}) => {
          state.expenseTypeFindManyArgs = args;
          return [
            { id: "expense-type-1", name: "油费", requiresReceipt: true, enabled: true, sortOrder: 1 },
          ];
        },
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "expense-type-created",
          enabled: true,
          ...data,
        }),
        update: async ({
          data,
          where,
        }: {
          data: Record<string, unknown>;
          where: { id: string };
        }) => ({
          id: where.id,
          name: "油费",
          requiresReceipt: true,
          enabled: true,
          sortOrder: 1,
          ...data,
        }),
      },
      receiptImage: {
        findFirst: async ({ where }: { where: { id: string } }) =>
          where.id === "receipt-1"
            ? {
                id: "receipt-1",
                storageKey: "r1.jpg",
                expense: {
                  id: "expense-1",
                  trip: tripSnapshot(),
                },
              }
            : null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "receipt-created",
          ...data,
        }),
        delete: async ({ where }: { where: { id: string } }) => ({ id: where.id }),
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
        findMany: async (args: unknown = {}) => {
          state.vehicleFindManyArgs = args;
          return [];
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
        findMany: async (args: { where?: { role?: string | { in?: string[] } } } = {}) => {
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
          return [];
        },
        findFirst: async ({
          where,
        }: {
          where: { id?: string; phone?: string; role?: string; status?: string };
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
            : null;
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
        }) =>
          where.vehicleId === "vehicle-1" && where.driverId === driverId
            ? { id: "binding-1", teamId, vehicleId: "vehicle-1", driverId }
            : null,
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
      settlementSnapshot: {
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
    },
  };
}

describe("HaulHub API", () => {
  let mock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    mock = createPrismaMock();
    vi.unstubAllGlobals();
    delete process.env.AMAP_WEB_SERVICE_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AMAP_WEB_SERVICE_KEY;
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
        OR: expect.arrayContaining([
          { tripNo: { contains: "沪A12345" } },
          { vehicle: { plateNumber: { contains: "沪A12345" } } },
          { driver: { name: { contains: "沪A12345" } } },
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
        driverId,
        vehicleId: "vehicle-1",
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
    expect(body.byDriver[0].label).toBe("司机老李");
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
