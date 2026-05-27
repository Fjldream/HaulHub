import { CheckCircle2, PlayCircle, RotateCcw } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  apiGet,
  apiPost,
  formatDateTime,
  formatMoney,
  type ApiTrip,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function startReviewAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  await apiPost(`/admin/trips/${tripId}/review`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function returnTripAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const reason = String(formData.get("reason") || "请补充或修正票据后重新提交");
  await apiPost(`/admin/trips/${tripId}/return`, { reason });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function settleTripAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const actualFreight = String(formData.get("actualFreight") || "");
  await apiPost(`/admin/trips/${tripId}/settle`, { actualFreight });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export default async function TripReviewPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { trip } = await apiGet<{ trip: ApiTrip }>(`/admin/trips/${tripId}`);
  const canStartReview = trip.status === "submitted";
  const canSettleOrReturn = trip.status === "under_review";

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>趟次账单详情/审核</h1>
          <p>
            {trip.tripNo} - 核对费用、票据和实际运费。
          </p>
        </div>
        <StatusBadge status={trip.status} />
      </section>

      <section className="detail-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>基础信息</h2>
              <p>{trip.customerName}</p>
            </div>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>车牌号</dt>
              <dd>{trip.vehicle.plateNumber}</dd>
            </div>
            <div>
              <dt>司机</dt>
              <dd>{trip.driver.name}</dd>
            </div>
            <div>
              <dt>路线</dt>
              <dd>
                {trip.loadLocation} -&gt; {trip.unloadLocation}
              </dd>
            </div>
            <div>
              <dt>提交时间</dt>
              <dd>{formatDateTime(trip.submittedAt)}</dd>
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
                {trip.expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.expenseTypeName}</td>
                    <td className="num">{formatMoney(expense.amount)}</td>
                    <td>{formatDateTime(expense.occurredAt)}</td>
                    <td>{expense.receiptImages.length > 0 ? "已上传" : "缺少票据"}</td>
                    <td>{expense.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="review-panel">
          <h2>结算摘要</h2>
          <div className="summary-row">
            <span>预计运费</span>
            <strong>{formatMoney(trip.estimatedFreight)}</strong>
          </div>
          <div className="summary-row">
            <span>实际运费</span>
            <strong>{formatMoney(trip.actualFreight)}</strong>
          </div>
          <div className="summary-row">
            <span>费用合计</span>
            <strong>{formatMoney(trip.expenseTotal)}</strong>
          </div>
          <div className="summary-row total">
            <span>利润</span>
            <strong>{formatMoney(trip.profit)}</strong>
          </div>

          {canStartReview ? (
            <form action={startReviewAction}>
              <input type="hidden" name="tripId" value={trip.id} />
              <button className="primary-button" type="submit">
                <PlayCircle size={16} />
                开始审核
              </button>
            </form>
          ) : null}

          <form action={settleTripAction}>
            <input type="hidden" name="tripId" value={trip.id} />
            <label>
              实际运费
              <input
                name="actualFreight"
                defaultValue={trip.actualFreight ?? trip.estimatedFreight ?? ""}
                disabled={!canSettleOrReturn}
              />
            </label>
            <button className="primary-button" type="submit" disabled={!canSettleOrReturn}>
              <CheckCircle2 size={16} />
              完成结算
            </button>
          </form>

          <form action={returnTripAction}>
            <input type="hidden" name="tripId" value={trip.id} />
            <label>
              退回原因
              <textarea
                name="reason"
                placeholder="记录调整原因或退回说明"
                disabled={!canSettleOrReturn}
              />
            </label>
            <button className="danger-button" type="submit" disabled={!canSettleOrReturn}>
              <RotateCcw size={16} />
              退回修改
            </button>
          </form>
        </aside>
      </section>
    </AdminShell>
  );
}
