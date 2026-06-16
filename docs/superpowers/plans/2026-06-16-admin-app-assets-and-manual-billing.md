# Admin App Assets and Manual Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile app admin manual completed billing and replace the admin Driver bottom module with an Assets module containing Drivers and Vehicles management.

**Architecture:** Reuse the existing API contracts for `/admin/trips/manual-completed`, `/admin/vehicles`, and driver-vehicle binding endpoints. Keep business rules in tested pure TypeScript helpers under `apps/driver-uni/src/features/admin`, then wire those helpers into existing Uni Vue pages. Avoid backend changes unless verification reveals an API contract gap.

**Tech Stack:** Uni App Vue 3, TypeScript, Vitest, existing Fastify admin API, existing Material Symbols icon font, existing HaulHub mobile CSS variables.

---

## File Structure

- Create `apps/driver-uni/src/features/admin/manual-billing-model.ts`
  - Pure helper functions and types for manual billing preview, validation, driver filtering, and payload shaping.
- Create `apps/driver-uni/src/features/admin/manual-billing-model.test.ts`
  - Vitest coverage for preview, validation, mode exclusivity, and bound-driver filtering.
- Create `apps/driver-uni/src/features/admin/vehicle-management-model.ts`
  - Pure helper functions and types for vehicle form validation and binding picker options.
- Create `apps/driver-uni/src/features/admin/vehicle-management-model.test.ts`
  - Vitest coverage for vehicle form and binding picker rules.
- Modify `apps/driver-uni/src/api/client.ts`
  - Add rich `AdminVehicle` types and app admin API functions for manual billing and vehicle CRUD/binding.
- Modify `apps/driver-uni/src/components/AdminMobileNav.vue`
  - Change fifth item visible label from Drivers to Assets and keep active key compatibility.
- Modify `apps/driver-uni/src/pages/admin/trips/index.vue`
  - Change plus button to action menu and add manual completed bill sheet.
- Modify `apps/driver-uni/src/pages/admin/drivers/index.vue`
  - Convert visible page into Assets management with Drivers/Vehicles segmented tabs and add vehicle management UI.
- Modify `apps/driver-uni/src/pages.json` only if the visible navigation title needs to match Assets in platform title metadata. This file is currently dirty, so inspect and preserve existing local changes before editing.

## Existing Dirty Worktree Guard

Before every implementation task:

- [ ] Run `git status --short`.
- [ ] Do not revert or overwrite existing dirty files unrelated to the current task.
- [ ] Treat `apps/driver-uni/src/pages.json`, `apps/driver-uni/src/manifest.json`, `.dev-logs/*`, and `scripts/embed-mp-font.cjs` as pre-existing dirty files unless the current task intentionally edits one of them.
- [ ] If editing `apps/driver-uni/src/pages.json`, inspect its current diff first with `git diff -- apps/driver-uni/src/pages.json`.

## Task 1: Manual Billing Model

**Files:**
- Create: `apps/driver-uni/src/features/admin/manual-billing-model.ts`
- Create: `apps/driver-uni/src/features/admin/manual-billing-model.test.ts`

- [ ] **Step 1: Write failing tests for preview and validation**

Create `apps/driver-uni/src/features/admin/manual-billing-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildManualBillingPayload,
  calculateManualBillingPreview,
  getDriversBoundToVehicle,
  validateManualBillingForm,
  type ManualBillingForm,
} from "./manual-billing-model";

const baseForm: ManualBillingForm = {
  vehicleId: "vehicle-1",
  driverId: "driver-1",
  customerName: "Acme Logistics",
  loadLocation: "Shanghai",
  unloadLocation: "Hangzhou",
  actualFreight: "1000.00",
  settledAt: "2026-06-16",
  accountingNote: "",
  expenseMode: "details",
  expenses: [
    { expenseTypeId: "fuel", amount: "200.00", occurredAt: "2026-06-16", note: "Fuel" },
    { expenseTypeId: "toll", amount: "50.50", occurredAt: "2026-06-16", note: "" },
  ],
  totalExpense: "",
};

describe("manual billing model", () => {
  it("calculates detail expense preview", () => {
    expect(calculateManualBillingPreview(baseForm)).toEqual({
      actualFreight: "1000.00",
      expenseTotal: "250.50",
      profit: "749.50",
      profitRate: "74.95",
    });
  });

  it("calculates total expense preview", () => {
    expect(
      calculateManualBillingPreview({
        ...baseForm,
        expenseMode: "total",
        expenses: [],
        totalExpense: "300.00",
      }),
    ).toEqual({
      actualFreight: "1000.00",
      expenseTotal: "300.00",
      profit: "700.00",
      profitRate: "70.00",
    });
  });

  it("rejects invalid required fields and expense rows", () => {
    const errors = validateManualBillingForm({
      ...baseForm,
      vehicleId: "",
      driverId: "",
      customerName: "",
      actualFreight: "12.999",
      expenses: [{ expenseTypeId: "", amount: "abc", occurredAt: "", note: "" }],
    });

    expect(errors).toEqual([
      "请选择车辆",
      "请选择司机",
      "请填写客户名称",
      "请填写正确的实际运费",
      "第 1 条费用请选择费用类型",
      "第 1 条费用请填写正确金额",
      "第 1 条费用请选择发生日期",
    ]);
  });

  it("sends only the active total expense mode in payload", () => {
    expect(
      buildManualBillingPayload({
        ...baseForm,
        expenseMode: "total",
        totalExpense: "88.00",
      }),
    ).toMatchObject({
      totalExpense: "88.00",
      expenses: undefined,
    });
  });

  it("returns only active drivers bound to the selected vehicle", () => {
    const drivers = [
      { id: "driver-1", name: "A", phone: "1", status: "active", boundVehicles: [{ id: "vehicle-1" }] },
      { id: "driver-2", name: "B", phone: "2", status: "disabled", boundVehicles: [{ id: "vehicle-1" }] },
      { id: "driver-3", name: "C", phone: "3", status: "active", boundVehicles: [{ id: "vehicle-2" }] },
    ];

    expect(getDriversBoundToVehicle(drivers, "vehicle-1").map((driver) => driver.id)).toEqual(["driver-1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm --workspace apps/driver-uni run test -- --run src/features/admin/manual-billing-model.test.ts
```

Expected: FAIL because `manual-billing-model.ts` does not exist.

- [ ] **Step 3: Implement the model**

Create `apps/driver-uni/src/features/admin/manual-billing-model.ts`:

