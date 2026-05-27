import { AdminShell } from "@/components/admin/admin-shell";
import { apiGet, formatMoney, type ProfitSummary } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { summary } = await apiGet<{ summary: ProfitSummary }>("/admin/reports/profit");

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>利润统计</h1>
          <p>按车辆、司机和时间查看运费、费用与利润。</p>
        </div>
      </section>
      <section className="metric-grid">
        <article className="metric-card">
          <span>已结算趟次</span>
          <strong>{summary.tripCount}</strong>
          <small>已完成结算</small>
        </article>
        <article className="metric-card">
          <span>实际运费</span>
          <strong>{formatMoney(summary.actualFreightTotal)}</strong>
          <small>来自结算快照</small>
        </article>
        <article className="metric-card">
          <span>费用合计</span>
          <strong>{formatMoney(summary.expenseTotal)}</strong>
          <small>含票据费用</small>
        </article>
        <article className="metric-card">
          <span>利润</span>
          <strong>{formatMoney(summary.profitTotal)}</strong>
          <small>实际运费减费用</small>
        </article>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>车辆利润排行</h2>
            <p>用于快速识别车辆经营表现。</p>
          </div>
        </div>
        <div className="chart-placeholder">
          <div style={{ height: "72%" }} />
          <div style={{ height: "54%" }} />
          <div style={{ height: "88%" }} />
          <div style={{ height: "41%" }} />
          <div style={{ height: "63%" }} />
        </div>
      </section>
    </AdminShell>
  );
}
