import { CalendarDays, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  buildYearRange,
  formatPercent,
  safeNumber,
} from "@/components/admin/profit-report-model";
import { apiGet, formatMoney, type ProfitPeriodGroup, type ProfitSummary } from "@/lib/api-client";

export const dynamic = "force-dynamic";

type YearlySearchParams = {
  fromYear?: string;
  toYear?: string;
};

type ProfitReportResponse = {
  summary: ProfitSummary;
  byPeriod: ProfitPeriodGroup[];
};

function money(value: string | number | null | undefined) {
  return formatMoney(safeNumber(value).toFixed(2));
}

function rowProfitRate(row: Pick<ProfitPeriodGroup, "actualFreightTotal" | "profitTotal" | "profitRate">) {
  if (row.profitRate) {
    return formatPercent(row.profitRate);
  }

  const income = safeNumber(row.actualFreightTotal);
  return income > 0 ? formatPercent(safeNumber(row.profitTotal) / income) : "0.0%";
}

function emptyPeriod(period: string): ProfitPeriodGroup {
  return {
    period,
    tripCount: 0,
    actualFreightTotal: "0.00",
    tripExpenseTotal: "0.00",
    maintenanceExpenseTotal: "0.00",
    driverPayrollTotal: "0.00",
    totalExpense: "0.00",
    profitTotal: "0.00",
    profitRate: null,
    payrollNotice: null,
  };
}

export default async function YearlyProfitPage({
  searchParams,
}: {
  searchParams: Promise<YearlySearchParams>;
}) {
  const params = await searchParams;
  const range = buildYearRange(params.fromYear, params.toYear);
  const query = new URLSearchParams({
    period: "year",
    from: range.from,
    to: range.to,
  });
  const { summary, byPeriod } = await apiGet<ProfitReportResponse>(
    `/admin/reports/profit?${query.toString()}`,
  );
  const periodMap = new Map(byPeriod.map((item) => [item.period, item]));
  const rows = Array.from({ length: range.toYear - range.fromYear + 1 }, (_, index) => {
    const period = String(range.fromYear + index);
    return { ...emptyPeriod(period), ...periodMap.get(period) };
  });

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>年度利润</h1>
          <p>查看年度收入、趟次费用、维修费用、司机工资、总支出、利润和利润率。</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/reports/monthly">
            月度利润
          </Link>
          <Link className="secondary-button" href="/reports/payroll">
            工资成本
          </Link>
        </div>
      </section>

      <form className="table-toolbar">
        <label className="toolbar-search">
          <CalendarDays size={16} />
          <input name="fromYear" inputMode="numeric" pattern="\d{4}" defaultValue={String(range.fromYear)} />
        </label>
        <label className="toolbar-search">
          <CalendarDays size={16} />
          <input name="toYear" inputMode="numeric" pattern="\d{4}" defaultValue={String(range.toYear)} />
        </label>
        <div className="toolbar-group">
          <button className="secondary-button" type="submit">
            <SlidersHorizontal size={16} />
            查询
          </button>
        </div>
      </form>

      <section className="metric-grid">
        <article className="metric-card">
          <span>区间收入</span>
          <strong>{money(summary.actualFreightTotal)}</strong>
          <small>
            {range.fromYear} - {range.toYear}
          </small>
        </article>
        <article className="metric-card">
          <span>区间总支出</span>
          <strong>{money(summary.expenseTotal)}</strong>
          <small>趟次 + 维修 + 工资</small>
        </article>
        <article className="metric-card">
          <span>司机工资</span>
          <strong>{money(summary.driverPayrollTotal)}</strong>
          <small>按工资年份归属</small>
        </article>
        <article className="metric-card">
          <span>区间利润</span>
          <strong>{money(summary.profitTotal)}</strong>
          <small>利润率 {formatPercent(summary.profitRate)}</small>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>年度利润汇总</h2>
            <p>非法年份会回退到默认区间，起止年份倒置时自动校正。</p>
          </div>
          <span className="panel-kicker">共 {rows.length} 年</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>年份</th>
                <th className="num">收入</th>
                <th className="num">趟次费用</th>
                <th className="num">维修费用</th>
                <th className="num">司机工资</th>
                <th className="num">总支出</th>
                <th className="num">利润</th>
                <th className="num">利润率 / 趟数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.period}>
                  <td className="strong">{row.period}</td>
                  <td className="num">{money(row.actualFreightTotal)}</td>
                  <td className="num">{money(row.tripExpenseTotal)}</td>
                  <td className="num">{money(row.maintenanceExpenseTotal)}</td>
                  <td className="num">{money(row.driverPayrollTotal)}</td>
                  <td className="num">{money(row.totalExpense)}</td>
                  <td className="num strong">{money(row.profitTotal)}</td>
                  <td className="num">
                    {rowProfitRate(row)} / {row.tripCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
