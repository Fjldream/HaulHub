import {
  Ban,
  CheckCircle2,
  Edit3,
  FileImage,
  PlayCircle,
  RotateCcw,
  Route,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { DecimalInput } from "@/components/admin/decimal-input";
import { getReceiptImageFile, receiptImagePayload } from "@/components/admin/receipt-upload-model";
import { ReceiptUploadForm } from "@/components/admin/receipt-upload-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { redirectWithActionError } from "@/lib/action-errors";
import {
  apiGet,
  apiPost,
  apiUploadFile,
  formatDateTime,
  formatMoney,
  type ApiExpense,
  type ApiReceiptImage,
  type ApiTrip,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function startReviewAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  try {
    await apiPost(`/admin/trips/${tripId}/review`);
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function returnTripAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const reason = String(formData.get("reason") || "请补充或修正票据后重新提交");
  try {
    await apiPost(`/admin/trips/${tripId}/return`, { reason });
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function settleTripAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const actualFreight = String(formData.get("actualFreight") || "");
  try {
    await apiPost(`/admin/trips/${tripId}/settle`, { actualFreight });
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function cancelTripAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const reason = String(formData.get("reason") || "");
  try {
    await apiPost(`/admin/trips/${tripId}/cancel`, { reason });
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function updateExpenseAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const expenseId = String(formData.get("expenseId"));
  try {
    await apiPost<{ expense: ApiExpense }>(`/admin/expenses/${expenseId}`, {
      amount: String(formData.get("amount") || ""),
      note: String(formData.get("note") || ""),
    });
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function deleteExpenseAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const expenseId = String(formData.get("expenseId"));
  try {
    await apiPost(`/admin/expenses/${expenseId}/delete`);
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function attachReceiptImageAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const expenseId = String(formData.get("expenseId"));
  const selectedFile = getReceiptImageFile(formData);
  if (!selectedFile.ok) {
    redirectWithActionError(`/trips/${tripId}`, new Error(selectedFile.message));
  }
  try {
    const uploadedFile = await apiUploadFile(selectedFile.file);
    await apiPost(`/admin/expenses/${expenseId}/receipt-images`, {
      ...receiptImagePayload({ ...uploadedFile, file: selectedFile.file }),
    });
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

async function deleteReceiptImageAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId"));
  const receiptImageId = String(formData.get("receiptImageId"));
  try {
    await apiPost(`/admin/receipt-images/${receiptImageId}/delete`);
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}`, error);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

function fileUrl(storageKey: string | null) {
  if (!storageKey) return null;
  if (/^https?:\/\//.test(storageKey)) return storageKey;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  if (storageKey.startsWith("uploads/")) {
    return `${base}/files/${storageKey.slice("uploads/".length)}`;
  }
  if (storageKey.startsWith("/")) return `${base}${storageKey}`;
  return storageKey;
}

export default async function TripReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams?: Promise<{ receipt?: string }>;
}) {
  const { tripId } = await params;
  const query = searchParams ? await searchParams : {};
  const { trip } = await apiGet<{ trip: ApiTrip }>(`/admin/trips/${tripId}`);
  const canStartReview = trip.status === "submitted";
  const canSettleOrReturn = trip.status === "under_review";
  const canCancelTrip = trip.status === "assigned";
  const canEditTrip = !["completed", "cancelled"].includes(trip.status);
  const canEditExpenses = trip.status === "under_review";
  const canManageReceipts = trip.status !== "cancelled";
  const receiptImages = trip.expenses.flatMap((expense) =>
    expense.receiptImages.map((image) => ({ ...image, expenseName: expense.expenseTypeName })),
  );
  const previewReceipt = receiptImages.find((image) => image.id === query.receipt);
  const previewReceiptUrl = fileUrl(previewReceipt?.storageKey ?? null);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>趟次账单详情/审核</h1>
          <p>
            {trip.tripNo} - 核对费用、票据和实际运费。
          </p>
        </div>
        <div className="button-row">
          {canEditTrip ? (
            <Link className="secondary-button" href={`/trips/${trip.id}/edit`}>
              <Edit3 size={16} />
              编辑趟次
            </Link>
          ) : null}
          <StatusBadge status={trip.status} />
        </div>
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
              <dd className="receipt-cell">
                <Truck size={15} />
                {trip.vehicle.plateNumber}
              </dd>
            </div>
            <div>
              <dt>司机</dt>
              <dd className="receipt-cell">
                <UserRound size={15} />
                {trip.driver.name}
              </dd>
            </div>
            <div>
              <dt>协同司机</dt>
              <dd>
                {(trip.assistantDrivers?.length ?? 0) > 0
                  ? trip.assistantDrivers?.map((driver) => driver.name).join("、")
                  : "无"}
              </dd>
            </div>
            <div>
              <dt>路线</dt>
              <dd className="receipt-cell">
                <Route size={15} />
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
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {trip.expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.expenseTypeName}</td>
                    <td className="num">
                      {canEditExpenses ? (
                        <DecimalInput
                          className="table-input num"
                          form={`expense-update-${expense.id}`}
                          labelText="费用金额"
                          name="amount"
                          defaultValue={expense.amount ?? ""}
                          required
                        />
                      ) : (
                        formatMoney(expense.amount)
                      )}
                    </td>
                    <td>{formatDateTime(expense.occurredAt)}</td>
                    <td>
                      {expense.receiptImages.length > 0 ? (
                        <div className="receipt-preview-list">
                          {expense.receiptImages.map((image: ApiReceiptImage, index) => {
                            const imageUrl = fileUrl(image.storageKey);
                            return imageUrl ? (
                              <div key={image.id} className="table-actions">
                                <Link
                                  className="receipt-thumb-link"
                                  href={`/trips/${trip.id}?receipt=${image.id}`}
                                >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={imageUrl} alt={`${expense.expenseTypeName}票据${index + 1}`} />
                                </Link>
                                {canManageReceipts ? (
                                  <form action={deleteReceiptImageAction}>
                                    <input type="hidden" name="tripId" value={trip.id} />
                                    <input type="hidden" name="receiptImageId" value={image.id} />
                                    <button className="text-button danger-text" type="submit">
                                      删除
                                    </button>
                                  </form>
                                ) : null}
                              </div>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <span className="status danger">
                          <FileImage size={13} />
                          缺少票据
                        </span>
                      )}
                      {canManageReceipts ? (
                        <ReceiptUploadForm
                          action={attachReceiptImageAction}
                          tripId={trip.id}
                          expenseId={expense.id}
                          expenseName={expense.expenseTypeName}
                        />
                      ) : null}
                    </td>
                    <td>
                      {canEditExpenses ? (
                        <input
                          className="table-input"
                          form={`expense-update-${expense.id}`}
                          name="note"
                          defaultValue={expense.note ?? ""}
                          placeholder="备注"
                        />
                      ) : (
                        (expense.note ?? "-")
                      )}
                    </td>
                    <td>
                      {canEditExpenses ? (
                        <div className="table-actions">
                          <form id={`expense-update-${expense.id}`} action={updateExpenseAction}>
                            <input type="hidden" name="tripId" value={trip.id} />
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <button className="text-button" type="submit">
                              保存
                            </button>
                          </form>
                          <form action={deleteExpenseAction}>
                            <input type="hidden" name="tripId" value={trip.id} />
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <button className="text-button danger-text" type="submit">
                              删除
                            </button>
                          </form>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="review-panel">
          <h2>结算摘要</h2>
          <div className="review-note">
            审核开始后司机端费用会锁定。退回时请写清楚需要修改的项目。
          </div>
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

          {canCancelTrip ? (
            <form action={cancelTripAction}>
              <input type="hidden" name="tripId" value={trip.id} />
              <label>
                撤销原因
                <textarea
                  name="reason"
                  placeholder="例如：客户取消、车辆临时不可用"
                  required
                />
              </label>
              <button className="danger-button" type="submit">
                <Ban size={16} />
                撤销小票
              </button>
            </form>
          ) : null}

          <form action={settleTripAction}>
            <input type="hidden" name="tripId" value={trip.id} />
            <label>
              实际运费
              <DecimalInput
                labelText="实际运费"
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

      {previewReceiptUrl && previewReceipt ? (
        <div className="modal-backdrop document-preview-backdrop">
          <section className="modal-card document-preview-card">
            <div className="modal-header">
              <div>
                <h2>{previewReceipt.expenseName}票据</h2>
                <p>上传时间：{previewReceipt.createdAt ? formatDateTime(previewReceipt.createdAt) : "未记录"}</p>
              </div>
              <Link className="icon-button" aria-label="关闭预览" href={`/trips/${trip.id}`}>
                <X size={18} />
              </Link>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="document-preview-image" src={previewReceiptUrl} alt={`${previewReceipt.expenseName}票据预览`} />
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
