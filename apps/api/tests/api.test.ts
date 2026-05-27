import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const accountantId = "accountant-1";
const driverId = "driver-1";
const tripId = "trip-1";

function decimal(value: string) {
  return { toString: () => value };
}

function createPrismaMock() {
  const state = {
    tripStatus: "in_progress",
    auditLogs: [] as unknown[],
  };

  const trip = {
    id: tripId,
    tripNo: "HH001",
    status: state.tripStatus,
    customerName: "恒通物流",
    loadLocation: "上海",
    unloadLocation: "杭州",
    estimatedFreight: decimal("1800.00"),
    actualFreight: null,
    returnReason: null,
    createdAt: new Date(),
    vehicle: { id: "vehicle-1", plateNumber: "沪A12345" },
    driver: { id: driverId, name: "司机老李" },
    expenses: [
      {
        id: "expense-1",
        expenseTypeNameSnapshot: "油费",
        amount: decimal("300.00"),
        occurredAt: new Date("2026-05-27T00:00:00.000Z"),
        note: "加油",
        receiptImages: [{ id: "receipt-1", storageKey: "r1.jpg" }],
        expenseType: { requiresReceipt: true },
      },
    ],
    settlement: null,
  };

  return {
    state,
    prisma: {
      trip: {
        findMany: async ({ where }: { where?: { driverId?: string } }) =>
          where?.driverId === driverId || !where ? [{ ...trip, status: state.tripStatus }] : [],
        findFirst: async () => ({ ...trip, status: state.tripStatus }),
        findUnique: async () => ({ ...trip, status: state.tripStatus }),
        update: async ({ data }: { data: { status?: string } }) => {
          state.tripStatus = data.status ?? state.tripStatus;
          return {
            ...trip,
            status: state.tripStatus,
            actualFreight: data.status === "completed" ? decimal("1000.00") : null,
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
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "expense-created",
          ...data,
        }),
      },
      expenseType: {
        findFirst: async () => ({
          id: "expense-type-1",
          name: "油费",
          enabled: true,
        }),
        findMany: async () => [],
      },
      auditLog: {
        create: async ({ data }: { data: unknown }) => {
          state.auditLogs.push(data);
          return data;
        },
      },
      vehicle: { findMany: async () => [] },
      user: { findMany: async () => [] },
      settlementSnapshot: { findMany: async () => [] },
    },
  };
}

describe("HaulHub API", () => {
  let mock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    mock = createPrismaMock();
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
    expect(response.json().trip.profit).toBe("700.00");
  });
});
