import { stripDriverHiddenFields } from "@haulhub/shared";

function money(value: { toString(): string } | number | string | null): string | null {
  return value == null ? null : value.toString();
}

interface TripForSerialization {
  id: string;
  tripNo: string;
  status: string;
  customerName: string;
  loadLocation: string;
  unloadLocation: string;
  estimatedFreight: { toString(): string } | null;
  actualFreight: { toString(): string } | null;
  returnReason: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  reviewStartedAt?: Date | null;
  completedAt?: Date | null;
  vehicle: {
    id: string;
    plateNumber: string;
  };
  driver: {
    id: string;
    name: string;
  };
  expenses: Array<{
    id: string;
    expenseTypeNameSnapshot: string;
    amount: { toString(): string };
    occurredAt: Date;
    note: string | null;
    receiptImages: unknown[];
  }>;
  settlement: {
    profitRate: { toString(): string } | null;
  } | null;
}

export function serializeTripForAdmin(trip: TripForSerialization) {
  const expenseTotal = trip.expenses
    .reduce((total, expense) => total + Number(expense.amount), 0)
    .toFixed(2);
  const profit =
    trip.actualFreight == null
      ? null
      : (Number(trip.actualFreight) - Number(expenseTotal)).toFixed(2);

  return {
    id: trip.id,
    tripNo: trip.tripNo,
    status: trip.status,
    customerName: trip.customerName,
    loadLocation: trip.loadLocation,
    unloadLocation: trip.unloadLocation,
    estimatedFreight: money(trip.estimatedFreight),
    actualFreight: money(trip.actualFreight),
    expenseTotal,
    profit,
    profitRate: trip.settlement?.profitRate?.toString() ?? null,
    returnReason: trip.returnReason,
    createdAt: trip.createdAt.toISOString(),
    submittedAt: trip.submittedAt?.toISOString() ?? null,
    reviewStartedAt: trip.reviewStartedAt?.toISOString() ?? null,
    completedAt: trip.completedAt?.toISOString() ?? null,
    vehicle: {
      id: trip.vehicle.id,
      plateNumber: trip.vehicle.plateNumber,
    },
    driver: {
      id: trip.driver.id,
      name: trip.driver.name,
    },
    expenses: trip.expenses.map((expense) => ({
      id: expense.id,
      expenseTypeName: expense.expenseTypeNameSnapshot,
      amount: money(expense.amount),
      occurredAt: expense.occurredAt.toISOString(),
      note: expense.note,
      receiptImages: expense.receiptImages,
    })),
  };
}

export function serializeTripForDriver(trip: TripForSerialization) {
  return stripDriverHiddenFields(serializeTripForAdmin(trip));
}
