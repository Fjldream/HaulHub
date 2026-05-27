import { AdminShell } from "@/components/admin/admin-shell";

export default function ReportsPage() {
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
          <span>实际运费</span>
          <strong>¥186,420.00</strong>
          <small>本月已结算</small>
        </article>
        <article className="metric-card">
          <span>费用合计</span>
          <strong>¥62,830.50</strong>
          <small>含票据费用</small>
        </article>
        <article className="metric-card">
          <span>利润</span>
          <strong>¥123,589.50</strong>
          <small>利润率 66.3%</small>
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
