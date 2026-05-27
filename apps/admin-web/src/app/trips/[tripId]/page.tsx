import { CheckCircle2, RotateCcw } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { expenses, trips } from "@/lib/mock-data";

export default async function TripReviewPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = trips.find((item) => item.id === tripId) ?? trips[0];

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>趟次账单详情/审核</h1>
          <p>{trip.tripNo} · 核对费用、票据和实际运费。</p>
        </div>
        <StatusBadge status={trip.status} />
      </section>

      <section className="detail-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>基础信息</h2>
              <p>{trip.customer}</p>
            </div>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>车牌号</dt>
              <dd>{trip.plateNumber}</dd>
            </div>
            <div>
              <dt>司机</dt>
              <dd>{trip.driver}</dd>
            </div>
            <div>
              <dt>路线</dt>
              <dd>{trip.route}</dd>
            </div>
            <div>
              <dt>提交时间</dt>
              <dd>{trip.submittedAt}</dd>
            </div>
          </dl>

          <div className="panel-header compact">
            <div>
              <h2>费用明细</h2>
              <p>票据状态和金额需要逐项核对。</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>费用类型</th>
                  <th className="num">金额</th>
                  <th>发生时间</th>
                  <th>票据</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.type}</td>
                    <td className="num">{expense.amount}</td>
                    <td>{expense.occurredAt}</td>
                    <td>{expense.receipt}</td>
                    <td>{expense.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="review-panel">
          <h2>结算摘要</h2>
          <div className="summary-row">
            <span>实际运费</span>
            <strong>{trip.actualFreight}</strong>
          </div>
          <div className="summary-row">
            <span>费用合计</span>
            <strong>{trip.expenseTotal}</strong>
          </div>
          <div className="summary-row total">
            <span>利润</span>
            <strong>{trip.profit}</strong>
          </div>
          <label>
            实际运费
            <input defaultValue="1800.00" />
          </label>
          <label>
            审核备注
            <textarea placeholder="记录调整原因或退回说明" />
          </label>
          <button className="primary-button">
            <CheckCircle2 size={16} />
            完成结算
          </button>
          <button className="danger-button">
            <RotateCcw size={16} />
            退回修改
          </button>
        </aside>
      </section>
    </AdminShell>
  );
}
