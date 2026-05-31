import { PrismaClient } from "@prisma/client";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDatabaseUrl } from "../src/env";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
ensureDatabaseUrl(process.env, appRoot);

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.driverDocument.deleteMany();
  await prisma.vehicleMaintenance.deleteMany();
  await prisma.settlementSnapshot.deleteMany();
  await prisma.receiptImage.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.driverVehicleBinding.deleteMany();
  await prisma.expenseType.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  const teamA = await prisma.team.create({
    data: {
      id: "team-default",
      name: "团队A",
      note: "默认运营团队",
    },
  });

  const teamB = await prisma.team.create({
    data: {
      id: "team-b",
      name: "团队B",
      note: "用于验证团队隔离",
    },
  });

  await prisma.user.create({
    data: {
      id: "administrator-1",
      name: "Administrator",
      phone: "13700000000",
      passwordHash: "397f0bf2ab8646b2cd02c9cfcb6bba80b687d015d7d881e87b0cea50bbd0ce44",
      role: "administrator",
      isFirstLogin: false,
    },
  });

  const accountant = await prisma.user.create({
    data: {
      id: "accountant-1",
      teamId: teamA.id,
      name: "会计小周",
      phone: "13800000000",
      passwordHash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
      role: "accountant",
      isFirstLogin: false,
    },
  });

  const driverA = await prisma.user.create({
    data: {
      id: "driver-1",
      teamId: teamA.id,
      name: "司机老李",
      phone: "13900000001",
      passwordHash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
      role: "driver",
    },
  });

  const driverB = await prisma.user.create({
    data: {
      id: "driver-2",
      teamId: teamA.id,
      name: "司机小王",
      phone: "13900000002",
      passwordHash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
      role: "driver",
    },
  });

  const vehicleA = await prisma.vehicle.create({
    data: {
      id: "vehicle-1",
      teamId: teamA.id,
      plateNumber: "沪A·12345",
      vehicleType: "9.6米厢式货车",
    },
  });

  const vehicleB = await prisma.vehicle.create({
    data: {
      id: "vehicle-2",
      teamId: teamA.id,
      plateNumber: "苏B·67890",
      vehicleType: "13米半挂",
    },
  });

  await prisma.driverVehicleBinding.createMany({
    data: [
      { teamId: teamA.id, vehicleId: vehicleA.id, driverId: driverA.id },
      { teamId: teamA.id, vehicleId: vehicleB.id, driverId: driverB.id },
    ],
  });

  await prisma.driverDocument.createMany({
    data: [
      {
        driverId: driverA.id,
        type: "driver_license",
        name: "驾驶证",
        status: "approved",
        storageKey: "seed/driver-license.jpg",
        expiresAt: new Date("2028-05-26T00:00:00.000Z"),
        reviewedAt: new Date("2026-05-20T00:00:00.000Z"),
      },
      {
        driverId: driverA.id,
        type: "qualification_certificate",
        name: "从业资格证",
        status: "pending",
        storageKey: "seed/qualification-certificate.jpg",
        expiresAt: new Date("2026-06-26T00:00:00.000Z"),
        note: "等待后台复核",
      },
      {
        driverId: driverB.id,
        type: "driver_license",
        name: "驾驶证",
        status: "missing",
        expiresAt: new Date("2027-12-31T00:00:00.000Z"),
      },
    ],
  });

  const expenseTypes = await Promise.all(
    [
      { id: "expense-type-fuel", name: "油费", requiresReceipt: true },
      { id: "expense-type-toll", name: "过路费", requiresReceipt: true },
      { id: "expense-type-parking", name: "停车费", requiresReceipt: false },
      { id: "expense-type-repair", name: "维修费", requiresReceipt: true },
      { id: "expense-type-meal", name: "餐费", requiresReceipt: false },
      { id: "expense-type-other", name: "其他", requiresReceipt: false },
    ].map((type, index) =>
      prisma.expenseType.create({
        data: {
          ...type,
          teamId: teamA.id,
          sortOrder: index + 1,
        },
      }),
    ),
  );

  const trip = await prisma.trip.create({
    data: {
      id: "trip-1",
      teamId: teamA.id,
      tripNo: "HH202605270001",
      vehicleId: vehicleA.id,
      driverId: driverA.id,
      customerName: "恒通物流",
      loadLocation: "上海嘉定",
      unloadLocation: "杭州萧山",
      estimatedFreight: "1800.00",
      status: "in_progress",
      driverNote: "到仓库后联系王经理。",
      createdBy: accountant.id,
      startedAt: new Date("2026-05-27T01:20:00.000Z"),
      createdAt: new Date("2026-05-27T01:20:00.000Z"),
    },
  });

  const fuelExpense = await prisma.expense.create({
    data: {
      id: "expense-1",
      tripId: trip.id,
      expenseTypeId: expenseTypes[0].id,
      expenseTypeNameSnapshot: expenseTypes[0].name,
      amount: "300.00",
      occurredAt: new Date("2026-05-27T03:08:00.000Z"),
      note: "高速服务区加油",
      createdBy: driverA.id,
    },
  });

  await prisma.receiptImage.create({
    data: {
      id: "receipt-1",
      expenseId: fuelExpense.id,
      storageKey: "seed/fuel-receipt.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 128000,
    },
  });

  await prisma.vehicleMaintenance.create({
    data: {
      id: "maintenance-1",
      teamId: teamA.id,
      vehicleId: vehicleA.id,
      component: "轮胎更换",
      amount: "680.00",
      occurredAt: new Date("2026-05-18T03:00:00.000Z"),
      voucherStorageKey: "seed/maintenance-tire.jpg",
      note: "右后轮胎磨损更换",
      createdBy: accountant.id,
    },
  });

  await prisma.trip.create({
    data: {
      id: "trip-2",
      teamId: teamA.id,
      tripNo: "HH202605270002",
      vehicleId: vehicleB.id,
      driverId: driverB.id,
      customerName: "江南仓储",
      loadLocation: "苏州昆山",
      unloadLocation: "宁波北仑",
      estimatedFreight: "2300.00",
      status: "submitted",
      driverNote: "已提交，等待审核。",
      createdBy: accountant.id,
      startedAt: new Date("2026-05-27T02:05:00.000Z"),
      submittedAt: new Date("2026-05-27T08:10:00.000Z"),
      createdAt: new Date("2026-05-27T02:05:00.000Z"),
    },
  });

  await prisma.user.create({
    data: {
      id: "accountant-b",
      teamId: teamB.id,
      name: "团队B会计",
      phone: "13800000002",
      passwordHash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
      role: "accountant",
      isFirstLogin: false,
    },
  });
}

await main();
await prisma.$disconnect();
