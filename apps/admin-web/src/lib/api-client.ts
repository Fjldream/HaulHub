const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const accountantHeaders = {
  "x-user-id": "accountant-1",
  "x-user-role": "accountant",
};

export interface ApiExpense {
  id: string;
  expenseTypeName: string;
  amount: string | null;
  occurredAt: string;
  note: string | null;
  receiptImages: unknown[];
}

export interface ApiTrip {
  id: string;
  tripNo: string;
  status: string;
  customerName: string;
  loadLocation: string;
  unloadLocation: string;
  estimatedFreight: string | null;
  actualFreight: string | null;
  expenseTotal: string;
  profit: string | null;
  profitRate: string | null;
  returnReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewStartedAt: string | null;
  completedAt: string | null;
  vehicle: {
    id: string;
    plateNumber: string;
  };
  driver: {
    id: string;
    name: string;
  };
  expenses: ApiExpense[];
}

export interface ApiVehicle {
  id: string;
  plateNumber: string;
  status: string;
  vehicleType: string | null;
}

export interface ApiDriver {
  id: string;
  name: string;
  phone: string;
  status: string;
}

export interface ApiExpenseType {
  id: string;
  name: string;
  requiresReceipt: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface ProfitSummary {
  tripCount: number;
  actualFreightTotal: string;
  expenseTotal: string;
  profitTotal: string;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: accountantHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      ...accountantHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function formatMoney(value: string | null | undefined): string {
  if (value == null) {
    return "待确认";
  }

  return `¥${Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "未提交";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
