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
  expenseMode: "details" | "total";
  expenses: ManualBillingExpenseForm[];
  totalExpense: string;
}

export interface ManualBillingPreview {
  actualFreight: string;
  expenseTotal: string;
  profit: string;
  profitRate: string | null;
}

export interface ManualBillingPayloadBase {
  vehicleId: string;
  driverId: string;
  customerName: string;
  loadLocation: string;
  unloadLocation: string;
  actualFreight: string;
  settledAt: string;
  accountingNote?: string;
}

export type ManualBillingPayload =
  | (ManualBillingPayloadBase & {
      expenses: Array<{
        expenseTypeId: string;
        amount: string;
        occurredAt: string;
        note?: string;
      }>;
      totalExpense: undefined;
    })
  | (ManualBillingPayloadBase & {
      totalExpense: string;
      expenses: undefined;
    });

interface DriverWithBoundVehicles {
  status: string;
  boundVehicles: Array<{ id: string }>;
}

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function parseMoneyCents(value: string, options: { allowZero: boolean }): number | null {
  const trimmed = value.trim();
  if (!MONEY_PATTERN.test(trimmed)) return null;

  const [yuan = "0", cents = ""] = trimmed.split(".");
  const amount = Number(yuan) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) return null;
  if (amount < 0) return null;
  if (!options.allowZero && amount === 0) return null;

  return amount;
}

function previewMoneyCents(value: string): number {
  return parseMoneyCents(value, { allowZero: false }) ?? 0;
}

function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatMoneyInput(value: string, options: { allowZero: boolean }): string {
  return formatMoney(parseMoneyCents(value, options) ?? 0);
}

function isBlankExpenseRow(expense: ManualBillingExpenseForm): boolean {
  return (
    expense.expenseTypeId.trim() === "" &&
    expense.amount.trim() === "" &&
    expense.occurredAt.trim() === "" &&
    expense.note.trim() === ""
  );
}

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function calculateManualBillingPreview(form: ManualBillingForm): ManualBillingPreview {
  const actualFreight = previewMoneyCents(form.actualFreight);
  const expenseTotal =
    form.expenseMode === "total"
      ? previewMoneyCents(form.totalExpense)
      : form.expenses.reduce((total, expense) => total + previewMoneyCents(expense.amount), 0);
  const profit = actualFreight - expenseTotal;

  return {
    actualFreight: formatMoney(actualFreight),
    expenseTotal: formatMoney(expenseTotal),
    profit: formatMoney(profit),
    profitRate: actualFreight > 0 ? ((profit / actualFreight) * 100).toFixed(2) : null,
  };
}

export function validateManualBillingForm(form: ManualBillingForm): string[] {
  const errors: string[] = [];

  if (form.vehicleId.trim() === "") errors.push("请选择车辆");
  if (form.driverId.trim() === "") errors.push("请选择司机");
  if (form.customerName.trim() === "") errors.push("请填写客户名称");
  if (form.loadLocation.trim() === "") errors.push("请填写装货地点");
  if (form.unloadLocation.trim() === "") errors.push("请填写卸货地点");
  if (parseMoneyCents(form.actualFreight, { allowZero: false }) === null) {
    errors.push("请填写正确的实际运费");
  }
  if (form.settledAt.trim() === "") errors.push("请选择结算日期");

  if (form.expenseMode === "total") {
    if (parseMoneyCents(form.totalExpense, { allowZero: true }) === null) {
      errors.push("请填写正确的总费用");
    }
    return errors;
  }

  const nonEmptyExpenses = form.expenses.filter((expense) => !isBlankExpenseRow(expense));
  if (nonEmptyExpenses.length === 0) {
    errors.push("请至少填写一条费用明细");
    return errors;
  }

  form.expenses.forEach((expense, index) => {
    if (isBlankExpenseRow(expense)) return;

    const rowNumber = index + 1;
    if (expense.expenseTypeId.trim() === "") {
      errors.push(`第 ${rowNumber} 条费用请选择费用类型`);
    }
    if (parseMoneyCents(expense.amount, { allowZero: false }) === null) {
      errors.push(`第 ${rowNumber} 条费用请填写正确金额`);
    }
    if (expense.occurredAt.trim() === "") {
      errors.push(`第 ${rowNumber} 条费用请选择发生日期`);
    }
  });

  return errors;
}

export function buildManualBillingPayload(form: ManualBillingForm): ManualBillingPayload {
  const base: ManualBillingPayloadBase = {
    vehicleId: form.vehicleId.trim(),
    driverId: form.driverId.trim(),
    customerName: form.customerName.trim(),
    loadLocation: form.loadLocation.trim(),
    unloadLocation: form.unloadLocation.trim(),
    actualFreight: formatMoneyInput(form.actualFreight, { allowZero: false }),
    settledAt: form.settledAt.trim(),
    accountingNote: optionalTrimmed(form.accountingNote),
  };

  if (form.expenseMode === "total") {
    return {
      ...base,
      totalExpense: formatMoneyInput(form.totalExpense, { allowZero: true }),
      expenses: undefined,
    };
  }

  return {
    ...base,
    expenses: form.expenses.filter((expense) => !isBlankExpenseRow(expense)).map((expense) => ({
      expenseTypeId: expense.expenseTypeId.trim(),
      amount: formatMoneyInput(expense.amount, { allowZero: false }),
      occurredAt: expense.occurredAt.trim(),
      note: optionalTrimmed(expense.note),
    })),
    totalExpense: undefined,
  };
}

export function getDriversBoundToVehicle<T extends DriverWithBoundVehicles>(
  drivers: T[],
  vehicleId: string,
): T[] {
  const selectedVehicleId = vehicleId.trim();
  if (selectedVehicleId === "") return [];

  return drivers.filter(
    (driver) =>
      driver.status === "active" &&
      driver.boundVehicles.some((boundVehicle) => boundVehicle.id === selectedVehicleId),
  );
}
