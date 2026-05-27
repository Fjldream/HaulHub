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
      name: "会计小周",
      phone: "13800000000",
      passwordHash: "dev-password",
      role: "accountant",
      isFirstLogin: false,
    },
  });

  const driverA = await prisma.user.create({
    data: {
      name: "司机老李",
      phone: "13900000001",
      passwordHash: "dev-password",
      role: "driver",
    },
  });

  const driverB = await prisma.user.create({
    data: {
      name: "司机小王",
      phone: "13900000002",
      passwordHash: "dev-password",
      role: "driver",
    },
  });

  const vehicleA = await prisma.vehicle.create({
    data: {
      plateNumber: "沪A·12345",
      vehicleType: "9.6米厢式货车",
    },
  });

  const vehicleB = await prisma.vehicle.create({
    data: {
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
      ["油费", true],
      ["过路费", true],
      ["停车费", false],
      ["维修费", true],
      ["餐费", false],
      ["其他", false],
    ].map(([name, requiresReceipt], index) =>
      prisma.expenseType.create({
        data: {
          name: String(name),
          requiresReceipt: Boolean(requiresReceipt),
          sortOrder: index + 1,
        },
      }),
    ),
  );

  const trip = await prisma.trip.create({
    data: {
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
      startedAt: new Date(),
    },
  });

  await prisma.expense.create({
    data: {
      tripId: trip.id,
      expenseTypeId: expenseTypes[0].id,
      expenseTypeNameSnapshot: expenseTypes[0].name,
      amount: "300.00",
      occurredAt: new Date(),
      note: "加油",
      createdBy: driverA.id,
    },
  });
}

await main();
await prisma.$disconnect();
