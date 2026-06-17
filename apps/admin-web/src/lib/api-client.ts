import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";

const internalApiBaseUrl =
  process.env.NEXT_INTERNAL_API_BASE_URL ??
  process.env.ADMIN_INTERNAL_API_BASE_URL ??
  "http://localhost:4000";
const publicApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? internalApiBaseUrl;

async function readApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export interface ApiExpense {
  id: string;
  expenseTypeId: string;
  expenseTypeName: string;
  amount: string | null;
  occurredAt: string;
  note: string | null;
  receiptImages: ApiReceiptImage[];
}

export interface ApiReceiptImage {
  id: string;
  storageKey: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
}

export interface ApiTrip {
  id: string;
  tripNo: string;
  status: string;
  customerName: string;
  loadLocation: string;
  loadAddress: string | null;
  loadLatitude: number | null;
  loadLongitude: number | null;
  loadPoiId: string | null;
  unloadLocation: string;
  unloadAddress: string | null;
  unloadLatitude: number | null;
  unloadLongitude: number | null;
  unloadPoiId: string | null;
  locationProvider: string | null;
  estimatedFreight: string | null;
  actualFreight: string | null;
  driverNote: string | null;
  accountingNote: string | null;
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
  assistantDrivers?: Array<{
    id: string;
    name: string;
  }>;
  expenses: ApiExpense[];
}

export interface ApiVehicle {
  id: string;
  plateNumber: string;
  status: string;
  operationalStatus?: "idle" | "transporting" | "maintenance" | "disabled";
  vehicleType: string | null;
  brandModel?: string | null;
  loadCapacityTons?: string | null;
  registeredAt?: string | null;
  insuranceExpiresAt?: string | null;
  inspectionExpiresAt?: string | null;
  maintenanceDueAt?: string | null;
  latestMaintenanceAt?: string | null;
  imageUrl?: string | null;
  note?: string | null;
  unfinishedTripCount?: number;
  boundDrivers?: ApiDriver[];
}

export interface ApiDriver {
  id: string;
  name: string;
  phone: string;
  status: string;
  role?: string;
  isFirstLogin?: boolean;
  boundVehicles?: ApiVehicle[];
}

export interface ApiDriverPayroll {
  id: string;
  teamId: string;
  driverId: string;
  driverName: string | null;
  driverPhone: string | null;
  salaryMonth: string;
  type: "fixed" | "trip" | "bonus" | "deduction" | "other" | string;
  amount: string;
  tripCount: number | null;
  unitAmount: string | null;
  paidAt: string | null;
  note: string | null;
  createdBy: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverPayrollList {
  payrolls: ApiDriverPayroll[];
  summary: {
    totalAmount: string;
  };
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DriverPayrollTripCount {
  summary: {
    primaryTripCount: number;
    assistantTripCount: number;
    payrollTripCount: number;
  };
  trips: Array<{
    id: string;
    tripNo: string;
    customerName: string | null;
    completedAt: string | null;
    role: "primary" | "assistant" | string;
    driverName: string | null;
    vehiclePlateNumber: string | null;
  }>;
}

export interface ApiDriverDocument {
  id: string;
  driverId: string;
  type: string;
  name: string;
  status: "missing" | "pending" | "approved" | "rejected" | "expired" | string;
  storageKey: string | null;
  expiresAt: string | null;
  note: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ApiExpenseType {
  id: string;
  name: string;
  requiresReceipt: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface ApiAdminMember {
  id: string;
  teamId: string | null;
  teamName: string | null;
  name: string;
  phone: string;
  role: "administrator" | "accountant";
  status: string;
  isFirstLogin: boolean;
  createdAt: string;
}

export interface ApiTeam {
  id: string;
  name: string;
  status: string;
  note: string | null;
  createdAt: string;
  userCount: number;
  vehicleCount: number;
  tripCount: number;
}

export interface ApiAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface ProfitSummary {
  tripCount: number;
  actualFreightTotal: string;
  tripExpenseTotal: string;
  maintenanceExpenseTotal: string;
  expenseTotal: string;
  driverPayrollTotal: string;
  profitTotal: string;
  profitRate: string | null;
  payrollNotice: string | null;
}

export interface ProfitReportGroup {
  id: string;
  label: string;
  tripCount: number;
  actualFreightTotal: string;
  expenseTotal: string;
  profitTotal: string;
}

export interface DriverTripCountGroup {
  id: string;
  label: string;
  tripCount: number;
}

export interface ExpenseTypeReportGroup {
  id: string;
  label: string;
  total: string;
}

export interface ProfitPeriodGroup {
  period: string;
  tripCount: number;
  actualFreightTotal: string;
  tripExpenseTotal: string;
  maintenanceExpenseTotal: string;
  totalExpense: string;
  driverPayrollTotal: string;
  profitTotal: string;
  profitRate: string | null;
  payrollNotice: string | null;
}

export interface ApiVehicleMaintenance {
  id: string;
  vehicleId: string;
  component: string;
  amount: string;
  occurredAt: string;
  voucherStorageKey: string | null;
  note: string | null;
  createdAt: string;
  vehicle: {
    id: string;
    plateNumber: string;
  };
  creator: {
    id: string;
    name: string;
  };
}

export interface ApiVehicleMaintenanceList {
  records: ApiVehicleMaintenance[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function adminHeaders() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }

  return {
    "x-user-id": session.userId,
    "x-user-role": session.role,
    ...(session.activeTeamId ? { "x-team-id": session.activeTeamId } : {}),
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${internalApiBaseUrl}${path}`, {
    headers: await adminHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `请求失败：${response.status}`));
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(`${internalApiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      ...(await adminHeaders()),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `请求失败：${response.status}`));
  }

  return response.json() as Promise<T>;
}

export async function apiUploadFile(
  file: File,
): Promise<{ storageKey: string; url: string; mimeType: string | null; sizeBytes: number | null }> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`${internalApiBaseUrl}/files`, {
    method: "POST",
    headers: await adminHeaders(),
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `文件上传失败：${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message ?? message;
    } catch {
      if (response.status === 413) {
        message = "图片文件过大，请上传 10MB 以内的图片";
      }
    }
    throw new Error(message);
  }

  const result = (await response.json()) as {
    file: { storageKey: string; url: string; mimeType?: string | null; sizeBytes?: number | null };
  };
  const base = publicApiBaseUrl.endsWith("/") ? publicApiBaseUrl.slice(0, -1) : publicApiBaseUrl;
  const url = result.file.url.startsWith("http") ? result.file.url : `${base}${result.file.url}`;

  return {
    storageKey: result.file.storageKey,
    url,
    mimeType: result.file.mimeType ?? null,
    sizeBytes: result.file.sizeBytes ?? null,
  };
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${internalApiBaseUrl}${path}`, {
    method: "DELETE",
    headers: await adminHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `请求失败：${response.status}`));
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
