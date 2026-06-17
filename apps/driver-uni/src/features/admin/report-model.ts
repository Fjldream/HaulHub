import type { AdminProfitReport } from "@/api/client";

type CurrencyFormatter = (value: string | number | null | undefined) => string;

export function normalizeAdminProfitReport(
  report: AdminProfitReport,
  formatCurrency: CurrencyFormatter,
): AdminProfitReport {
  return {
    ...report,
    summary: {
      ...report.summary,
      actualFreightTotal: formatCurrency(report.summary.actualFreightTotal),
      tripExpenseTotal: formatCurrency(report.summary.tripExpenseTotal),
      maintenanceExpenseTotal: formatCurrency(report.summary.maintenanceExpenseTotal),
      driverPayrollTotal: formatCurrency(report.summary.driverPayrollTotal),
      expenseTotal: formatCurrency(report.summary.expenseTotal),
      profitTotal: formatCurrency(report.summary.profitTotal),
      profitRate: report.summary.profitRate ?? null,
      payrollNotice: report.summary.payrollNotice ?? null,
    },
    byPeriod: (report.byPeriod ?? []).map((item) => ({
      ...item,
      actualFreightTotal: formatCurrency(item.actualFreightTotal),
      tripExpenseTotal: formatCurrency(item.tripExpenseTotal),
      maintenanceExpenseTotal: formatCurrency(item.maintenanceExpenseTotal),
      driverPayrollTotal: formatCurrency(item.driverPayrollTotal),
      totalExpense: formatCurrency(item.totalExpense),
      profitTotal: formatCurrency(item.profitTotal),
      profitRate: item.profitRate,
    })),
    byVehicle: (report.byVehicle ?? []).map((item) => ({
      ...item,
      actualFreightTotal: formatCurrency(item.actualFreightTotal),
      expenseTotal: formatCurrency(item.expenseTotal),
      profitTotal: formatCurrency(item.profitTotal),
    })),
    byDriver: (report.byDriver ?? []).map((item) => ({
      ...item,
    })),
    byExpenseType: (report.byExpenseType ?? []).map((item) => ({
      ...item,
      total: formatCurrency(item.total),
    })),
  };
}
