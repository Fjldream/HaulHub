const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const sessionStorageKey = "haulhub-driver-session";

export type AppRole = "driver" | "accountant" | "administrator";

export interface DriverSession {
  userId: string;
  role: AppRole;
  name: string;
  teamId: string | null;
  teamName: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiTrip {
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
  expenseTotal: string;
  createdAt: string;
  submittedAt: string | null;
  returnReason: string | null;
  vehicle: {
    plateNumber: string;
  };
  expenses: Array<{
    id: string;
    expenseTypeId: string;
    expenseTypeName: string;
    requiresReceipt: boolean;
    amount: string | null;
    occurredAt: string;
    note: string | null;
    receiptImages: ApiReceiptImage[];
  }>;
}

interface ApiExpenseType {
  id: string;
  name: string;
  requiresReceipt: boolean;
}

interface ApiReceiptImage {
  id: string;
  storageKey: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt?: string | null;
}

export interface DriverExpenseType {
  id: string;
  name: string;
  requiresReceipt: boolean;
}

export interface DriverTrip {
  id: string;
  plateNumber: string;
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
  rawCreatedAt: string;
  rawStatus: string;
  status: string;
  plannedAt: string;
  driverNote: string;
  expenseTotal: string;
  missingItems: string[];
  canEdit: boolean;
  canStart: boolean;
  canSubmit: boolean;
}

export interface PageResult<T> {
  items: T[];
  hasMore: boolean;
  page: number;
}

export interface DriverExpense {
  id: string;
  expenseTypeId: string;
  type: string;
  requiresReceipt: boolean;
  rawAmount: string;
  rawOccurredAt: string;
  amount: string;
  occurredAt: string;
  note: string;
  receipt: string;
  receiptImages: ApiReceiptImage[];
}

export interface UploadedFile {
  storageKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DriverProfile {
  id: string;
  teamId: string | null;
  teamName: string | null;
  name: string;
  phone: string;
  status: string;
  boundVehicles: Array<{
    id: string;
    plateNumber: string;
    status: string;
    vehicleType: string | null;
  }>;
}

export interface DriverDocument {
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

export interface AdminTrip {
  id: string;
  tripNo: string;
  status: string;
  statusText: string;
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
  vehicleId: string;
  vehiclePlate: string;
  driverId: string;
  driverName: string;
  estimatedFreight: string;
  driverNote: string;
  accountingNote: string;
  expenseTotal: string;
  actualFreight: string;
  profit: string;
  createdAt: string;
}

export interface AdminTripExpense {
  id: string;
  type: string;
  amount: string;
  occurredAt: string;
  note: string;
  requiresReceipt: boolean;
  receiptCount: number;
  receiptImages: ApiReceiptImage[];
}

export interface AdminTripDetail {
  trip: AdminTrip;
  expenses: AdminTripExpense[];
}

type ApiAdminTrip = ApiTrip & {
  estimatedFreight: string | null;
  actualFreight: string | null;
  profit: string | null;
  driverNote: string | null;
  accountingNote: string | null;
  driver: { id: string; name: string };
  vehicle: { id: string; plateNumber: string };
};

export interface AdminMaintenanceRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  component: string;
  amount: string;
  rawOccurredAt: string;
  occurredAt: string;
  note: string;
  voucherStorageKey: string | null;
}

export interface AdminVehicleOption {
  id: string;
  plateNumber: string;
  status: string;
  vehicleType: string | null;
}

export interface AdminExpenseType {
  id: string;
  name: string;
  requiresReceipt: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface AdminTeam {
  id: string;
  name: string;
  status: string;
  note: string | null;
  createdAt: string;
  userCount: number;
  vehicleCount: number;
  tripCount: number;
}

export interface AdminDriver {
  id: string;
  name: string;
  phone: string;
  status: string;
  boundVehicles: Array<{
    id: string;
    plateNumber: string;
    status: string;
    vehicleType: string | null;
  }>;
}

export interface AdminProfitReport {
  summary: {
    tripCount: number;
    actualFreightTotal: string;
    tripExpenseTotal: string;
    maintenanceExpenseTotal: string;
    expenseTotal: string;
    profitTotal: string;
  };
  byPeriod: Array<{
    period: string;
    tripCount: number;
    actualFreightTotal: string;
    tripExpenseTotal: string;
    maintenanceExpenseTotal: string;
    totalExpense: string;
    profitTotal: string;
  }>;
  byVehicle: Array<{
    id: string;
    label: string;
    tripCount: number;
    actualFreightTotal: string;
    expenseTotal: string;
    profitTotal: string;
  }>;
  byDriver: Array<{
    id: string;
    label: string;
    tripCount: number;
    actualFreightTotal: string;
    expenseTotal: string;
    profitTotal: string;
  }>;
  byExpenseType: Array<{
    id: string;
    label: string;
    total: string;
  }>;
}

export interface MapPlace {
  id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  provider: string;
}

function money(value: string | null): string {
  return `¥${Number(value ?? "0").toFixed(2)}`;
}

function formatCurrency(value: string | number | null | undefined): string {
  return `¥ ${Number(value ?? "0").toFixed(2)}`;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    assigned: "待出车",
    in_progress: "进行中",
    submitted: "已提交",
    under_review: "审核中",
    completed: "已完成",
    returned: "已退回",
    cancelled: "已撤销",
  };

