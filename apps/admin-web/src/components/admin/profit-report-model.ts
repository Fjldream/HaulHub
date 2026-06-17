import { payrollTypeLabel } from "@/components/admin/payroll-model";
import type { ApiDriverPayroll } from "@/lib/api-client";

export function safeNumber(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function formatPercent(value: string | number | null | undefined) {
  return `${(safeNumber(value) * 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function percentOf(value: string | number | null | undefined, total: string | number | null | undefined) {
  const denominator = safeNumber(total);
  if (denominator <= 0) {
    return "0.0%";
  }

  return formatPercent(safeNumber(value) / denominator);
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthRange(now = new Date()) {
  return {
    from: dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: dateInputValue(now),
  };
}

function isReportDate(value: string | undefined) {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function buildProfitOverviewRange(from: string | undefined, to: string | undefined, now = new Date()) {
  const trimmedFrom = from?.trim();
  const trimmedTo = to?.trim();

  if (!isReportDate(trimmedFrom) || !isReportDate(trimmedTo)) {
    return currentMonthRange(now);
  }

  if (trimmedFrom! > trimmedTo!) {
    return {
      from: trimmedTo!,
      to: trimmedFrom!,
    };
  }

  return {
    from: trimmedFrom!,
    to: trimmedTo!,
  };
}

export function isReportMonth(value: string | undefined) {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

export function buildMonthRange(month: string | undefined, now = new Date()) {
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = isReportMonth(month) ? month! : fallback;
  const [year, monthNumber] = selectedMonth.split("-").map(Number);

  return {
    month: selectedMonth,
    from: dateInputValue(new Date(year, monthNumber - 1, 1)),
    to: dateInputValue(new Date(year, monthNumber, 0)),
  };
}

function parseYear(value: string | undefined) {
  if (!value || !/^\d{4}$/.test(value)) {
    return null;
  }

  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}

export function buildYearRange(fromYear: string | undefined, toYear: string | undefined, currentYear = new Date().getFullYear()) {
  const parsedFrom = parseYear(fromYear);
  const parsedTo = parseYear(toYear);
  const start = parsedFrom ?? (parsedTo == null ? currentYear - 4 : currentYear);
  const end = parsedTo ?? currentYear;
  const normalizedFrom = Math.min(start, end);
  const normalizedTo = Math.max(start, end);

  return {
    fromYear: normalizedFrom,
    toYear: normalizedTo,
    from: `${normalizedFrom}-01-01`,
    to: `${normalizedTo}-12-31`,
  };
}

export function buildSingleYearRange(year: string | undefined, currentYear = new Date().getFullYear()) {
  const normalizedYear = parseYear(year) ?? currentYear;

  return {
    year: normalizedYear,
    from: `${normalizedYear}-01-01`,
    to: `${normalizedYear}-12-31`,
  };
}

type PayrollSummaryInput = {
  actualFreightTotal: string | number | null | undefined;
  tripCount: number;
};

export function payrollAnalysis(payrolls: ApiDriverPayroll[], summary: PayrollSummaryInput) {
  const total = payrolls.reduce((sum, payroll) => sum + safeNumber(payroll.amount), 0);
  const byType = new Map<string, { type: string; label: string; total: number; count: number }>();
  const byDriver = new Map<string, { driverId: string; label: string; total: number; count: number; tripCount: number }>();

  for (const payroll of payrolls) {
    const amount = safeNumber(payroll.amount);
    const typeGroup = byType.get(payroll.type) ?? {
      type: payroll.type,
      label: payrollTypeLabel(payroll.type),
      total: 0,
      count: 0,
    };
    typeGroup.total += amount;
    typeGroup.count += 1;
    byType.set(payroll.type, typeGroup);

    const driverGroup = byDriver.get(payroll.driverId) ?? {
      driverId: payroll.driverId,
      label: payroll.driverName ?? payroll.driverPhone ?? payroll.driverId,
      total: 0,
      count: 0,
      tripCount: 0,
    };
    driverGroup.total += amount;
    driverGroup.count += 1;
    driverGroup.tripCount += payroll.tripCount ?? 0;
    byDriver.set(payroll.driverId, driverGroup);
  }

  return {
    total,
    incomeRatio: percentOf(total, summary.actualFreightTotal),
    averagePerTrip: summary.tripCount > 0 ? total / summary.tripCount : 0,
    byType: [...byType.values()].sort((left, right) => right.total - left.total),
    byDriver: [...byDriver.values()].sort((left, right) => right.total - left.total),
  };
}
