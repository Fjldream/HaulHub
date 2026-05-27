import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { PrismaClient } from "@prisma/client";
import {
  assertTripStatusTransition,
  canDriverEditTrip,
  type TripStatus,
} from "@haulhub/shared";
import Fastify from "fastify";
import { z } from "zod";
import { getCurrentUser, requireRole } from "./auth";
import { calculateSettlement } from "./finance";
import { serializeTripForAdmin, serializeTripForDriver } from "./serializers";

const tripInclude = {
  vehicle: true,
  driver: true,
  expenses: {
    include: {
      receiptImages: true,
    },
  },
  settlement: true,
} as const;

const tripStatuses = new Set<TripStatus>([
  "assigned",
  "in_progress",
  "submitted",
  "under_review",
  "completed",
  "returned",
]);

function toTripStatus(status: string): TripStatus {
  if (!tripStatuses.has(status as TripStatus)) {
    throw Object.assign(new Error(`Unknown trip status: ${status}`), { statusCode: 500 });
  }

  return status as TripStatus;
}

interface ExpenseWithReceiptRequirement {
  expenseTypeNameSnapshot: string;
  expenseType: {
    requiresReceipt: boolean;
  };
  receiptImages: unknown[];
}

interface ExpenseAmount {
  amount: {
    toString(): string;
  };
}

interface SettlementAmount {
  actualFreight: {
    toString(): string;
  };
  expenseTotal: {
    toString(): string;
  };
  profit: {
    toString(): string;
  };
}

type AppPrisma = Pick<
  PrismaClient,
  | "trip"
  | "expense"
  | "expenseType"
  | "receiptImage"
  | "auditLog"
  | "vehicle"
  | "user"
  | "settlementSnapshot"
>;