  return labels[status] ?? status;
}

function rightRotate(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(input: string) {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const codePoint = input.charCodeAt(i);
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt((i += 1));
      const point = 0x10000 + (((codePoint & 0x3ff) << 10) | (next & 0x3ff));
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    }
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i -= 1) bytes.push(Math.floor(bitLength / 2 ** (i * 8)) & 0xff);

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
    0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
    0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
    0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
    0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ];
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    const w = new Array<number>(64).fill(0);
    for (let i = 0; i < 16; i += 1) {
      const offset = chunk + i * 4;
      w[i] = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, currentH] = h;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (currentH + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      currentH = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + currentH) >>> 0;
  }

  return h.map((value) => value.toString(16).padStart(8, "0")).join("");
}

function getResponseMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export function getApiErrorMessage(error: unknown, fallback = "操作失败，请稍后重试"): string {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; data?: Record<string, unknown> } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const data = options.data ?? (method === "GET" ? undefined : {});
  const header = {
    ...driverHeaders(),
    ...(data ? { "content-type": "application/json" } : {}),
  };

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${apiBaseUrl}${path}`,
      method,
      data,
      header,
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
          return;
        }
        reject(
          new ApiError(
            getResponseMessage(response.data, `请求失败：${response.statusCode}`),
            response.statusCode,
            response.data,
          ),
        );
      },
      fail: (error) => {
        reject(new ApiError(error.errMsg || "网络异常，请检查连接"));
      },
    });
  });
}

function absoluteFileUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  return `${apiBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

export function resolveStorageUrl(storageKey: string) {
  if (/^(https?:|blob:|data:image|file:|wxfile:|\/)/.test(storageKey)) {
    return storageKey.startsWith("/") ? absoluteFileUrl(storageKey) : storageKey;
  }
  if (storageKey.startsWith("uploads/")) {
    return absoluteFileUrl(`/files/${storageKey.slice("uploads/".length)}`);
  }
  return storageKey;
}

export function uploadAppFile(filePath: string): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${apiBaseUrl}/files`,
      filePath,
      name: "file",
      header: driverHeaders(),
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          let data: unknown = response.data;
          try {
            data = JSON.parse(response.data);
          } catch {
            // Keep raw response text when the server did not return JSON.
          }
          reject(
            new ApiError(
              getResponseMessage(data, `上传失败：${response.statusCode}`),
              response.statusCode,
              data,
            ),
          );
          return;
        }

        try {
          const parsed = JSON.parse(response.data) as { file: UploadedFile };
          resolve({
            ...parsed.file,
            url: absoluteFileUrl(parsed.file.url),
          });
        } catch {
          reject(new ApiError("上传结果解析失败"));
        }
      },
      fail: (error) => reject(new ApiError(error.errMsg || "上传失败，请检查网络")),
    });
  });
}

function driverHeaders() {
  const session = getDriverSession();
  if (!session) {
    return {};
  }

  return {
    "x-user-id": session.userId,
    "x-user-role": session.role,
    ...(session.teamId ? { "x-team-id": session.teamId } : {}),
  };
}

export function getDriverSession(): DriverSession | null {
  try {
    const session = uni.getStorageSync(sessionStorageKey) as DriverSession | "";
    return session || null;
  } catch {
    return null;
  }
}

export function setActiveAdminTeam(team: { id: string; name: string }) {
  const session = getDriverSession();
  if (!session || session.role !== "administrator") {
    return null;
  }
  const nextSession: DriverSession = {
    ...session,
    teamId: team.id,
    teamName: team.name,
  };
  uni.setStorageSync(sessionStorageKey, nextSession);
  return nextSession;
}

export async function loginDriver(input: {
  phone: string;
  password: string;
}): Promise<DriverSession> {
  const { session } = await request<{ session: DriverSession }>("/auth/login", {
    method: "POST",
    data: {
      phone: input.phone,
      passwordDigest: sha256(input.password),
    },
  });
  uni.setStorageSync(sessionStorageKey, session);
  return session;
}

export function logoutDriver() {
  uni.removeStorageSync(sessionStorageKey);
}

export function requireDriverSession(): boolean {
  const session = getDriverSession();
  if (!session) {
    uni.reLaunch({ url: "/pages/login/index" });
    return false;
  }
  if (session.role !== "driver") {
    uni.redirectTo({ url: "/pages/admin/trips/index" });
    return false;
  }
  return true;
}

export function requireAdminSession(options: { allowMissingTeam?: boolean } = {}): boolean {
  const session = getDriverSession();
  if (!session) {
    uni.reLaunch({ url: "/pages/login/index" });
    return false;
  }
  if (session.role === "driver") {
    uni.redirectTo({ url: "/pages/trips/index" });
    return false;
  }
  if (session.role === "administrator" && !session.teamId && !options.allowMissingTeam) {
    uni.redirectTo({ url: "/pages/admin/teams/select" });
    return false;
  }
  return true;
}

function toDriverTrip(trip: ApiTrip): DriverTrip {
  const missingItems = trip.expenses
    .filter((expense) => expense.requiresReceipt && expense.receiptImages.length === 0)
    .map((expense) => `${expense.expenseTypeName}票据`);

  return {
    id: trip.id,
    plateNumber: trip.vehicle.plateNumber,
    customerName: trip.customerName,
    loadLocation: trip.loadLocation,
    loadAddress: trip.loadAddress,
    loadLatitude: trip.loadLatitude,
    loadLongitude: trip.loadLongitude,
    loadPoiId: trip.loadPoiId,
    unloadLocation: trip.unloadLocation,
    unloadAddress: trip.unloadAddress,
    unloadLatitude: trip.unloadLatitude,
    unloadLongitude: trip.unloadLongitude,
    unloadPoiId: trip.unloadPoiId,
    locationProvider: trip.locationProvider,
    rawCreatedAt: trip.createdAt,
    rawStatus: trip.status,
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
    canEdit: ["in_progress", "returned"].includes(trip.status),
    canStart: trip.status === "assigned",
    canSubmit: ["in_progress", "returned"].includes(trip.status),
  };
}

function toDriverExpense(expense: ApiTrip["expenses"][number]): DriverExpense {
  return {
    id: expense.id,
    expenseTypeId: expense.expenseTypeId,
    type: expense.expenseTypeName,
    requiresReceipt: expense.requiresReceipt,
    rawAmount: expense.amount ?? "0.00",
    rawOccurredAt: expense.occurredAt,
    amount: money(expense.amount),
    occurredAt: new Date(expense.occurredAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    note: expense.note ?? "-",
    receipt: expense.receiptImages.length > 0 ? "已上传" : "缺少票据",
    receiptImages: expense.receiptImages,
  };
}

export async function fetchDriverTrips(input?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<DriverTrip[]> {
  const { trips } = await request<{ trips: ApiTrip[] }>(
    `/driver/trips${queryString({ status: input?.status, page: input?.page, pageSize: input?.pageSize })}`,
  );
  return trips.map(toDriverTrip);
}

export async function fetchDriverTripsPage(input: {
  status?: string;
  page: number;
  pageSize: number;
}): Promise<PageResult<DriverTrip>> {
  const { trips, pagination } = await request<{
    trips: ApiTrip[];
    pagination?: { page: number; hasMore: boolean };
  }>(`/driver/trips${queryString(input)}`);
  return {
    items: trips.map(toDriverTrip),
    hasMore: Boolean(pagination?.hasMore),
    page: pagination?.page ?? input.page,
  };
}

export async function fetchDriverTripDetail(
  tripId: string,
): Promise<{ trip: DriverTrip; expenses: DriverExpense[] }> {
  const { trip } = await request<{ trip: ApiTrip }>(`/driver/trips/${tripId}`);
  return {
    trip: toDriverTrip(trip),
    expenses: trip.expenses.map(toDriverExpense),
  };
}

export async function searchMapPlaces(q: string): Promise<MapPlace[]> {
  const { places } = await request<{ places: MapPlace[] }>(
    `/maps/places/search${queryString({ q })}`,
  );
  return places;
}

export async function fetchExpenseTypes(): Promise<DriverExpenseType[]> {
  const { expenseTypes } = await request<{ expenseTypes: ApiExpenseType[] }>(
    "/driver/expense-types",
  );
  return expenseTypes.map((type) => ({
    id: type.id,
    name: type.name,
    requiresReceipt: type.requiresReceipt,
  }));
}

export async function fetchDriverProfile(): Promise<DriverProfile> {
  const { driver } = await request<{ driver: DriverProfile }>("/driver/me");
  return driver;
}

export async function fetchDriverDocuments(): Promise<DriverDocument[]> {
  const { documents } = await request<{ documents: DriverDocument[] }>("/driver/documents");
  return documents;
}

export async function updateDriverDocument(
  type: string,
  input: { storageKey: string; expiresAt?: string; note?: string },
): Promise<DriverDocument> {
  const { document } = await request<{ document: DriverDocument }>(`/driver/documents/${type}`, {
    method: "POST",
    data: input,
  });
  return document;
}

export async function createDriverExpense(input: {
  tripId: string;
  expenseTypeId: string;
  amount: string;
  occurredAt: string;
  note?: string;
}): Promise<{ id: string }> {
  const { expense } = await request<{ expense: { id: string } }>("/driver/expenses", {
    method: "POST",
    data: input,
  });
  return expense;
}

export async function updateDriverExpense(
  expenseId: string,
  input: {
    amount: string;
    occurredAt: string;
    note?: string;
  },
): Promise<void> {
  await request(`/driver/expenses/${expenseId}`, {
    method: "POST",
    data: input,
  });
}

export async function deleteDriverExpense(expenseId: string): Promise<void> {
  await request(`/driver/expenses/${expenseId}/delete`, {
    method: "POST",
  });
}

export async function attachReceiptImage(
  expenseId: string,
  receipt: { storageKey: string; mimeType?: string; sizeBytes?: number },
): Promise<void> {
  await request(`/driver/expenses/${expenseId}/receipt-images`, {
    method: "POST",
    data: {
      mimeType: "image/jpeg",
      sizeBytes: 1,
      ...receipt,
    },
  });
}

export async function deleteReceiptImage(receiptImageId: string): Promise<void> {
  await request(`/driver/receipt-images/${receiptImageId}/delete`, {
    method: "POST",
  });
}

export async function submitDriverTrip(tripId: string): Promise<void> {
  await request(`/driver/trips/${tripId}/submit`, { method: "POST" });
}

export async function startDriverTrip(tripId: string): Promise<void> {
  await request(`/driver/trips/${tripId}/start`, { method: "POST" });
}

function toDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function queryString(params: Record<string, string | number | undefined>): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `?${query}` : "";
}

export async function fetchAdminTrips(status?: string, q?: string): Promise<AdminTrip[]> {
  const { trips } = await request<{
    trips: ApiAdminTrip[];
  }>(`/admin/trips${queryString({ status, q })}`);

  return trips.map(toAdminTrip);
}

export async function fetchAdminTeams(): Promise<AdminTeam[]> {
  const { teams } = await request<{ teams: AdminTeam[] }>("/admin/teams");
  return teams;
}

export async function fetchAdminTripsPage(input: {
  status?: string;
  q?: string;
  page: number;
  pageSize: number;
}): Promise<PageResult<AdminTrip>> {
  const { trips, pagination } = await request<{
    trips: ApiAdminTrip[];
    pagination?: { page: number; hasMore: boolean };
  }>(`/admin/trips${queryString(input)}`);
  return {
    items: trips.map(toAdminTrip),
    hasMore: Boolean(pagination?.hasMore),
    page: pagination?.page ?? input.page,
  };
}

export async function fetchAdminTripDetail(tripId: string): Promise<AdminTripDetail> {
  const { trip } = await request<{ trip: ApiAdminTrip }>(`/admin/trips/${tripId}`);
  return {
    trip: toAdminTrip(trip),
    expenses: trip.expenses.map((expense) => ({
      id: expense.id,
      type: expense.expenseTypeName,
      amount: formatCurrency(expense.amount),
      occurredAt: toDateTime(expense.occurredAt),
      note: expense.note ?? "无备注",
      requiresReceipt: expense.requiresReceipt,
      receiptCount: expense.receiptImages.length,
      receiptImages: expense.receiptImages,
    })),
  };
}

function toAdminTrip(trip: ApiAdminTrip): AdminTrip {
  return {
    id: trip.id,
    tripNo: trip.tripNo,
    status: trip.status,
    statusText: statusLabel(trip.status),
    customerName: trip.customerName,
    loadLocation: trip.loadLocation,
    loadAddress: trip.loadAddress,
    loadLatitude: trip.loadLatitude,
    loadLongitude: trip.loadLongitude,
    loadPoiId: trip.loadPoiId,
    unloadLocation: trip.unloadLocation,
    unloadAddress: trip.unloadAddress,
    unloadLatitude: trip.unloadLatitude,
    unloadLongitude: trip.unloadLongitude,
    unloadPoiId: trip.unloadPoiId,
    locationProvider: trip.locationProvider,
    vehicleId: trip.vehicle.id,
    vehiclePlate: trip.vehicle.plateNumber,
    driverId: trip.driver.id,
    driverName: trip.driver.name,
    estimatedFreight: trip.estimatedFreight ?? "",
    driverNote: trip.driverNote ?? "",
    accountingNote: trip.accountingNote ?? "",
    expenseTotal: formatCurrency(trip.expenseTotal),
    actualFreight: trip.actualFreight ? formatCurrency(trip.actualFreight) : "未结算",
    profit: trip.profit ? formatCurrency(trip.profit) : "未结算",
    createdAt: toDateTime(trip.createdAt),
  };
}

export async function startAdminTripReview(tripId: string): Promise<AdminTrip> {
  const { trip } = await request<{ trip: ApiAdminTrip }>(`/admin/trips/${tripId}/review`, {
    method: "POST",
  });
  return toAdminTrip(trip);
}

export async function returnAdminTrip(tripId: string, reason: string): Promise<AdminTrip> {
  const { trip } = await request<{ trip: ApiAdminTrip }>(`/admin/trips/${tripId}/return`, {
    method: "POST",
    data: { reason },
  });
  return toAdminTrip(trip);
}

export async function cancelAdminTrip(tripId: string, reason: string): Promise<AdminTrip> {
  const { trip } = await request<{ trip: ApiAdminTrip }>(`/admin/trips/${tripId}/cancel`, {
    method: "POST",
    data: { reason },
  });
  return toAdminTrip(trip);
}

export async function settleAdminTrip(tripId: string, actualFreight: string): Promise<AdminTrip> {
  const { trip } = await request<{ trip: ApiAdminTrip }>(`/admin/trips/${tripId}/settle`, {
    method: "POST",
    data: { actualFreight },
  });
  return toAdminTrip(trip);
}

export async function createAdminTrip(input: {
  vehicleId: string;
  driverId: string;
  customerName: string;
  loadLocation: string;
  loadAddress?: string;
  loadLatitude?: number;
  loadLongitude?: number;
  loadPoiId?: string;
  unloadLocation: string;
  unloadAddress?: string;
  unloadLatitude?: number;
  unloadLongitude?: number;
  unloadPoiId?: string;
  locationProvider?: string;
  estimatedFreight?: string;
  driverNote?: string;
  accountingNote?: string;
}): Promise<AdminTrip> {
  const { trip } = await request<{ trip: ApiAdminTrip }>("/admin/trips", {
    method: "POST",
    data: input,
  });
  return toAdminTrip(trip);
}

export async function updateAdminTrip(
  tripId: string,
  input: {
    vehicleId: string;
    driverId: string;
    customerName: string;
    loadLocation: string;
    loadAddress?: string;
    loadLatitude?: number;
    loadLongitude?: number;
    loadPoiId?: string;
    unloadLocation: string;
    unloadAddress?: string;
    unloadLatitude?: number;
    unloadLongitude?: number;
    unloadPoiId?: string;
    locationProvider?: string;
    estimatedFreight?: string;
    driverNote?: string;
    accountingNote?: string;
  },
): Promise<AdminTrip> {
  const { trip } = await request<{ trip: ApiAdminTrip }>(`/admin/trips/${tripId}`, {
    method: "POST",
    data: input,
  });
  return toAdminTrip(trip);
}

export async function fetchAdminMaintenanceRecords(q?: string): Promise<AdminMaintenanceRecord[]> {
  const { records } = await request<{
    records: Array<{
      id: string;
      vehicleId: string;
      component: string;
      amount: string;
      occurredAt: string;
      voucherStorageKey: string | null;
      note: string | null;
      vehicle: { plateNumber: string };
    }>;
  }>(`/admin/vehicle-maintenance${queryString({ page: 1, pageSize: 50, q })}`);

  return records.map((record) => ({
    id: record.id,
    vehicleId: record.vehicleId,
    vehiclePlate: record.vehicle.plateNumber,
    component: record.component,
    amount: formatCurrency(record.amount),
    rawOccurredAt: record.occurredAt,
    occurredAt: toDateTime(record.occurredAt),
    note: record.note ?? "无备注",
    voucherStorageKey: record.voucherStorageKey,
  }));
}

export async function fetchAdminVehicleOptions(): Promise<AdminVehicleOption[]> {
  const { vehicles } = await request<{ vehicles: AdminVehicleOption[] }>("/admin/vehicles");
  return vehicles;
}

export async function createAdminMaintenanceRecord(input: {
  vehicleId: string;
  component: string;
  amount: string;
  occurredAt: string;
  voucherStorageKey?: string;
  note?: string;
}): Promise<AdminMaintenanceRecord> {
  const { record } = await request<{
    record: {
      id: string;
      vehicleId: string;
      component: string;
      amount: string;
      occurredAt: string;
      voucherStorageKey: string | null;
      note: string | null;
      vehicle: { plateNumber: string };
    };
  }>("/admin/vehicle-maintenance", {
    method: "POST",
    data: input,
  });

  return {
    id: record.id,
    vehicleId: record.vehicleId,
    vehiclePlate: record.vehicle.plateNumber,
    component: record.component,
    amount: formatCurrency(record.amount),
    rawOccurredAt: record.occurredAt,
    occurredAt: toDateTime(record.occurredAt),
    note: record.note ?? "无备注",
    voucherStorageKey: record.voucherStorageKey,
  };
}

export async function updateAdminMaintenanceRecord(
  recordId: string,
  input: {
    vehicleId: string;
    component: string;
    amount: string;
    occurredAt: string;
    voucherStorageKey?: string;
    note?: string;
  },
): Promise<AdminMaintenanceRecord> {
  const { record } = await request<{
    record: {
      id: string;
      vehicleId: string;
      component: string;
      amount: string;
      occurredAt: string;
      voucherStorageKey: string | null;
      note: string | null;
      vehicle: { plateNumber: string };
    };
  }>(`/admin/vehicle-maintenance/${recordId}`, {
    method: "POST",
    data: input,
  });

  return {
    id: record.id,
    vehicleId: record.vehicleId,
    vehiclePlate: record.vehicle.plateNumber,
    component: record.component,
    amount: formatCurrency(record.amount),
    rawOccurredAt: record.occurredAt,
    occurredAt: toDateTime(record.occurredAt),
    note: record.note ?? "无备注",
    voucherStorageKey: record.voucherStorageKey,
  };
}

export async function deleteAdminMaintenanceRecord(recordId: string): Promise<void> {
  await request(`/admin/vehicle-maintenance/${recordId}`, { method: "DELETE" });
}

export async function fetchAdminExpenseTypes(q?: string): Promise<AdminExpenseType[]> {
  const { expenseTypes } = await request<{ expenseTypes: AdminExpenseType[] }>(
    `/admin/expense-types${queryString({ q })}`,
  );
  return expenseTypes;
}

export async function createAdminExpenseType(input: {
  name: string;
  requiresReceipt: boolean;
  sortOrder: number;
}): Promise<AdminExpenseType> {
  const { expenseType } = await request<{ expenseType: AdminExpenseType }>("/admin/expense-types", {
    method: "POST",
    data: input,
  });
  return expenseType;
}

export async function updateAdminExpenseType(
  expenseTypeId: string,
  input: {
    name: string;
    requiresReceipt: boolean;
    sortOrder: number;
    enabled: boolean;
  },
): Promise<AdminExpenseType> {
  const { expenseType } = await request<{ expenseType: AdminExpenseType }>(
    `/admin/expense-types/${expenseTypeId}`,
    {
      method: "POST",
      data: input,
    },
  );
  return expenseType;
}

export async function fetchAdminProfitReport(
  period: "week" | "month" | "year" = "month",
  range: { from?: string; to?: string } = {},
): Promise<AdminProfitReport> {
  const report = await request<AdminProfitReport>(
    `/admin/reports/profit${queryString({ period, from: range.from, to: range.to })}`,
  );
  return {
    ...report,
    summary: {
      ...report.summary,
      actualFreightTotal: formatCurrency(report.summary.actualFreightTotal),
      tripExpenseTotal: formatCurrency(report.summary.tripExpenseTotal),
      maintenanceExpenseTotal: formatCurrency(report.summary.maintenanceExpenseTotal),
      expenseTotal: formatCurrency(report.summary.expenseTotal),
      profitTotal: formatCurrency(report.summary.profitTotal),
    },
    byPeriod: report.byPeriod.map((item) => ({
      ...item,
      actualFreightTotal: formatCurrency(item.actualFreightTotal),
      tripExpenseTotal: formatCurrency(item.tripExpenseTotal),
      maintenanceExpenseTotal: formatCurrency(item.maintenanceExpenseTotal),
      totalExpense: formatCurrency(item.totalExpense),
      profitTotal: formatCurrency(item.profitTotal),
    })),
    byVehicle: report.byVehicle.map((item) => ({
      ...item,
      actualFreightTotal: formatCurrency(item.actualFreightTotal),
      expenseTotal: formatCurrency(item.expenseTotal),
      profitTotal: formatCurrency(item.profitTotal),
    })),
    byDriver: report.byDriver.map((item) => ({
      ...item,
      actualFreightTotal: formatCurrency(item.actualFreightTotal),
      expenseTotal: formatCurrency(item.expenseTotal),
      profitTotal: formatCurrency(item.profitTotal),
    })),
    byExpenseType: report.byExpenseType.map((item) => ({
      ...item,
      total: formatCurrency(item.total),
    })),
  };
}

export async function fetchAdminDrivers(q?: string): Promise<AdminDriver[]> {
  const { drivers } = await request<{ drivers: AdminDriver[] }>(
    `/admin/drivers${queryString({ q })}`,
  );
  return drivers;
}

export async function createAdminDriver(input: {
  name: string;
  phone: string;
  initialPassword: string;
}): Promise<void> {
  await request("/admin/drivers", {
    method: "POST",
    data: input,
  });
}

export async function updateAdminDriver(
  driverId: string,
  input: {
    name: string;
    phone: string;
    status: "active" | "disabled";
  },
): Promise<AdminDriver> {
  const { driver } = await request<{ driver: AdminDriver }>(`/admin/drivers/${driverId}`, {
    method: "POST",
    data: input,
  });
  return driver;
}

export async function resetAdminDriverPassword(driverId: string, password: string): Promise<void> {
  await request(`/admin/drivers/${driverId}/password`, {
    method: "POST",
    data: { password },
  });
}

export async function bindAdminDriverVehicle(driverId: string, vehicleId: string): Promise<void> {
  await request(`/admin/drivers/${driverId}/vehicles`, {
    method: "POST",
    data: { vehicleId },
  });
}

export async function unbindAdminDriverVehicle(driverId: string, vehicleId: string): Promise<void> {
  await request(`/admin/drivers/${driverId}/vehicles/${vehicleId}/unbind`, {
    method: "POST",
  });
}

export async function fetchAdminDriverDocuments(driverId: string): Promise<DriverDocument[]> {
  const { documents } = await request<{ documents: DriverDocument[] }>(`/admin/drivers/${driverId}/documents`);
  return documents;
}

export async function updateAdminDriverDocument(
  driverId: string,
  type: string,
  input: { status: string; expiresAt?: string; note?: string },
): Promise<DriverDocument> {
  const { document } = await request<{ document: DriverDocument }>(`/admin/drivers/${driverId}/documents/${type}`, {
    method: "POST",
    data: input,
  });
  return document;
}