```ts
export type ManualBillingExpenseMode = "details" | "total";

export interface ManualBillingExpenseForm {
  expenseTypeId: string;
  amount: string;
  occurredAt: string;
  note: string;
}

export interface ManualBillingForm {
  vehicleId: string;
  driverId: string;
  customerName: string;
  loadLocation: string;
  unloadLocation: string;
  actualFreight: string;
  settledAt: string;
  accountingNote: string;
  expenseMode: ManualBillingExpenseMode;
  expenses: ManualBillingExpenseForm[];
  totalExpense: string;
}

export interface BoundDriverLike {
  id: string;
  status: string;
  boundVehicles: Array<{ id: string }>;
}

const moneyPattern = /^\d+(\.\d{1,2})?$/;

function normalizeMoney(value: string) {
  return Number(value || "0").toFixed(2);
}

function isMoney(value: string) {
  return moneyPattern.test(value.trim());
}

function activeExpenseTotal(form: ManualBillingForm) {
  if (form.expenseMode === "total") {
    return isMoney(form.totalExpense) ? Number(form.totalExpense) : 0;
  }
  return form.expenses.reduce((sum, expense) => sum + (isMoney(expense.amount) ? Number(expense.amount) : 0), 0);
}

export function calculateManualBillingPreview(form: ManualBillingForm) {
  const actualFreight = isMoney(form.actualFreight) ? Number(form.actualFreight) : 0;
  const expenseTotal = activeExpenseTotal(form);
  const profit = actualFreight - expenseTotal;
  return {
    actualFreight: normalizeMoney(String(actualFreight)),
    expenseTotal: normalizeMoney(String(expenseTotal)),
    profit: normalizeMoney(String(profit)),
    profitRate: actualFreight > 0 ? ((profit / actualFreight) * 100).toFixed(2) : null,
  };
}

export function validateManualBillingForm(form: ManualBillingForm) {
  const errors: string[] = [];
  if (!form.vehicleId) errors.push("请选择车辆");
  if (!form.driverId) errors.push("请选择司机");
  if (!form.customerName.trim()) errors.push("请填写客户名称");
  if (!form.loadLocation.trim()) errors.push("请填写装货地");
  if (!form.unloadLocation.trim()) errors.push("请填写卸货地");
  if (!isMoney(form.actualFreight)) errors.push("请填写正确的实际运费");
  if (!form.settledAt) errors.push("请选择完成日期");

  if (form.expenseMode === "total") {
    if (!isMoney(form.totalExpense)) errors.push("请填写正确的总费用");
    return errors;
  }

  const rows = form.expenses.filter(
    (expense) => expense.expenseTypeId || expense.amount || expense.occurredAt || expense.note,
  );
  if (rows.length === 0) {
    errors.push("请至少填写一条费用明细");
    return errors;
  }

  rows.forEach((expense, index) => {
    const row = index + 1;
    if (!expense.expenseTypeId) errors.push(`第 ${row} 条费用请选择费用类型`);
    if (!isMoney(expense.amount)) errors.push(`第 ${row} 条费用请填写正确金额`);
    if (!expense.occurredAt) errors.push(`第 ${row} 条费用请选择发生日期`);
  });
  return errors;
}

export function buildManualBillingPayload(form: ManualBillingForm) {
  const base = {
    vehicleId: form.vehicleId,
    driverId: form.driverId,
    customerName: form.customerName.trim(),
    loadLocation: form.loadLocation.trim(),
    unloadLocation: form.unloadLocation.trim(),
    actualFreight: form.actualFreight.trim(),
    settledAt: form.settledAt,
    accountingNote: form.accountingNote.trim() || undefined,
  };

  if (form.expenseMode === "total") {
    return { ...base, totalExpense: form.totalExpense.trim(), expenses: undefined };
  }

  return {
    ...base,
    totalExpense: undefined,
    expenses: form.expenses
      .filter((expense) => expense.expenseTypeId || expense.amount || expense.occurredAt || expense.note)
      .map((expense) => ({
        expenseTypeId: expense.expenseTypeId,
        amount: expense.amount.trim(),
        occurredAt: expense.occurredAt,
        note: expense.note.trim() || undefined,
      })),
  };
}

export function getDriversBoundToVehicle<T extends BoundDriverLike>(drivers: T[], vehicleId: string): T[] {
  if (!vehicleId) return [];
  return drivers.filter(
    (driver) => driver.status === "active" && driver.boundVehicles.some((vehicle) => vehicle.id === vehicleId),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm --workspace apps/driver-uni run test -- --run src/features/admin/manual-billing-model.test.ts
```

Expected: PASS for 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/driver-uni/src/features/admin/manual-billing-model.ts apps/driver-uni/src/features/admin/manual-billing-model.test.ts
git commit -m "test: add admin app manual billing model"
```

## Task 2: Vehicle Management Model

**Files:**
- Create: `apps/driver-uni/src/features/admin/vehicle-management-model.ts`
- Create: `apps/driver-uni/src/features/admin/vehicle-management-model.test.ts`

- [ ] **Step 1: Write failing vehicle model tests**

Create `apps/driver-uni/src/features/admin/vehicle-management-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getBindableDrivers,
  validateVehicleForm,
  type VehicleForm,
} from "./vehicle-management-model";

const baseForm: VehicleForm = {
  plateNumber: "沪A12345",
  vehicleType: "厢式货车",
  brandModel: "东风",
  loadCapacityTons: "9.6",
  registeredAt: "2026-01-01",
  insuranceExpiresAt: "2027-01-01",
  inspectionExpiresAt: "",
  maintenanceDueAt: "",
  imageUrl: "",
  note: "",
  status: "available",
};

