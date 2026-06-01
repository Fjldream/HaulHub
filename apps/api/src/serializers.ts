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
  loadAddress?: string | null;
  loadLatitude?: number | null;
  loadLongitude?: number | null;
  loadPoiId?: string | null;
  unloadLocation: string;
  unloadAddress?: string | null;
  unloadLatitude?: number | null;
  unloadLongitude?: number | null;
  unloadPoiId?: string | null;
  locationProvider?: string | null;
  estimatedFreight: { toString(): string } | null;
  actualFreight: { toString(): string } | null;
  driverNote?: string | null;
  accountingNote?: string | null;
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
    expenseTypeId: string;
    expenseTypeNameSnapshot: string;
    amount: { toString(): string };
    occurredAt: Date;
    note: string | null;
    receiptImages: Array<{
      id: string;
      storageKey: string;
      mimeType?: string | null;
      sizeBytes?: number | null;
      createdAt?: Date | string | null;
    }>;
    expenseType?: {
      requiresReceipt: boolean;
    } | null;
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
    loadAddress: trip.loadAddress ?? null,
    loadLatitude: trip.loadLatitude ?? null,
    loadLongitude: trip.loadLongitude ?? null,
    loadPoiId: trip.loadPoiId ?? null,
    unloadLocation: trip.unloadLocation,
    unloadAddress: trip.unloadAddress ?? null,
    unloadLatitude: trip.unloadLatitude ?? null,
    unloadLongitude: trip.unloadLongitude ?? null,
    unloadPoiId: trip.unloadPoiId ?? null,
    locationProvider: trip.locationProvider ?? null,
    estimatedFreight: money(trip.estimatedFreight),
    actualFreight: money(trip.actualFreight),
    driverNote: trip.driverNote ?? null,
    accountingNote: trip.accountingNote ?? null,
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
      expenseTypeId: expense.expenseTypeId,
      expenseTypeName: expense.expenseTypeNameSnapshot,
      requiresReceipt: expense.expenseType?.requiresReceipt ?? false,
      amount: money(expense.amount),
      occurredAt: expense.occurredAt.toISOString(),
      note: expense.note,
      receiptImages: expense.receiptImages.map((image) => ({
        id: image.id,
        storageKey: image.storageKey,
        mimeType: image.mimeType ?? null,
        sizeBytes: image.sizeBytes ?? null,
        createdAt:
          image.createdAt instanceof Date
            ? image.createdAt.toISOString()
            : image.createdAt ?? null,
      })),
    })),
  };
}

export function serializeTripForDriver(trip: TripForSerialization) {
  return stripDriverHiddenFields(serializeTripForAdmin(trip));
}
