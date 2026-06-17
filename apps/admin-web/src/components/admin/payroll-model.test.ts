import { describe, expect, it } from "vitest";
import { calculateTripPayrollAmount, isSalaryMonth, payrollTypeLabel } from "./payroll-model";

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
});