describe("vehicle management model", () => {
  it("accepts a valid vehicle form", () => {
    expect(validateVehicleForm(baseForm)).toEqual([]);
  });

  it("rejects missing plate and invalid capacity", () => {
    expect(validateVehicleForm({ ...baseForm, plateNumber: "", loadCapacityTons: "-1" })).toEqual([
      "请填写车牌号",
      "核载吨位不能为负数",
    ]);
    expect(validateVehicleForm({ ...baseForm, loadCapacityTons: "abc" })).toEqual(["请填写正确的核载吨位"]);
  });

  it("requires status when editing", () => {
    expect(validateVehicleForm({ ...baseForm, status: "" })).toEqual(["请选择车辆状态"]);
  });

  it("excludes disabled and already bound drivers from bind picker", () => {
    const drivers = [
      { id: "driver-1", name: "A", phone: "1", status: "active", boundVehicles: [] },
      { id: "driver-2", name: "B", phone: "2", status: "active", boundVehicles: [{ id: "vehicle-1" }] },
      { id: "driver-3", name: "C", phone: "3", status: "disabled", boundVehicles: [] },
    ];

    expect(getBindableDrivers(drivers, ["driver-2"]).map((driver) => driver.id)).toEqual(["driver-1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm --workspace apps/driver-uni run test -- --run src/features/admin/vehicle-management-model.test.ts
```

Expected: FAIL because `vehicle-management-model.ts` does not exist.

- [ ] **Step 3: Implement the model**

Create `apps/driver-uni/src/features/admin/vehicle-management-model.ts`:

```ts
export type VehicleStatusValue = "available" | "maintenance" | "disabled" | "";

export interface VehicleForm {
  plateNumber: string;
  vehicleType: string;
  brandModel: string;
  loadCapacityTons: string;
  registeredAt: string;
  insuranceExpiresAt: string;
  inspectionExpiresAt: string;
  maintenanceDueAt: string;
  imageUrl: string;
  note: string;
  status: VehicleStatusValue;
}

export interface BindableDriverLike {
  id: string;
  status: string;
}

const decimalPattern = /^\d+(\.\d{1,2})?$/;

export function validateVehicleForm(form: VehicleForm) {
  const errors: string[] = [];
  if (!form.plateNumber.trim()) errors.push("请填写车牌号");
  if (form.loadCapacityTons.trim()) {
    if (!decimalPattern.test(form.loadCapacityTons.trim())) {
      errors.push(form.loadCapacityTons.trim().startsWith("-") ? "核载吨位不能为负数" : "请填写正确的核载吨位");
    }
  }
  if (!form.status) errors.push("请选择车辆状态");
  return errors;
}

export function getBindableDrivers<T extends BindableDriverLike>(drivers: T[], boundDriverIds: string[]) {
  const boundIds = new Set(boundDriverIds);
  return drivers.filter((driver) => driver.status === "active" && !boundIds.has(driver.id));
}

export function vehicleStatusText(status: string) {
  const labels: Record<string, string> = {
    available: "可用",
    maintenance: "维修",
    disabled: "停用",
  };
  return labels[status] ?? status;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm --workspace apps/driver-uni run test -- --run src/features/admin/vehicle-management-model.test.ts
```

Expected: PASS for 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/driver-uni/src/features/admin/vehicle-management-model.ts apps/driver-uni/src/features/admin/vehicle-management-model.test.ts
git commit -m "test: add admin app vehicle model"
```

## Task 3: App API Client Contracts

**Files:**
- Modify: `apps/driver-uni/src/api/client.ts`

- [ ] **Step 1: Run existing driver tests as a baseline**

Run:

```bash
npm --workspace apps/driver-uni run test
```

Expected: PASS before API client changes.

- [ ] **Step 2: Add API types and functions**

Modify `apps/driver-uni/src/api/client.ts` near the existing `AdminVehicleOption`, `AdminDriver`, and admin trip functions.

Add types:

```ts
export interface AdminVehicleDriver {
  id: string;
  name: string;
  phone: string;
  status: string;
}

export interface AdminVehicle {
  id: string;
  plateNumber: string;
  status: "available" | "maintenance" | "disabled" | string;
  statusText?: string;
  vehicleType: string | null;
  brandModel: string | null;
  loadCapacityTons: string | null;
  registeredAt: string | null;
  insuranceExpiresAt: string | null;
  inspectionExpiresAt: string | null;
  maintenanceDueAt: string | null;
  activeTripCount?: number;
  latestMaintenanceAt?: string | null;
  imageUrl: string | null;
  note: string | null;
  boundDrivers: AdminVehicleDriver[];
}

export interface AdminManualBillingExpenseInput {
  expenseTypeId: string;
  amount: string;
  occurredAt: string;
  note?: string;
}

export interface AdminManualBillingInput {
  vehicleId: string;
  driverId: string;
  customerName: string;
  loadLocation: string;
  unloadLocation: string;
  actualFreight: string;
  settledAt: string;
  accountingNote?: string;
  expenses?: AdminManualBillingExpenseInput[];
  totalExpense?: string;
}
```

Add functions:

```ts
export async function createAdminManualCompletedTrip(input: AdminManualBillingInput): Promise<AdminTrip> {
  const { trip } = await request<{ trip: ApiAdminTrip }>("/admin/trips/manual-completed", {
    method: "POST",
    data: input as unknown as Record<string, unknown>,
  });
  return toAdminTrip(trip);
}

export async function fetchAdminVehicles(q?: string, status?: string): Promise<AdminVehicle[]> {
  const { vehicles } = await request<{ vehicles: AdminVehicle[] }>(
    `/admin/vehicles${queryString({ q, status })}`,
  );
  return vehicles;
}

export async function createAdminVehicle(input: {
  plateNumber: string;
  vehicleType?: string;
  brandModel?: string;
  loadCapacityTons?: string;
  registeredAt?: string;
  insuranceExpiresAt?: string;
  inspectionExpiresAt?: string;
  maintenanceDueAt?: string;
  imageUrl?: string;
  note?: string;
}): Promise<AdminVehicle> {
  const { vehicle } = await request<{ vehicle: AdminVehicle }>("/admin/vehicles", {
    method: "POST",
    data: input,
  });
  return vehicle;
}

export async function updateAdminVehicle(
  vehicleId: string,
  input: {
    plateNumber: string;
    vehicleType?: string;
    brandModel?: string;
    loadCapacityTons?: string;
    registeredAt?: string;
    insuranceExpiresAt?: string;
    inspectionExpiresAt?: string;
    maintenanceDueAt?: string;
    imageUrl?: string;
    note?: string;
    status: "available" | "maintenance" | "disabled";
  },
): Promise<AdminVehicle> {
  const { vehicle } = await request<{ vehicle: AdminVehicle }>(`/admin/vehicles/${vehicleId}`, {
    method: "POST",
    data: input,
  });
  return vehicle;
}

export async function bindAdminVehicleDriver(vehicleId: string, driverId: string): Promise<void> {
  await request(`/admin/vehicles/${vehicleId}/drivers`, {
    method: "POST",
    data: { driverId },
  });
}

export async function unbindAdminVehicleDriver(vehicleId: string, driverId: string): Promise<void> {
  await request(`/admin/vehicles/${vehicleId}/drivers/${driverId}/unbind`, {
    method: "POST",
  });
}
```

- [ ] **Step 3: Typecheck client changes**

Run:

```bash
npm --workspace apps/driver-uni run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/driver-uni/src/api/client.ts
git commit -m "feat: add admin app asset api client"
```

## Task 4: Manual Billing UI on Trips Page

**Files:**
- Modify: `apps/driver-uni/src/pages/admin/trips/index.vue`
- May modify: `apps/driver-uni/src/pages.json` only if platform title metadata must change; inspect diff first.

- [ ] **Step 1: Run manual billing model test baseline**

Run:

```bash
npm --workspace apps/driver-uni run test -- --run src/features/admin/manual-billing-model.test.ts
```

Expected: PASS.

- [ ] **Step 2: Import model/API helpers**

Modify the imports in `apps/driver-uni/src/pages/admin/trips/index.vue`:

```ts
import {
  buildManualBillingPayload,
  calculateManualBillingPreview,
  getDriversBoundToVehicle,
  validateManualBillingForm,
  type ManualBillingExpenseForm,
  type ManualBillingForm,
} from "@/features/admin/manual-billing-model";
import {
  createAdminManualCompletedTrip,
  fetchAdminExpenseTypes,
  // keep existing imports
  type AdminExpenseType,
} from "@/api/client";
```

Keep existing imports and add the new names rather than replacing unrelated code.

- [ ] **Step 3: Change plus button to action menu**

In the topbar template, replace the direct `@tap="openCreatePanel"` button behavior with:

```vue
<button class="driver-icon-button" @tap="openTripActionMenu">
  <AppIcon name="add" />
</button>
```

Add script function:

```ts
function openTripActionMenu() {
  uni.showActionSheet({
    itemList: ["新增趟次", "补录账单"],
    success: (result) => {
      if (result.tapIndex === 0) {
        openCreatePanel();
        return;
      }
      openManualBillingPanel();
    },
  });
}
```

- [ ] **Step 4: Add manual billing state**

Add refs and computed values near existing create panel state:

```ts
const manualBillingPanelOpen = ref(false);
const manualBillingSubmitting = ref(false);
const expenseTypes = ref<AdminExpenseType[]>([]);
const manualBillingForm = ref<ManualBillingForm>(emptyManualBillingForm(todayInput()));
const manualBillingVehicleIndex = ref(0);
const manualBillingDriverIndex = ref(0);

const manualBillingVehicle = computed(() => vehicles.value[manualBillingVehicleIndex.value] ?? null);
const manualBillingEligibleDrivers = computed(() =>
  getDriversBoundToVehicle(drivers.value, manualBillingVehicle.value?.id ?? ""),
);
const manualBillingPreview = computed(() => calculateManualBillingPreview(manualBillingForm.value));
const manualBillingErrors = computed(() => validateManualBillingForm(manualBillingForm.value));
const manualBillingDisabled = computed(() => manualBillingSubmitting.value || manualBillingErrors.value.length > 0);
```

Add helper functions:

```ts
function todayInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function emptyManualBillingForm(date: string): ManualBillingForm {
  return {
    vehicleId: "",
    driverId: "",
    customerName: "",
    loadLocation: "",
    unloadLocation: "",
    actualFreight: "",
    settledAt: date,
    accountingNote: "",
    expenseMode: "details",
    expenses: [{ expenseTypeId: "", amount: "", occurredAt: date, note: "" }],
    totalExpense: "",
  };
}
```

- [ ] **Step 5: Load expense types with page data**

Update `loadPageData` to include `fetchAdminExpenseTypes()`:

```ts
const [tripPage, vehicleRows, driverRows, expenseTypeRows] = await Promise.all([
  fetchAdminTripsPage({ status: statusFilter.value, q: searchKeyword.value.trim() || undefined, page: 1, pageSize }),
  fetchAdminVehicleOptions(),
  fetchAdminDrivers(),
  fetchAdminExpenseTypes(),
]);
expenseTypes.value = expenseTypeRows.filter((expenseType) => expenseType.enabled);
```

- [ ] **Step 6: Add manual billing interactions**

Add:

```ts
function openManualBillingPanel() {
  const date = todayInput();
  manualBillingForm.value = emptyManualBillingForm(date);
  manualBillingVehicleIndex.value = 0;
  manualBillingDriverIndex.value = 0;
  if (vehicles.value[0]) {
    selectManualBillingVehicle({ detail: { value: 0 } });
  }
  manualBillingPanelOpen.value = true;
}

function closeManualBillingPanel() {
  if (!manualBillingSubmitting.value) {
    manualBillingPanelOpen.value = false;
  }
}

function selectManualBillingVehicle(event: { detail: { value: number } }) {
  manualBillingVehicleIndex.value = Number(event.detail.value);
  manualBillingForm.value.vehicleId = manualBillingVehicle.value?.id ?? "";
  manualBillingDriverIndex.value = 0;
  manualBillingForm.value.driverId = manualBillingEligibleDrivers.value[0]?.id ?? "";
}

function selectManualBillingDriver(event: { detail: { value: number } }) {
  manualBillingDriverIndex.value = Number(event.detail.value);
  manualBillingForm.value.driverId = manualBillingEligibleDrivers.value[manualBillingDriverIndex.value]?.id ?? "";
}

function setManualBillingMode(mode: "details" | "total") {
  manualBillingForm.value.expenseMode = mode;
}

function addManualBillingExpense() {
  manualBillingForm.value.expenses.push({
    expenseTypeId: "",
    amount: "",
    occurredAt: manualBillingForm.value.settledAt || todayInput(),
    note: "",
  });
}

function removeManualBillingExpense(index: number) {
  if (manualBillingForm.value.expenses.length === 1) return;
  manualBillingForm.value.expenses.splice(index, 1);
}

async function submitManualBilling() {
  const errors = validateManualBillingForm(manualBillingForm.value);
  if (errors.length > 0) {
    uni.showToast({ title: errors[0], icon: "none" });
    return;
  }
  manualBillingSubmitting.value = true;
  try {
    const trip = await createAdminManualCompletedTrip(buildManualBillingPayload(manualBillingForm.value));
    manualBillingPanelOpen.value = false;
    if (!statusFilter.value || statusFilter.value === trip.status) {
      trips.value = [trip, ...trips.value];
    }
    uni.showToast({ title: "已补录账单", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "补录失败，请检查账单信息"), icon: "none" });
  } finally {
    manualBillingSubmitting.value = false;
  }
}
```

- [ ] **Step 7: Add manual billing sheet template**

Add a new sheet before `<AdminMobileNav active="trips" />`. Keep markup compact and aligned with existing sheet classes:

```vue
<view v-if="manualBillingPanelOpen" class="sheet-mask" @tap="closeManualBillingPanel">
  <view class="edit-sheet manual-billing-sheet" @tap.stop>
    <view class="sheet-head">
      <view>
        <text class="sheet-title">补录账单</text>
        <text class="sheet-subtitle">录入已完成运输，保存后计入利润统计</text>
      </view>
      <button class="driver-icon-button" @tap="closeManualBillingPanel">
        <AppIcon name="close" />
      </button>
    </view>

    <view class="form-grid">
      <label>
        <text>车辆</text>
        <picker :range="vehicleLabels" :value="manualBillingVehicleIndex" @change="selectManualBillingVehicle">
          <view class="picker-field">{{ vehicleLabels[manualBillingVehicleIndex] || "请选择车辆" }}</view>
        </picker>
      </label>
      <label>
        <text>司机</text>
        <picker :range="manualBillingEligibleDrivers.map((driver) => `${driver.name} · ${driver.phone}`)" :value="manualBillingDriverIndex" @change="selectManualBillingDriver">
          <view class="picker-field">{{ manualBillingEligibleDrivers[manualBillingDriverIndex]?.name || "请选择司机" }}</view>
        </picker>
      </label>
      <label class="wide-field"><text>客户名称</text><input v-model="manualBillingForm.customerName" /></label>
      <label><text>实际运费</text><input v-model="manualBillingForm.actualFreight" inputmode="decimal" /></label>
      <label>
        <text>完成日期</text>
        <picker mode="date" :value="manualBillingForm.settledAt" @change="manualBillingForm.settledAt = $event.detail.value">
          <view class="picker-field">{{ manualBillingForm.settledAt }}</view>
        </picker>
      </label>
      <label><text>装货地</text><input v-model="manualBillingForm.loadLocation" /></label>
      <label><text>卸货地</text><input v-model="manualBillingForm.unloadLocation" /></label>
      <label class="wide-field"><text>会计备注</text><textarea v-model="manualBillingForm.accountingNote" /></label>
    </view>

    <view class="mode-tabs">
      <button :class="{ active: manualBillingForm.expenseMode === 'details' }" @tap="setManualBillingMode('details')">费用明细</button>
      <button :class="{ active: manualBillingForm.expenseMode === 'total' }" @tap="setManualBillingMode('total')">只填总费用</button>
    </view>

    <view v-if="manualBillingForm.expenseMode === 'details'" class="manual-expense-list">
      <view v-for="(expense, index) in manualBillingForm.expenses" :key="index" class="manual-expense-row">
        <picker :range="expenseTypes.map((type) => type.name)" @change="expense.expenseTypeId = expenseTypes[$event.detail.value]?.id || ''">
          <view class="picker-field">{{ expenseTypes.find((type) => type.id === expense.expenseTypeId)?.name || "费用类型" }}</view>
        </picker>
        <input v-model="expense.amount" inputmode="decimal" placeholder="金额" />
        <picker mode="date" :value="expense.occurredAt" @change="expense.occurredAt = $event.detail.value">
          <view class="picker-field">{{ expense.occurredAt || "发生日期" }}</view>
        </picker>
        <input v-model="expense.note" placeholder="备注" />
        <button class="text-action danger" :disabled="manualBillingForm.expenses.length === 1" @tap="removeManualBillingExpense(index)">删除</button>
      </view>
      <button class="action-button ghost" @tap="addManualBillingExpense">新增费用</button>
    </view>

    <label v-else>
      <text>总费用</text>
      <input v-model="manualBillingForm.totalExpense" inputmode="decimal" placeholder="0.00" />
    </label>

    <view class="preview-grid">
      <view><text>实际运费</text><text>¥{{ manualBillingPreview.actualFreight }}</text></view>
      <view><text>费用合计</text><text>¥{{ manualBillingPreview.expenseTotal }}</text></view>
      <view><text>预计利润</text><text>¥{{ manualBillingPreview.profit }}</text></view>
      <view><text>利润率</text><text>{{ manualBillingPreview.profitRate ? `${manualBillingPreview.profitRate}%` : "不可计算" }}</text></view>
    </view>

    <button class="driver-primary-button" :disabled="manualBillingDisabled" @tap="submitManualBilling">
      {{ manualBillingSubmitting ? "保存中..." : "保存并计入利润" }}
    </button>
  </view>
</view>
```

- [ ] **Step 8: Add scoped CSS for new controls**

Add CSS in the existing `<style scoped>`:

```css
.mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 5px;
  border-radius: 999px;
  background: #eef4ff;
}
.mode-tabs button {
  height: 38px;
  border-radius: 999px;
  color: var(--driver-muted);
  font-size: 13px;
  font-weight: 800;
}
.mode-tabs button.active {
  background: #ffffff;
  color: var(--driver-primary);
  box-shadow: var(--driver-soft-shadow);
}
.manual-expense-list,
.manual-expense-row,
.preview-grid {
  display: grid;
  gap: 10px;
}
.manual-expense-row {
  padding: 10px;
  border: 1px solid var(--driver-border);
  border-radius: 16px;
  background: #f7faff;
}
.preview-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.preview-grid view {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 14px;
  background: #f4f7fc;
}
.preview-grid text:first-child {
  color: var(--driver-muted);
  font-size: 12px;
}
.preview-grid text:last-child {
  color: var(--driver-primary);
  font-size: 15px;
  font-weight: 900;
  overflow-wrap: anywhere;
}
.text-action.danger {
  height: 34px;
  color: var(--driver-red);
}
```

- [ ] **Step 9: Verify trips page compiles**

Run:

```bash
npm --workspace apps/driver-uni run lint
npm --workspace apps/driver-uni run test -- --run src/features/admin/manual-billing-model.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/driver-uni/src/pages/admin/trips/index.vue
git commit -m "feat: add admin app manual billing sheet"
```

## Task 5: Assets Navigation and Vehicle API Wiring in Page

**Files:**
- Modify: `apps/driver-uni/src/components/AdminMobileNav.vue`
- Modify: `apps/driver-uni/src/pages/admin/drivers/index.vue`

- [ ] **Step 1: Run vehicle model tests as baseline**

Run:

```bash
npm --workspace apps/driver-uni run test -- --run src/features/admin/vehicle-management-model.test.ts
```

Expected: PASS.

- [ ] **Step 2: Update bottom nav visible label**

Modify `apps/driver-uni/src/components/AdminMobileNav.vue`:

```ts
const items = [
  { key: "trips", label: "趟次", icon: "route", url: "/pages/admin/trips/index" },
  { key: "maintenance", label: "维修", icon: "build", url: "/pages/admin/maintenance/index" },
  { key: "expenseTypes", label: "费用", icon: "receipt_long", url: "/pages/admin/expense-types/index" },
  { key: "reports", label: "利润", icon: "monitoring", url: "/pages/admin/reports/index" },
  { key: "drivers", label: "资产", icon: "inventory_2", url: "/pages/admin/drivers/index" },
] as const;
```

Keep `active: "drivers"` type unchanged to avoid route churn.

- [ ] **Step 3: Import vehicle functions and model helpers**

In `apps/driver-uni/src/pages/admin/drivers/index.vue`, extend imports:

```ts
import {
  bindAdminVehicleDriver,
  createAdminVehicle,
  fetchAdminVehicles,
  unbindAdminVehicleDriver,
  updateAdminVehicle,
  type AdminVehicle,
} from "@/api/client";
import {
  getBindableDrivers,
  validateVehicleForm,
  vehicleStatusText,
  type VehicleForm,
} from "@/features/admin/vehicle-management-model";
```

- [ ] **Step 4: Add Assets tab and vehicle state**

Add script state:

```ts
type AssetTab = "drivers" | "vehicles";
const activeAssetTab = ref<AssetTab>("drivers");
const vehiclePanelOpen = ref(false);
const vehicleSubmitting = ref(false);
const vehicleBindingBusy = ref(false);
const adminVehicles = ref<AdminVehicle[]>([]);
const editingVehicle = ref<AdminVehicle | null>(null);
const selectedDriverBindIndex = ref(0);
const vehicleForm = ref<VehicleForm>(emptyVehicleForm());

function emptyVehicleForm(): VehicleForm {
  return {
    plateNumber: "",
    vehicleType: "",
    brandModel: "",
    loadCapacityTons: "",
    registeredAt: "",
    insuranceExpiresAt: "",
    inspectionExpiresAt: "",
    maintenanceDueAt: "",
    imageUrl: "",
    note: "",
    status: "available",
  };
}

const vehicleErrors = computed(() => validateVehicleForm(vehicleForm.value));
const vehicleSubmitDisabled = computed(() => vehicleSubmitting.value || vehicleErrors.value.length > 0);
const vehicleActiveCount = computed(() => adminVehicles.value.filter((vehicle) => vehicle.status === "available").length);
const vehicleUnavailableCount = computed(() => adminVehicles.value.filter((vehicle) => vehicle.status !== "available").length);
const bindableDrivers = computed(() =>
  getBindableDrivers(drivers.value, editingVehicle.value?.boundDrivers.map((driver) => driver.id) ?? []),
);
const bindableDriverLabels = computed(() => bindableDrivers.value.map((driver) => `${driver.name} · ${driver.phone}`));
```

- [ ] **Step 5: Load vehicle list with existing driver page data**

Update `loadDrivers`:

```ts
const [driverRows, vehicleRows, richVehicleRows] = await Promise.all([
  fetchAdminDrivers(searchKeyword.value.trim() || undefined),
  fetchAdminVehicleOptions(),
  fetchAdminVehicles(searchKeyword.value.trim() || undefined),
]);
drivers.value = driverRows;
vehicles.value = vehicleRows;
adminVehicles.value = richVehicleRows;
```

- [ ] **Step 6: Add vehicle actions**

Add:

```ts
function setAssetTab(tab: AssetTab) {
  activeAssetTab.value = tab;
}

function openCreateVehiclePanel() {
  editingVehicle.value = null;
  vehicleForm.value = emptyVehicleForm();
  vehiclePanelOpen.value = true;
}

function openEditVehiclePanel(vehicle: AdminVehicle) {
  editingVehicle.value = vehicle;
  selectedDriverBindIndex.value = 0;
  vehicleForm.value = {
    plateNumber: vehicle.plateNumber,
    vehicleType: vehicle.vehicleType ?? "",
    brandModel: vehicle.brandModel ?? "",
    loadCapacityTons: vehicle.loadCapacityTons ?? "",
    registeredAt: dateInputValue(vehicle.registeredAt),
    insuranceExpiresAt: dateInputValue(vehicle.insuranceExpiresAt),
    inspectionExpiresAt: dateInputValue(vehicle.inspectionExpiresAt),
    maintenanceDueAt: dateInputValue(vehicle.maintenanceDueAt),
    imageUrl: vehicle.imageUrl ?? "",
    note: vehicle.note ?? "",
    status: vehicle.status === "maintenance" || vehicle.status === "disabled" ? vehicle.status : "available",
  };
  vehiclePanelOpen.value = true;
}

function closeVehiclePanel() {
  if (!vehicleSubmitting.value && !vehicleBindingBusy.value) {
    vehiclePanelOpen.value = false;
  }
}

function vehiclePayload() {
  return {
    plateNumber: vehicleForm.value.plateNumber.trim(),
    vehicleType: vehicleForm.value.vehicleType.trim() || undefined,
    brandModel: vehicleForm.value.brandModel.trim() || undefined,
    loadCapacityTons: vehicleForm.value.loadCapacityTons.trim() || undefined,
    registeredAt: vehicleForm.value.registeredAt || undefined,
    insuranceExpiresAt: vehicleForm.value.insuranceExpiresAt || undefined,
    inspectionExpiresAt: vehicleForm.value.inspectionExpiresAt || undefined,
    maintenanceDueAt: vehicleForm.value.maintenanceDueAt || undefined,
    imageUrl: vehicleForm.value.imageUrl.trim() || undefined,
    note: vehicleForm.value.note.trim() || undefined,
  };
}

async function submitVehicle() {
  const errors = validateVehicleForm(vehicleForm.value);
  if (errors.length > 0) {
    uni.showToast({ title: errors[0], icon: "none" });
    return;
  }
  vehicleSubmitting.value = true;
  try {
    const saved = editingVehicle.value
      ? await updateAdminVehicle(editingVehicle.value.id, { ...vehiclePayload(), status: vehicleForm.value.status || "available" })
      : await createAdminVehicle(vehiclePayload());
    await refreshVehicles(saved.id);
    editingVehicle.value = saved;
    if (!editingVehicle.value) vehiclePanelOpen.value = false;
    uni.showToast({ title: "已保存车辆", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "车辆保存失败"), icon: "none" });
  } finally {
    vehicleSubmitting.value = false;
  }
}

async function refreshVehicles(vehicleId?: string) {
  const [vehicleRows, richVehicleRows, driverRows] = await Promise.all([
    fetchAdminVehicleOptions(),
    fetchAdminVehicles(searchKeyword.value.trim() || undefined),
    fetchAdminDrivers(searchKeyword.value.trim() || undefined),
  ]);
  vehicles.value = vehicleRows;
  adminVehicles.value = richVehicleRows;
  drivers.value = driverRows;
  if (vehicleId) {
    editingVehicle.value = richVehicleRows.find((vehicle) => vehicle.id === vehicleId) ?? editingVehicle.value;
  }
}

async function bindVehicleDriver() {
  if (!editingVehicle.value) return;
  const driver = bindableDrivers.value[selectedDriverBindIndex.value];
  if (!driver) return;
  vehicleBindingBusy.value = true;
  try {
    await bindAdminVehicleDriver(editingVehicle.value.id, driver.id);
    await refreshVehicles(editingVehicle.value.id);
    selectedDriverBindIndex.value = 0;
    uni.showToast({ title: "已绑定司机", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "绑定失败，请确认车辆和司机可用"), icon: "none" });
  } finally {
    vehicleBindingBusy.value = false;
  }
}

async function unbindVehicleDriver(driverId: string) {
  if (!editingVehicle.value) return;
  vehicleBindingBusy.value = true;
  try {
    await unbindAdminVehicleDriver(editingVehicle.value.id, driverId);
    await refreshVehicles(editingVehicle.value.id);
    uni.showToast({ title: "已解绑司机", icon: "success" });
  } catch (error) {
    uni.showToast({ title: getApiErrorMessage(error, "解绑失败，请稍后重试"), icon: "none" });
  } finally {
    vehicleBindingBusy.value = false;
  }
}
```

- [ ] **Step 7: Update topbar and tabs template**

In the template, change visible brand/subbrand and action button:

```vue
<text class="driver-brand">资产管理</text>
<text class="admin-subbrand">司机与车辆档案</text>
<button class="driver-icon-button" @tap="activeAssetTab === 'drivers' ? openCreatePanel() : openCreateVehiclePanel()">
  <AppIcon :name="activeAssetTab === 'drivers' ? 'person_add' : 'add' " />
</button>
```

Add tab control at the top of content:

```vue
<view class="asset-tabs">
  <button :class="{ active: activeAssetTab === 'drivers' }" @tap="setAssetTab('drivers')">司机</button>
  <button :class="{ active: activeAssetTab === 'vehicles' }" @tap="setAssetTab('vehicles')">车辆</button>
</view>
```

- [ ] **Step 8: Wrap existing driver content under Drivers tab**

Wrap existing summary/search/list content with:

```vue
<template v-if="activeAssetTab === 'drivers'">
  <!-- existing driver summary/search/list content -->
</template>
```

Keep existing driver panels, document panel, and binding panel behavior unchanged.

- [ ] **Step 9: Add Vehicles tab content**

Add after the driver template:

```vue
<template v-else>
  <section class="driver-summary">
    <view><text>车辆总数</text><text>{{ adminVehicles.length }}</text></view>
    <view><text>可用车辆</text><text>{{ vehicleActiveCount }}</text></view>
  </section>
  <section class="list-stack">
    <view v-if="loading" class="empty-card">正在加载车辆...</view>
    <view v-else-if="adminVehicles.length === 0" class="empty-card">暂无车辆数据</view>
    <article v-for="vehicle in adminVehicles" v-else :key="vehicle.id" class="driver-card vehicle-item" @tap="openEditVehiclePanel(vehicle)">
      <view class="vehicle-icon"><AppIcon name="local_shipping" /></view>
      <view class="driver-main">
        <view class="name-row">
          <text class="driver-name">{{ vehicle.plateNumber }}</text>
          <text class="state-pill" :class="{ disabled: vehicle.status !== 'available' }">{{ vehicleStatusText(vehicle.status) }}</text>
        </view>
        <text class="phone">{{ vehicle.vehicleType || "未设置车型" }} · {{ vehicle.brandModel || "未设置品牌" }}</text>
        <view class="vehicle-row">
          <AppIcon name="groups" />
          <text>{{ vehicle.boundDrivers.length ? vehicle.boundDrivers.map((driver) => driver.name).join("、") : "暂未绑定司机" }}</text>
        </view>
      </view>
      <AppIcon class="chevron" name="chevron_right" />
    </article>
  </section>
</template>
```

- [ ] **Step 10: Add vehicle edit sheet**

Add before `<AdminMobileNav active="drivers" />`:

```vue
<view v-if="vehiclePanelOpen" class="sheet-mask" @tap="closeVehiclePanel">
  <view class="edit-sheet" @tap.stop>
    <view class="sheet-head">
      <view>
        <text class="sheet-title">{{ editingVehicle ? "编辑车辆" : "新增车辆" }}</text>
        <text class="sheet-subtitle">维护车辆档案、状态和司机绑定</text>
      </view>
      <button class="driver-icon-button" @tap="closeVehiclePanel">
        <AppIcon name="close" />
      </button>
    </view>

    <view class="form-grid">
      <label><text>车牌号</text><input v-model="vehicleForm.plateNumber" /></label>
      <label><text>车辆类型</text><input v-model="vehicleForm.vehicleType" /></label>
      <label><text>品牌型号</text><input v-model="vehicleForm.brandModel" /></label>
      <label><text>核载吨位</text><input v-model="vehicleForm.loadCapacityTons" inputmode="decimal" /></label>
      <label><text>注册日期</text><picker mode="date" :value="vehicleForm.registeredAt" @change="vehicleForm.registeredAt = $event.detail.value"><view class="picker-field">{{ vehicleForm.registeredAt || "未设置" }}</view></picker></label>
      <label><text>保险到期</text><picker mode="date" :value="vehicleForm.insuranceExpiresAt" @change="vehicleForm.insuranceExpiresAt = $event.detail.value"><view class="picker-field">{{ vehicleForm.insuranceExpiresAt || "未设置" }}</view></picker></label>
      <label><text>年检到期</text><picker mode="date" :value="vehicleForm.inspectionExpiresAt" @change="vehicleForm.inspectionExpiresAt = $event.detail.value"><view class="picker-field">{{ vehicleForm.inspectionExpiresAt || "未设置" }}</view></picker></label>
      <label><text>下次保养</text><picker mode="date" :value="vehicleForm.maintenanceDueAt" @change="vehicleForm.maintenanceDueAt = $event.detail.value"><view class="picker-field">{{ vehicleForm.maintenanceDueAt || "未设置" }}</view></picker></label>
      <label v-if="editingVehicle" class="wide-field">
        <text>车辆状态</text>
        <picker :range="['可用', '维修', '停用']" :value="['available', 'maintenance', 'disabled'].indexOf(vehicleForm.status)" @change="vehicleForm.status = ['available', 'maintenance', 'disabled'][$event.detail.value]">
          <view class="picker-field">{{ vehicleStatusText(vehicleForm.status) }}</view>
        </picker>
      </label>
      <label class="wide-field"><text>车辆图片地址</text><input v-model="vehicleForm.imageUrl" /></label>
      <label class="wide-field"><text>备注</text><textarea v-model="vehicleForm.note" /></label>
    </view>

    <button class="driver-primary-button" :disabled="vehicleSubmitDisabled" @tap="submitVehicle">
      {{ vehicleSubmitting ? "保存中..." : "保存车辆" }}
    </button>

    <view v-if="editingVehicle" class="binding-panel">
      <view class="panel-head">
        <view><text>绑定司机</text><text>绑定后可用该车辆创建趟次</text></view>
      </view>
      <view v-if="editingVehicle.boundDrivers.length === 0" class="binding-empty">暂未绑定司机</view>
      <view v-for="driver in editingVehicle.boundDrivers" :key="driver.id" class="binding-row">
        <view><text>{{ driver.name }}</text><text>{{ driver.phone }}</text></view>
        <button :disabled="vehicleBindingBusy" @tap="unbindVehicleDriver(driver.id)">解绑</button>
      </view>
      <view class="bind-form">
        <picker :range="bindableDriverLabels" :value="selectedDriverBindIndex" @change="selectedDriverBindIndex = Number($event.detail.value)">
          <view class="picker-field">{{ bindableDriverLabels[selectedDriverBindIndex] || "暂无可绑定司机" }}</view>
        </picker>
        <button :disabled="vehicleBindingBusy || bindableDrivers.length === 0" @tap="bindVehicleDriver">绑定</button>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 11: Add Assets/vehicle CSS**

Add:

```css
.asset-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 5px;
  border-radius: 999px;
  background: #eef4ff;
}
.asset-tabs button {
  height: 38px;
  border-radius: 999px;
  color: var(--driver-muted);
  font-size: 13px;
  font-weight: 900;
}
.asset-tabs button.active {
  background: #ffffff;
  color: var(--driver-primary);
  box-shadow: var(--driver-soft-shadow);
}
.vehicle-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
}
.vehicle-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 20px;
  background: #eef4ff;
  color: var(--driver-primary);
}
.vehicle-icon .material-symbols-outlined {
  font-size: 28px;
}
```

- [ ] **Step 12: Verify assets page compiles**

Run:

```bash
npm --workspace apps/driver-uni run lint
npm --workspace apps/driver-uni run test -- --run src/features/admin/vehicle-management-model.test.ts
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add apps/driver-uni/src/components/AdminMobileNav.vue apps/driver-uni/src/pages/admin/drivers/index.vue
git commit -m "feat: add admin app assets page"
```

## Task 6: H5 Verification and UI Polish

**Files:**
- Modify only files needed to fix verified defects from Task 4 or Task 5.

- [ ] **Step 1: Start or reuse local services**

Run API and driver H5 if not already running:

```bash
npm run dev:api
npm run dev:driver:h5
```

If starting through background processes, redirect logs into `.dev-logs/` and do not commit those logs.

- [ ] **Step 2: Verify HTTP readiness**

Run:

```bash
powershell -Command "Invoke-WebRequest -UseBasicParsing http://localhost:4000/health"
powershell -Command "Invoke-WebRequest -UseBasicParsing http://localhost:5173"
```

Expected: API health contains `{"ok":true}` and H5 returns HTTP 200.

- [ ] **Step 3: Manual smoke test in H5**

Use the browser or manual app preview to verify:

- Admin opens Trips.
- Plus action sheet shows New Trip and Manual Bill.
- Manual Bill sheet opens.
- Selecting a vehicle filters drivers.
- Detail expense mode updates preview.
- Total expense mode updates preview.
- Invalid required fields show a toast.
- Successful submit creates a completed trip.
- Bottom nav shows Assets label.
- Assets page opens Drivers tab.
- Assets page switches to Vehicles tab.
- Vehicle create/edit/status/bind/unbind works.

- [ ] **Step 4: Fix any UI defects with test coverage first when logic changes**

If the defect is model or validation logic, add or adjust the relevant failing test before changing production code:

```bash
npm --workspace apps/driver-uni run test -- --run src/features/admin/manual-billing-model.test.ts
npm --workspace apps/driver-uni run test -- --run src/features/admin/vehicle-management-model.test.ts
```

If the defect is template-only layout text or spacing, patch the Vue/CSS directly and verify via H5.

- [ ] **Step 5: Commit polish fixes**

If any changes were needed:

```bash
git add apps/driver-uni/src
git commit -m "fix: polish admin app assets flow"
```

If no changes were needed, skip this commit.

## Task 7: Full Release Verification

**Files:**
- No production files unless verification reveals a defect.

- [ ] **Step 1: Run focused driver tests**

Run:

```bash
npm --workspace apps/driver-uni run test
```

Expected: PASS for all driver-uni tests.

- [ ] **Step 2: Run driver lint**

Run:

```bash
npm --workspace apps/driver-uni run lint
```

Expected: PASS.

- [ ] **Step 3: Run H5 build**

Run:

```bash
npm --workspace apps/driver-uni run build:h5
```

Expected: PASS and generated H5 build artifacts under the app's normal output directory.

- [ ] **Step 4: Run full workspace tests**

Run:

```bash
npm test
```

Expected: PASS across workspaces.

- [ ] **Step 5: Run full workspace lint**

Run:

```bash
npm run lint
```

Expected: exit 0. Existing warnings may remain if unrelated and pre-existing, but no new errors.

- [ ] **Step 6: Final status check**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: only known unrelated dirty files remain outside committed feature work.

## Self-Review

- Spec coverage:
  - Manual billing entry from Trips plus menu: Task 4.
  - Manual billing detail/total modes, preview, validation: Task 1 and Task 4.
  - No receipt upload in app manual billing: Task 4 template omits receipts.
  - Bottom nav Assets label: Task 5.
  - Assets page Drivers/Vehicles segmented tabs: Task 5.
  - Full vehicle management and bindings: Task 2, Task 3, Task 5.
  - Existing function preservation: baseline and full verification in Tasks 3, 4, 5, 7.
  - Enterprise release standard: Task 6 and Task 7.
- Placeholder scan: no placeholders or deferred implementation steps remain.
- Type consistency:
  - `ManualBillingForm`, `VehicleForm`, `AdminVehicle`, and API function names are consistent across tasks.
  - Existing route key `drivers` remains for `AdminMobileNav` active state while visible label changes to Assets.