export function buildApp(prisma: AppPrisma = new PrismaClient()) {
  const app = Fastify({ logger: false });

  app.register(cors);
  app.register(multipart);

  app.get("/health", async () => ({ ok: true }));

  app.get("/driver/trips", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");

    const trips = await prisma.trip.findMany({
      where: { driverId: user.id },
      include: tripInclude,
      orderBy: { createdAt: "desc" },
    });

    return { trips: trips.map(serializeTripForDriver) };
  });

  app.get("/driver/trips/:tripId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, driverId: user.id },
      include: tripInclude,
    });

    if (!trip) {
      return reply.code(404).send({ message: "Trip not found" });
    }

    return { trip: serializeTripForDriver(trip) };
  });

  app.post("/driver/trips/:tripId/submit", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, driverId: user.id },
      include: { expenses: { include: { expenseType: true, receiptImages: true } } },
    });

    if (!trip) {
      return reply.code(404).send({ message: "Trip not found" });
    }
    if (!canDriverEditTrip(toTripStatus(trip.status))) {
      return reply.code(409).send({ message: "当前状态不能提交账单" });
    }

    const missingReceipt = trip.expenses.find(
      (expense: ExpenseWithReceiptRequirement) =>
        expense.expenseType.requiresReceipt && expense.receiptImages.length === 0,
    );
    if (missingReceipt) {
      return reply.code(400).send({
        message: `请上传${missingReceipt.expenseTypeNameSnapshot}票据照片`,
      });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "submitted");

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "submitted", submittedAt: new Date() },
      include: tripInclude,
    });

    return { trip: serializeTripForDriver(updated) };
  });

  app.post("/driver/expenses", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const body = z
      .object({
        tripId: z.string(),
        expenseTypeId: z.string(),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        occurredAt: z.string().datetime(),
        note: z.string().optional(),
      })
      .parse(request.body);

    const trip = await prisma.trip.findFirst({
      where: { id: body.tripId, driverId: user.id },
    });
    if (!trip) {
      return reply.code(404).send({ message: "Trip not found" });
    }
    if (!canDriverEditTrip(toTripStatus(trip.status))) {
      return reply.code(409).send({ message: "当前状态不能新增费用" });
    }

    const expenseType = await prisma.expenseType.findFirst({
      where: { id: body.expenseTypeId, enabled: true },
    });
    if (!expenseType) {
      return reply.code(400).send({ message: "费用类型不可用" });
    }

    const expense = await prisma.expense.create({
      data: {
        tripId: trip.id,
        expenseTypeId: expenseType.id,
        expenseTypeNameSnapshot: expenseType.name,
        amount: body.amount,
        occurredAt: new Date(body.occurredAt),
        note: body.note,
        createdBy: user.id,
      },
    });

    return { expense };
  });

  app.get("/driver/expense-types", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");

    return {
      expenseTypes: await prisma.expenseType.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
      }),
    };
  });

  app.post("/driver/expenses/:expenseId/receipt-images", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { expenseId } = z.object({ expenseId: z.string() }).parse(request.params);
    const body = z
      .object({
        storageKey: z.string().min(1),
        mimeType: z.string().min(1).default("image/jpeg"),
        sizeBytes: z.number().int().positive().default(1),
      })
      .parse(request.body);

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, trip: { driverId: user.id } },
      include: { trip: true },
    });
    if (!expense) {
      return reply.code(404).send({ message: "Expense not found" });
    }
    if (!canDriverEditTrip(toTripStatus(expense.trip.status))) {
      return reply.code(409).send({ message: "当前状态不能上传票据" });
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

  app.get("/admin/trips", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");

    const trips = await prisma.trip.findMany({
      include: tripInclude,
      orderBy: { createdAt: "desc" },
    });

    return { trips: trips.map(serializeTripForAdmin) };
  });

  app.get("/admin/trips/:tripId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: tripInclude,
    });

    if (!trip) {
      return reply.code(404).send({ message: "Trip not found" });
    }

    return { trip: serializeTripForAdmin(trip) };
  });

  app.post("/admin/trips/:tripId/review", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return reply.code(404).send({ message: "Trip not found" });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "under_review");

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "under_review", reviewStartedAt: new Date() },
      include: tripInclude,
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        targetType: "Trip",
        targetId: trip.id,
        action: "trip.review_started",
        before: JSON.stringify({ status: trip.status }),
        after: JSON.stringify({ status: "under_review" }),
      },
    });

    return { trip: serializeTripForAdmin(updated) };
  });

  app.post("/admin/trips/:tripId/return", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);
    const { reason } = z.object({ reason: z.string().min(1) }).parse(request.body);

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return reply.code(404).send({ message: "Trip not found" });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "returned");

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "returned", returnReason: reason },
      include: tripInclude,
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        targetType: "Trip",
        targetId: trip.id,
        action: "trip.returned",
        before: JSON.stringify({ status: trip.status }),
        after: JSON.stringify({ status: "returned", reason }),
      },
    });

    return { trip: serializeTripForAdmin(updated) };
  });

  app.post("/admin/trips/:tripId/settle", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);
    const { actualFreight } = z
      .object({ actualFreight: z.string().regex(/^\d+(\.\d{1,2})?$/) })
      .parse(request.body);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { expenses: true },
    });
    if (!trip) {
      return reply.code(404).send({ message: "Trip not found" });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "completed");

    const settlement = calculateSettlement(
      actualFreight,
      trip.expenses.map((expense: ExpenseAmount) => expense.amount.toString()),
    );

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: "completed",
        actualFreight: settlement.actualFreight,
        completedAt: new Date(),
        settlement: {
          create: {
            actualFreight: settlement.actualFreight,
            expenseTotal: settlement.expenseTotal,
            profit: settlement.profit,
            profitRate: settlement.profitRate,
            settledBy: user.id,
          },
        },
      },
      include: tripInclude,
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        targetType: "Trip",
        targetId: trip.id,
        action: "trip.settled",
        before: JSON.stringify({ status: trip.status }),
        after: JSON.stringify({ status: "completed", ...settlement }),
      },
    });

    return { trip: serializeTripForAdmin(updated) };
  });

  app.get("/admin/vehicles", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    return { vehicles: await prisma.vehicle.findMany({ orderBy: { createdAt: "desc" } }) };
  });

  app.get("/admin/drivers", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    return {
      drivers: await prisma.user.findMany({
        where: { role: "driver" },
        orderBy: { createdAt: "desc" },
      }),
    };
  });

  app.get("/admin/expense-types", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    return {
      expenseTypes: await prisma.expenseType.findMany({ orderBy: { sortOrder: "asc" } }),
    };
  });

  app.get("/admin/reports/profit", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const settlements = await prisma.settlementSnapshot.findMany();

    return {
      summary: {
        tripCount: settlements.length,
        actualFreightTotal: settlements
          .reduce(
            (total: number, item: SettlementAmount) => total + Number(item.actualFreight),
            0,
          )
          .toFixed(2),
        expenseTotal: settlements
          .reduce(
            (total: number, item: SettlementAmount) => total + Number(item.expenseTotal),
            0,
          )
          .toFixed(2),
        profitTotal: settlements
          .reduce((total: number, item: SettlementAmount) => total + Number(item.profit), 0)
          .toFixed(2),
      },
    };
  });

  return app;
}
