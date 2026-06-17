import { describe, expect, it } from "vitest";
import { normalizeAdminProfitReport } from "./report-model";
import type { AdminProfitReport } from "@/api/client";

const money = (value: string | number | null | undefined) => `money:${value ?? "0"}`;

function baseReport(): AdminProfitReport {
  return {
    summary: {
      tripCount: 2,
      actualFreightTotal: "1000.00",
      tripExpenseTotal: "120.00",
      maintenanceExpenseTotal: "80.00",
      driverPayrollTotal: "300.00",
      expenseTotal: "500.00",
      profitTotal: "500.00",
      profitRate: "0.5000",
      payrollNotice: "Weekly reports exclude payroll.",
    },
    byPeriod: [
      {
        period: "2026-06",
        tripCount: 2,
        actualFreightTotal: "1000.00",
        tripExpenseTotal: "120.00",
        maintenanceExpenseTotal: "80.00",
        driverPayrollTotal: "300.00",
        totalExpense: "500.00",
        profitTotal: "500.00",
        profitRate: "0.5000",
      },
    ],
    byVehicle: [
      {
        id: "vehicle-1",
        label: "A-100",
        tripCount: 2,
        actualFreightTotal: "1000.00",
        expenseTotal: "500.00",
        profitTotal: "500.00",
      },
    ],
    byDriver: [{ id: "driver-1", label: "Driver A", tripCount: 2 }],
    byExpenseType: [{ id: "fuel", label: "Fuel", total: "120.00" }],
  };
}

describe("admin report model", () => {
  it("formats payroll amounts and preserves payroll metadata", () => {
    expect(normalizeAdminProfitReport(baseReport(), money)).toMatchObject({
      summary: {
        driverPayrollTotal: "money:300.00",
        profitRate: "0.5000",
        payrollNotice: "Weekly reports exclude payroll.",
      },
      byPeriod: [
        {
          driverPayrollTotal: "money:300.00",
          profitRate: "0.5000",
        },
      ],
    });
  });

  it("defaults missing payroll totals from legacy responses to zero", () => {
    const legacyReport = baseReport() as unknown as AdminProfitReport;
    delete (legacyReport.summary as Partial<AdminProfitReport["summary"]>).driverPayrollTotal;
    delete (legacyReport.summary as Partial<AdminProfitReport["summary"]>).profitRate;
    delete (legacyReport.summary as Partial<AdminProfitReport["summary"]>).payrollNotice;
    delete (legacyReport.byPeriod[0] as Partial<AdminProfitReport["byPeriod"][number]>).driverPayrollTotal;

    expect(normalizeAdminProfitReport(legacyReport, money)).toMatchObject({
      summary: { driverPayrollTotal: "money:0", profitRate: null, payrollNotice: null },
      byPeriod: [{ driverPayrollTotal: "money:0" }],
    });
  });
});
