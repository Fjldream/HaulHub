import { expenseTypes as mockExpenseTypes, expenses as mockExpenses, trips as mockTrips } from "./mock";

const importMeta = import.meta as ImportMeta & {
  env?: {
    VITE_API_BASE_URL?: string;
  };
};
const apiBaseUrl = importMeta.env?.VITE_API_BASE_URL ?? "http://localhost:4000";

const driverHeaders = {
  "x-user-id": "driver-1",
  "x-user-role": "driver",
};

interface ApiTrip {
  id: string;
  tripNo: string;
  status: string;
  customerName: string;
  loadLocation: string;
  unloadLocation: string;
  expenseTotal: string;
  createdAt: string;
  submittedAt: string | null;
  returnReason: string | null;
  vehicle: {
    plateNumber: string;
  };
  expenses: Array<{
    id: string;
    expenseTypeName: string;
    amount: string | null;
    occurredAt: string;
    note: string | null;
    receiptImages: unknown[];
  }>;
}

interface ApiExpenseType {
  id: string;
  name: string;
  requiresReceipt: boolean;
}

interface DriverTrip {
  id: string;
  plateNumber: string;
  customerName: string;
  loadLocation: string;
  unloadLocation: string;
  status: string;
  plannedAt: string;
  driverNote: string;
  expenseTotal: string;
  missingItems: string[];
}

interface DriverExpense {
  id: string;
  type: string;
  amount: string;
  occurredAt: string;
  note: string;
  receipt: string;
}

function money(value: string | null): string {
  return `¥${Number(value ?? "0").toFixed(2)}`;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    assigned: "待出车",
    in_progress: "进行中",
    submitted: "已提交",
    under_review: "审核中",
    completed: "已完成",
    returned: "已退回",
  };

  return labels[status] ?? status;
}

function request<T>(
  path: string,
  options: { method?: "GET" | "POST"; data?: Record<string, unknown> } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${apiBaseUrl}${path}`,
      method: options.method ?? "GET",
      data: options.data,
      header: {
        ...driverHeaders,
        "content-type": "application/json",
      },
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
          return;
        }
        reject(new Error(`API request failed: ${response.statusCode}`));
      },
      fail: reject,
    });
  });
}

function toDriverTrip(trip: ApiTrip): DriverTrip {
  const missingItems = trip.expenses
    .filter((expense) => expense.receiptImages.length === 0)
    .map((expense) => `${expense.expenseTypeName}票据`);

  return {
    id: trip.id,
    plateNumber: trip.vehicle.plateNumber,
    customerName: trip.customerName,
    loadLocation: trip.loadLocation,
    unloadLocation: trip.unloadLocation,
    status: statusLabel(trip.status),
    plannedAt: new Date(trip.createdAt).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    driverNote: trip.returnReason ? `退回原因：${trip.returnReason}` : "请按要求上传费用和票据。",
    expenseTotal: money(trip.expenseTotal),
    missingItems,
  };
}

function toDriverExpense(expense: ApiTrip["expenses"][number]): DriverExpense {
  return {
    id: expense.id,
    type: expense.expenseTypeName,
    amount: money(expense.amount),
    occurredAt: new Date(expense.occurredAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    note: expense.note ?? "-",
    receipt: expense.receiptImages.length > 0 ? "已上传" : "缺少票据",
  };
}

export async function fetchDriverTrips(): Promise<DriverTrip[]> {
  try {
    const { trips } = await request<{ trips: ApiTrip[] }>("/driver/trips");
    return trips.map(toDriverTrip);
  } catch {
    return mockTrips;
  }
}

export async function fetchDriverTripDetail(
  tripId: string,
): Promise<{ trip: DriverTrip; expenses: DriverExpense[] }> {
  try {
    const { trip } = await request<{ trip: ApiTrip }>(`/driver/trips/${tripId}`);
    return {
      trip: toDriverTrip(trip),
      expenses: trip.expenses.map(toDriverExpense),
    };
  } catch {
    return { trip: mockTrips[0], expenses: mockExpenses };
  }
}

export async function fetchExpenseTypes(): Promise<string[]> {
  try {
    const { expenseTypes } = await request<{ expenseTypes: ApiExpenseType[] }>(
      "/driver/expense-types",
    );
    return expenseTypes.map((type) => type.name);
  } catch {
    return mockExpenseTypes;
  }
}

export async function submitDriverTrip(tripId: string): Promise<void> {
  await request(`/driver/trips/${tripId}/submit`, { method: "POST" });
}
