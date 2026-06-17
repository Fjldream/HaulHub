import { CalendarDays, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  buildMonthRange,
  payrollAnalysis,
  safeNumber,
} from "@/components/admin/profit-report-model";
import {
  apiGet,
  formatMoney,
  type DriverPayrollList,
  type ProfitSummary,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

type PayrollReportSearchParams = {
  month?: string;
};

type ProfitReportResponse = {
  summary: ProfitSummary;
};

function money(value: string | number | null | undefined) {
  return formatMoney(safeNumber(value).toFixed(2));
}

export default async function PayrollCostPage({
  searchParams,
}: {
  searchParams: Promise<PayrollReportSearchParams>;
}) {
  const params = await searchParams;
  const range = buildMonthRange(params.month);
  const payrollQuery = new URLSearchParams({
    month: range.month,
    pageSize: "100",
  });
  const profitQuery = new URLSearchParams({
    period: "month",
    from: range.from,
    to: range.to,
  });
  const [payrollList, profitReport] = await Promise.all([
    apiGet<DriverPayrollList>(`/admin/driver-payrolls?${payrollQuery.toString()}`),
    apiGet<ProfitReportResponse>(`/admin/reports/profit?${profitQuery.toString()}`),
  ]);
  const analysis = payrollAnalysis(payrollList.payrolls, profitReport.summary);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>工资成本</h1>
          <p>按月份分析司机工资总额、收入占比、每趟平均工资成本、类型结构和司机排行。</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/reports">
            利润总览
          </Link>
          <Link className="secondary-button" href={`/drivers/payroll?month=${range.month}`}>
            工资记录
          </Link>
        </div>
      </section>

      <form className="table-toolbar">
        <label className="toolbar-search">
          <CalendarDays size={16} />
          <input name="month" type="month" defaultValue={range.month} />
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
          <span>工资总额</span>
          <strong>{money(analysis.total)}</strong>
          <small>{range.month} 工资记录合计</small>
        </article>
        <article className="metric-card">
          <span>工资占收入比</span>
          <strong>{analysis.incomeRatio}</strong>
          <small>收入 {money(profitReport.summary.actualFreightTotal)}</small>
        </article>
        <article className="metric-card">
          <span>每趟平均工资成本</span>
          <strong>{money(analysis.averagePerTrip)}</strong>
          <small>按 {profitReport.summary.tripCount} 趟结算趟次摊分</small>
        </article>
        <article className="metric-card">
          <span>工资记录</span>
          <strong>{payrollList.total}</strong>
          <small>当前展示 {payrollList.payrolls.length} 条</small>
        </article>
      </section>

      <section className="report-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>按类型汇总</h2>
              <p>固定工资、趟次工资、奖金、扣款和其他调整的结构。</p>
            </div>
          </div>
          {analysis.byType.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>类型</th>
                    <th className="num">记录数</th>
                    <th className="num">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.byType.map((item) => (
                    <tr key={item.type}>
                      <td className="strong">{item.label}</td>
                      <td className="num">{item.count}</td>
                      <td className="num strong">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state compact">
              <strong>暂无工资类型数据</strong>
              <span>当前月份还没有工资记录。</span>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>司机工资排行</h2>
              <p>按司机汇总工资成本，并展示关联趟次工资数量。</p>
            </div>
          </div>
          {analysis.byDriver.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>司机</th>
                    <th className="num">记录数</th>
                    <th className="num">计薪趟数</th>
                    <th className="num">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.byDriver.slice(0, 10).map((item) => (
                    <tr key={item.driverId}>
                      <td className="strong">{item.label}</td>
                      <td className="num">{item.count}</td>
                      <td className="num">{item.tripCount}</td>
                      <td className="num strong">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state compact">
              <strong>暂无司机工资排行</strong>
              <span>当前月份还没有可汇总的工资记录。</span>
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
