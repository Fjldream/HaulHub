import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.settlementSnapshot.deleteMany();
  await prisma.receiptImage.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.driverVehicleBinding.deleteMany();
  await prisma.expenseType.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();

  const accountant = await prisma.user.create({
    data: {
      id: "accountant-1",
      name: "会计小周",
      phone: "13800000000",
      passwordHash: "dev-password",
      role: "accountant",
      isFirstLogin: false,
    },
  });

  const driverA = await prisma.user.create({
    data: {
      id: "driver-1",
      name: "司机老李",
      phone: "13900000001",
      passwordHash: "dev-password",
      role: "driver",
    },
  });

  const driverB = await prisma.user.create({
    data: {
      id: "driver-2",
      name: "司机小王",
      phone: "13900000002",
      passwordHash: "dev-password",
      role: "driver",
    },
  });

  const vehicleA = await prisma.vehicle.create({
    data: {
      id: "vehicle-1",
      plateNumber: "沪A·12345",
      vehicleType: "9.6米厢式货车",
    },
  });

  const vehicleB = await prisma.vehicle.create({
    data: {
      id: "vehicle-2",
      plateNumber: "苏B·67890",
      vehicleType: "13米半挂",
    },
  });

  await prisma.driverVehicleBinding.createMany({
    data: [
      { vehicleId: vehicleA.id, driverId: driverA.id },
      { vehicleId: vehicleB.id, driverId: driverB.id },
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
          sortOrder: index + 1,
        },
      }),
    ),
  );

  const trip = await prisma.trip.create({
    data: {
      id: "trip-1",
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

  await prisma.trip.create({
    data: {
      id: "trip-2",
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
}

await main();
await prisma.$disconnect();
