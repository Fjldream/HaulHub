import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-session";

const apiBaseUrl =
  process.env.NEXT_INTERNAL_API_BASE_URL ??
  process.env.ADMIN_INTERNAL_API_BASE_URL ??
  "http://localhost:4000";

interface ProfitReportGroup {
  label: string;
  tripCount: number;
  actualFreightTotal: string;
  expenseTotal: string;
  profitTotal: string;
}

interface DriverTripCountGroup {
  label: string;
  tripCount: number;
}

interface ExpenseTypeReportGroup {
  label: string;
  total: string;
}

interface ProfitPeriodGroup {
  period: string;
  tripCount: number;
  actualFreightTotal: string;
  tripExpenseTotal: string;
  maintenanceExpenseTotal: string;
  driverPayrollTotal: string;
  totalExpense: string;
  profitTotal: string;
}

interface ProfitReportResponse {
  summary: {
    tripCount: number;
    actualFreightTotal: string;
    tripExpenseTotal: string;
    maintenanceExpenseTotal: string;
    driverPayrollTotal: string;
    expenseTotal: string;
    profitTotal: string;
  };
  byVehicle: ProfitReportGroup[];
  byDriver: DriverTripCountGroup[];
  byExpenseType: ExpenseTypeReportGroup[];
  byPeriod: ProfitPeriodGroup[];
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function csvRow(values: Array<string | number>) {
  return values.map(csvCell).join(",");
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }

  const query = request.nextUrl.searchParams.toString();
  const response = await fetch(
    `${apiBaseUrl}/admin/reports/profit${query ? `?${query}` : ""}`,
    {
      headers: {
        "x-user-id": session.userId,
        "x-user-role": session.role,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return new Response("Export failed", { status: response.status });
  }

  const report = (await response.json()) as ProfitReportResponse;
  const rows = [
    csvRow(["类型", "名称", "趟次", "实际运费", "趟次费用", "维修费用", "司机工资", "总支出", "利润"]),
    csvRow([
      "汇总",
      "全部",
      report.summary.tripCount,
      report.summary.actualFreightTotal,
      report.summary.tripExpenseTotal,
      report.summary.maintenanceExpenseTotal,
      report.summary.driverPayrollTotal,
      report.summary.expenseTotal,
      report.summary.profitTotal,
    ]),
    ...report.byPeriod.map((item) =>
      csvRow([
        "周期",
        item.period,
        item.tripCount,
        item.actualFreightTotal,
        item.tripExpenseTotal,
        item.maintenanceExpenseTotal,
        item.driverPayrollTotal,
        item.totalExpense,
        item.profitTotal,
      ]),
    ),
    ...report.byVehicle.map((item) =>
      csvRow([
        "车辆",
        item.label,
        item.tripCount,
        item.actualFreightTotal,
        "",
        "",
        "",
        item.expenseTotal,
        item.profitTotal,
      ]),
    ),
    ...report.byDriver.map((item) =>
      csvRow([
        "司机趟次",
        item.label,
        item.tripCount,
        "",
        "",
        "",
        "",
        "",
        "",
      ]),
    ),
    ...report.byExpenseType.map((item) =>
      csvRow(["费用类型", item.label, "", "", "", "", "", item.total, ""]),
    ),
  ];

  return new Response(`\uFEFF${rows.join("\r\n")}`, {
    headers: {
      "content-disposition": "attachment; filename=haulhub-profit-report.csv",
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
