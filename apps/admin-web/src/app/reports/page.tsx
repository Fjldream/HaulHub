import { CalendarDays, Download, SlidersHorizontal, TrendingUp } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  buildProfitOverviewRange,
  formatPercent,
  percentOf,
  safeNumber,
} from "@/components/admin/profit-report-model";
import {
  apiGet,
  formatMoney,
  type DriverTripCountGroup,
  type ExpenseTypeReportGroup,
  type ProfitPeriodGroup,
  type ProfitReportGroup,
  type ProfitSummary,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

type ReportSearchParams = {
  from?: string;
  to?: string;
  dimension?: string;
  period?: string;
};

function barHeight(value: string, values: string[]) {
  const max = Math.max(...values.map((item) => Math.abs(safeNumber(item))), 1);
  return `${Math.max(18, Math.round((Math.abs(safeNumber(value)) / max) * 88))}%`;
}

function periodLabel(period: string) {
  return period === "week" ? "周度" : period === "year" ? "年度" : "月度";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const params = await searchParams;
  const { from, to } = buildProfitOverviewRange(params.from, params.to);
  const period = ["week", "month", "year"].includes(params.period ?? "")
    ? (params.period as "week" | "month" | "year")
    : "month";
  const query = new URLSearchParams();
  query.set("from", from);
  query.set("to", to);
  query.set("period", period);

  const { summary, byVehicle, byDriver, byExpenseType, byPeriod } = await apiGet<{
    summary: ProfitSummary;
    byVehicle: ProfitReportGroup[];
    byDriver: DriverTripCountGroup[];
    byExpenseType: ExpenseTypeReportGroup[];
    byPeriod: ProfitPeriodGroup[];
  }>(`/admin/reports/profit?${query.toString()}`);

  const dimension = ["vehicle", "driver", "expense"].includes(params.dimension ?? "")
    ? params.dimension
    : "vehicle";
  const isExpenseDimension = dimension === "expense";
  const isDriverDimension = dimension === "driver";
  const vehicleRows = byVehicle.slice(0, 5);
  const periodRows = byPeriod.slice(-8);
  const vehicleDetailRows = byVehicle.slice(0, 8);
  const driverDetailRows = byDriver.slice(0, 8);
  const expenseDetailRows = byExpenseType.slice(0, 8);
  const hasDetailRows = isExpenseDimension
    ? expenseDetailRows.length > 0
    : isDriverDimension
      ? driverDetailRows.length > 0
      : vehicleDetailRows.length > 0;
  const exportHref = `/reports/export?${query.toString()}`;
  const barValues = periodRows.map((item) => item.profitTotal);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>利润统计</h1>
          <p>按周、月、年核算运费收入、趟次费用、车辆维修费、总支出与利润。</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/reports/monthly">
            月度利润
          </Link>
          <Link className="secondary-button" href="/reports/yearly">
            年度利润
          </Link>
          <Link className="secondary-button" href="/reports/payroll">
            工资成本
          </Link>
          <Link className="secondary-button" href="/trips/manual-completed/new">
            补录完成账单
          </Link>
          <Link className="secondary-button" href={exportHref}>
            <Download size={16} />
            导出
          </Link>
        </div>
      </section>

      <form className="table-toolbar">
        <label className="toolbar-search">
          <CalendarDays size={16} />
          <input name="from" type="date" defaultValue={from} aria-label="开始日期" />
        </label>
        <label className="toolbar-search">
          <CalendarDays size={16} />
          <input name="to" type="date" defaultValue={to} aria-label="结束日期" />
        </label>
        <div className="toolbar-group">
          <select name="period" defaultValue={period} aria-label="统计周期">
            <option value="week">按周</option>
            <option value="month">按月</option>
            <option value="year">按年</option>
          </select>
          <select name="dimension" defaultValue={dimension} aria-label="明细维度">
            <option value="vehicle">按车辆</option>
            <option value="driver">按司机趟次</option>
            <option value="expense">按费用类型</option>
          </select>
          <button className="secondary-button" type="submit">
            <SlidersHorizontal size={16} />
            筛选
          </button>
        </div>
      </form>

      <section className="metric-grid report-metric-grid">
        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-icon">
              <TrendingUp size={20} />
            </span>
            <span className="metric-trend">{periodLabel(period)}</span>
          </div>
          <span>已结算趟次</span>
          <strong>{summary.tripCount}</strong>
          <small>用于收入与趟次费用核算</small>
        </article>
        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-icon">
              <TrendingUp size={20} />
            </span>
            <span className="metric-trend">收入</span>
          </div>
          <span>实际运费</span>
          <strong>{formatMoney(summary.actualFreightTotal)}</strong>
          <small>来自已完成结算小票</small>
        </article>
        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-icon">
              <TrendingUp size={20} />
            </span>
            <span className="metric-trend">支出</span>
          </div>
          <span>总支出</span>
          <strong>{formatMoney(summary.expenseTotal)}</strong>
          <small>
            趟次 {formatMoney(summary.tripExpenseTotal)} · 维修{" "}
            {formatMoney(summary.maintenanceExpenseTotal)} · 工资{" "}
            {formatMoney(summary.driverPayrollTotal)}
          </small>
        </article>
        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-icon">
              <TrendingUp size={20} />
            </span>
            <span className="metric-trend">工资</span>
          </div>
          <span>司机工资成本</span>
          <strong>{formatMoney(summary.driverPayrollTotal)}</strong>
          <small>工资占收入 {percentOf(summary.driverPayrollTotal, summary.actualFreightTotal)}</small>
        </article>
        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-icon">
              <TrendingUp size={20} />
            </span>
            <span className="metric-trend">核算</span>
          </div>
          <span>利润</span>
          <strong>{formatMoney(summary.profitTotal)}</strong>
          <small>利润率 {formatPercent(summary.profitRate)}</small>
        </article>
      </section>

      {summary.payrollNotice ? (
        <div className="report-notice">{summary.payrollNotice}</div>
      ) : null}

      <section className="report-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>{periodLabel(period)}利润走势</h2>
              <p>鼠标悬停在柱体上可查看收入、支出和利润数字。</p>
            </div>
            <span className="panel-kicker">含维修费</span>
          </div>
          {periodRows.length > 0 ? (
            <div className="chart-placeholder" aria-label="利润走势柱状图">
              {periodRows.map((item) => (
                <div
                  key={item.period}
                  title={`${item.period}\n收入 ${formatMoney(item.actualFreightTotal)}\n趟次费用 ${formatMoney(item.tripExpenseTotal)}\n维修费用 ${formatMoney(item.maintenanceExpenseTotal)}\n司机工资 ${formatMoney(item.driverPayrollTotal)}\n总支出 ${formatMoney(item.totalExpense)}\n利润 ${formatMoney(item.profitTotal)}`}
                  style={{ height: barHeight(item.profitTotal, barValues) }}
                >
                  {item.period.slice(-5)}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <strong>暂无利润走势</strong>
              <span>完成结算或录入维修费用后自动生成。</span>
            </div>
          )}
        </div>
        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2>费用结构</h2>
              <p>车辆维修费会作为独立支出项进入统计。</p>
            </div>
          </div>
          <div className="report-list">
            {byExpenseType.length > 0 ? (
              byExpenseType.map((item) => (
                <div key={item.id} title={`${item.label}：${formatMoney(item.total)}`}>
                  <strong>{item.label}</strong>
                  <span>{percentOf(item.total, summary.expenseTotal)}</span>
                </div>
              ))
            ) : (
              <div>
                <strong>暂无费用</strong>
                <span>0%</span>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-header">
          <div>
            <h2>车辆利润排行</h2>
            <p>悬停柱体可查看车辆收入、支出和利润。</p>
          </div>
        </div>
        {vehicleRows.length > 0 ? (
          <div className="chart-placeholder" aria-label="车辆利润柱状图">
            {vehicleRows.map((item) => (
              <div
                key={item.id}
                title={`${item.label}\n趟次 ${item.tripCount}\n收入 ${formatMoney(item.actualFreightTotal)}\n支出 ${formatMoney(item.expenseTotal)}\n利润 ${formatMoney(item.profitTotal)}`}
                style={{ height: barHeight(item.profitTotal, vehicleRows.map((row) => row.profitTotal)) }}
              >
                {item.label.slice(0, 2)}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <strong>暂无车辆利润数据</strong>
            <span>完成结算后自动生成排行。</span>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-header">
          <div>
            <h2>结算明细</h2>
            <p>
              {isExpenseDimension
                ? "按费用类型汇总支出结构。"
                : isDriverDimension
                  ? "按司机维度统计已完成趟次数量，不统计司机利润。"
                  : "按车辆维度汇总实际运费、支出与利润。"}
            </p>
          </div>
        </div>
        {hasDetailRows ? (
          <div className="data-table-wrap">
            {isExpenseDimension ? (
              <table>
                <thead>
                  <tr>
                    <th>费用类型</th>
                    <th>占比</th>
                    <th>费用</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseDetailRows.map((item) => (
                    <tr key={`${item.id}-${item.label}`}>
                      <td>
                        <strong>{item.label}</strong>
                      </td>
                      <td>{percentOf(item.total, summary.expenseTotal)}</td>
                      <td>{formatMoney(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : isDriverDimension ? (
              <table>
                <thead>
                  <tr>
                    <th>司机</th>
                    <th>已完成趟次</th>
                  </tr>
                </thead>
                <tbody>
                  {driverDetailRows.map((item) => (
                    <tr key={`${item.id}-${item.label}`}>
                      <td>
                        <strong>{item.label}</strong>
                      </td>
                      <td>{item.tripCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>维度</th>
                    <th>趟次</th>
                    <th>实际运费</th>
                    <th>支出</th>
                    <th>利润</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleDetailRows.map((item) => (
                    <tr key={`${item.id}-${item.label}`}>
                      <td>
                        <strong>{item.label}</strong>
                      </td>
                      <td>{item.tripCount}</td>
                      <td>{formatMoney(item.actualFreightTotal)}</td>
                      <td>{formatMoney(item.expenseTotal)}</td>
                      <td>{formatMoney(item.profitTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <strong>暂无更多结算明细</strong>
            <span>完成结算后会自动汇总到这里。</span>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
