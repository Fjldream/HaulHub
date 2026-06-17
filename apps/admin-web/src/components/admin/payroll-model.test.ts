import { describe, expect, it } from "vitest";
import {
  calculateTripPayrollAmount,
  defaultSalaryMonth,
  isSalaryMonth,
  normalizePayrollTypeFilter,
  payrollTypeLabel,
} from "./payroll-model";

describe("payroll model", () => {
  it("validates salary month values", () => {
    expect(isSalaryMonth("2026-06")).toBe(true);
    expect(isSalaryMonth("2026-6")).toBe(false);
    expect(isSalaryMonth("2026-13")).toBe(false);
  });

  it("calculates trip payroll amount", () => {
    expect(calculateTripPayrollAmount("12", "100.50")).toBe("1206.00");
    expect(calculateTripPayrollAmount("m", "100")).toBeNull();
  });

  it("labels payroll types", () => {
    expect(payrollTypeLabel("fixed")).toBe("固定工资");
    expect(payrollTypeLabel("deduction")).toBe("扣款/调整");
  });

  it("formats default salary month from local date fields", () => {
    expect(defaultSalaryMonth(new Date(2026, 0, 5))).toBe("2026-01");
    expect(defaultSalaryMonth(new Date(2026, 10, 30))).toBe("2026-11");
  });

  it("falls back to all for unsupported payroll type filters", () => {
    expect(normalizePayrollTypeFilter("fixed")).toBe("fixed");
    expect(normalizePayrollTypeFilter("all")).toBe("all");
    expect(normalizePayrollTypeFilter("invalid")).toBe("all");
    expect(normalizePayrollTypeFilter(undefined)).toBe("all");
  });
});
