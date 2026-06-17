import { describe, expect, it } from "vitest";
import {
  buildMonthRange,
  buildSingleYearRange,
  buildYearRange,
  formatPercent,
  payrollAnalysis,
  safeNumber,
} from "./profit-report-model";

describe("profit report helpers", () => {
  it("falls back from invalid month and year query values", () => {
    expect(buildMonthRange("2026-13", new Date(2026, 5, 17))).toEqual({
      month: "2026-06",
      from: "2026-06-01",
      to: "2026-06-30",
    });

    expect(buildYearRange("abc", "2024", 2026)).toEqual({
      fromYear: 2024,
      toYear: 2026,
      from: "2024-01-01",
      to: "2026-12-31",
    });

    expect(buildSingleYearRange(undefined, 2026)).toEqual({
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("normalizes API numeric strings for money and rate calculations", () => {
    expect(safeNumber("1200.50")).toBe(1200.5);
    expect(safeNumber("not-a-number")).toBe(0);
    expect(formatPercent("0.256")).toBe("25.6%");
    expect(formatPercent(null)).toBe("0.0%");
  });

  it("summarizes payroll cost by type and driver", () => {
    const result = payrollAnalysis(
      [
        {
          id: "p1",
          teamId: "team-1",
          driverId: "d1",
          driverName: "Driver A",
          driverPhone: null,
          salaryMonth: "2026-06",
          type: "trip",
          amount: "600.00",
          tripCount: 6,
          unitAmount: "100.00",
          paidAt: null,
          note: null,
          createdBy: "u1",
          creatorName: null,
          createdAt: "2026-06-01",
          updatedAt: "2026-06-01",
        },
        {
          id: "p2",
          teamId: "team-1",
          driverId: "d1",
          driverName: "Driver A",
          driverPhone: null,
          salaryMonth: "2026-06",
          type: "bonus",
          amount: "100.00",
          tripCount: null,
          unitAmount: null,
          paidAt: null,
          note: null,
          createdBy: "u1",
          creatorName: null,
          createdAt: "2026-06-01",
          updatedAt: "2026-06-01",
        },
        {
          id: "p3",
          teamId: "team-1",
          driverId: "d2",
          driverName: null,
          driverPhone: "13800000000",
          salaryMonth: "2026-06",
          type: "fixed",
          amount: "300.00",
          tripCount: null,
          unitAmount: null,
          paidAt: null,
          note: null,
          createdBy: "u1",
          creatorName: null,
          createdAt: "2026-06-01",
          updatedAt: "2026-06-01",
        },
      ],
      { actualFreightTotal: "2000.00", tripCount: 10 },
    );

    expect(result.total).toBe(1000);
    expect(result.incomeRatio).toBe("50.0%");
    expect(result.averagePerTrip).toBe(100);
    expect(result.byType).toEqual([
      { type: "trip", label: "趟次工资", total: 600, count: 1 },
      { type: "fixed", label: "固定工资", total: 300, count: 1 },
      { type: "bonus", label: "奖金", total: 100, count: 1 },
    ]);
    expect(result.byDriver[0]).toMatchObject({
      driverId: "d1",
      label: "Driver A",
      total: 700,
      count: 2,
    });
  });
});
