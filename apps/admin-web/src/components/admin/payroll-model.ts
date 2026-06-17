export const payrollTypes = ["fixed", "trip", "bonus", "deduction", "other"] as const;

export type PayrollType = (typeof payrollTypes)[number];

const payrollTypeLabels: Record<PayrollType, string> = {
  fixed: "固定工资",
  trip: "趟次工资",
  bonus: "奖金",
  deduction: "扣款/调整",
  other: "其他",
};

export function isSalaryMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function payrollTypeLabel(type: string) {
  return payrollTypeLabels[type as PayrollType] ?? type;
}

export function calculateTripPayrollAmount(tripCount: string, unitAmount: string) {
  if (!/^\d+$/.test(tripCount) || !/^\d+(\.\d{1,2})?$/.test(unitAmount)) {
    return null;
  }

  const amount = Number(tripCount) * Number(unitAmount);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return amount.toFixed(2);
}
