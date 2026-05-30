import { ArrowLeft, FileText, KeyRound, Link2, Unlink, X } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { TripTable } from "@/components/admin/trip-table";
import { redirectWithActionError } from "@/lib/action-errors";
import { apiGet, apiPost, type ApiDriver, type ApiDriverDocument, type ApiTrip, type ApiVehicle } from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function bindVehicleAction(formData: FormData) {
  "use server";
  const driverId = String(formData.get("driverId") || "");
  const vehicleId = String(formData.get("vehicleId") || "");
  try {
    await apiPost(`/admin/drivers/${driverId}/vehicles`, { vehicleId });
  } catch (error) {
    redirectWithActionError(`/drivers/${driverId}`, error);
  }
  revalidatePath(`/drivers/${driverId}`);
  redirect(`/drivers/${driverId}`);
}

async function unbindVehicleAction(formData: FormData) {
  "use server";
  const driverId = String(formData.get("driverId") || "");
  const vehicleId = String(formData.get("vehicleId") || "");
  try {
    await apiPost(`/admin/drivers/${driverId}/vehicles/${vehicleId}/unbind`);
  } catch (error) {
    redirectWithActionError(`/drivers/${driverId}`, error);
  }
  revalidatePath(`/drivers/${driverId}`);
  redirect(`/drivers/${driverId}`);
}

async function updateDriverAction(formData: FormData) {
  "use server";
  const driverId = String(formData.get("driverId") || "");
  try {
    await apiPost(`/admin/drivers/${driverId}`, {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      status: String(formData.get("status") || "active"),
    });
  } catch (error) {
    redirectWithActionError(`/drivers/${driverId}`, error);
  }
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/drivers");
  redirect(`/drivers/${driverId}`);
}

async function resetDriverPasswordAction(formData: FormData) {
  "use server";
  const driverId = String(formData.get("driverId") || "");
  try {
    await apiPost(`/admin/drivers/${driverId}/password`, {
      password: String(formData.get("password") || "123456"),
    });
  } catch (error) {
    redirectWithActionError(`/drivers/${driverId}`, error);
  }
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/drivers");
  redirect(`/drivers/${driverId}`);
}

async function updateDriverDocumentAction(formData: FormData) {
  "use server";
  const driverId = String(formData.get("driverId") || "");
  const type = String(formData.get("type") || "");
  const targetPath = `/drivers/${driverId}?documents=1`;
  try {
    await apiPost(`/admin/drivers/${driverId}/documents/${type}`, {
      status: String(formData.get("status") || "pending"),
      expiresAt: String(formData.get("expiresAt") || "") || undefined,
      note: String(formData.get("note") || "") || undefined,
    });
  } catch (error) {
    redirectWithActionError(targetPath, error);
  }
  revalidatePath(`/drivers/${driverId}`);
  redirect(targetPath);
}

function documentImageUrl(storageKey: string | null) {
  if (!storageKey) return null;
  if (/^https?:\/\//.test(storageKey)) return storageKey;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  if (storageKey.startsWith("uploads/")) {
    return `${base}/files/${storageKey.slice("uploads/".length)}`;
  }
  if (storageKey.startsWith("/")) return `${base}${storageKey}`;
  return storageKey;
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export default async function DriverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ driverId: string }>;
  searchParams?: Promise<{ documents?: string; preview?: string }>;
}) {
  const { driverId } = await params;
  const query = searchParams ? await searchParams : {};
  const [{ driver }, { vehicles }, { trips }, { documents }] = await Promise.all([
    apiGet<{ driver: ApiDriver }>(`/admin/drivers/${driverId}`),
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    apiGet<{ trips: ApiTrip[] }>(`/admin/trips?driverId=${driverId}`),
    apiGet<{ documents: ApiDriverDocument[] }>(`/admin/drivers/${driverId}/documents`),
  ]);
  const boundVehicles = driver.boundVehicles ?? [];
  const boundVehicleIds = new Set(boundVehicles.map((vehicle) => vehicle.id));
  const availableVehicles = vehicles.filter(
    (vehicle) => vehicle.status === "available" && !boundVehicleIds.has(vehicle.id),
  );
  const completedTripCount = trips.filter((trip) => trip.status === "completed").length;
  const activeTripCount = trips.filter((trip) =>
    ["assigned", "in_progress", "submitted", "under_review", "returned"].includes(trip.status),
  ).length;
  const showDocumentsModal = query.documents === "1";
  const pendingDocumentCount = documents.filter((document) => document.status === "pending").length;
  const approvedDocumentCount = documents.filter((document) => document.status === "approved").length;
  const attentionDocumentCount = documents.filter((document) =>
    ["missing", "rejected", "expired"].includes(document.status),
  ).length;
  const previewDocument = documents.find((document) => document.type === query.preview);
  const previewImageUrl = documentImageUrl(previewDocument?.storageKey ?? null);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>{driver.name}</h1>
          <p>维护司机账号和可驾驶车辆。司机端不会展示运费、利润和经营报表。</p>
        </div>
        <Link className="secondary-button" href="/drivers">
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </section>

      <section className="detail-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>司机资料</h2>
              <p>{driver.phone}</p>
            </div>
            <StatusBadge status={driver.status} />
          </div>
          <div className="info-list">
            <div>
              <span>姓名</span>
              <strong>{driver.name}</strong>
            </div>
            <div>
              <span>手机号</span>
              <strong>{driver.phone}</strong>
            </div>
            <div>
              <span>账号状态</span>
              <strong>{driver.status === "active" ? "在职" : "停用"}</strong>
            </div>
            <div>
              <span>可驾驶车辆</span>
              <strong>{boundVehicles.length} 辆</strong>
            </div>
            <div>
              <span>账号安全</span>
              <strong>{driver.isFirstLogin ? "需首次改密" : "正常"}</strong>
            </div>
          </div>

          <div className="panel-header compact">
            <div>
              <h2>可驾驶车辆</h2>
              <p>创建趟次时只能从这里选择车辆。</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>车牌号</th>
                  <th>车型</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {boundVehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="strong">{vehicle.plateNumber}</td>
                    <td>{vehicle.vehicleType ?? "-"}</td>
                    <td>
                      <StatusBadge status={vehicle.status} />
                    </td>
                    <td>
                      <form action={unbindVehicleAction}>
                        <input type="hidden" name="driverId" value={driver.id} />
                        <input type="hidden" name="vehicleId" value={vehicle.id} />
                        <button className="text-button" type="submit">
                          <Unlink size={15} />
                          解绑
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {boundVehicles.length === 0 ? (
              <div className="empty-state">
                <strong>还没有可驾驶车辆</strong>
                <span>绑定车辆后才能为该司机创建趟次。</span>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="review-panel">
          <h2>编辑司机</h2>
          <form action={updateDriverAction} className="form-panel">
            <input type="hidden" name="driverId" value={driver.id} />
            <label>
              姓名
              <input name="name" defaultValue={driver.name} required />
            </label>
            <label>
              手机号
              <input name="phone" inputMode="tel" defaultValue={driver.phone} required />
            </label>
            <label>
              状态
              <select name="status" defaultValue={driver.status}>
                <option value="active">在职</option>
                <option value="disabled">停用</option>
              </select>
            </label>
            <button className="primary-button" type="submit">
              保存司机
            </button>
          </form>

          <form action={resetDriverPasswordAction} className="form-panel">
            <input type="hidden" name="driverId" value={driver.id} />
            <input type="hidden" name="password" value="123456" />
            <button className="secondary-button" type="submit">
              <KeyRound size={16} />
              重置密码为 123456
            </button>
          </form>

          <h2>证件管理</h2>
          <div className="document-summary-card">
            <div className="document-summary-head">
              <div>
                <strong>{documents.length} 项证件</strong>
                <span>驾驶证、从业资格证等后台审核入口</span>
              </div>
              <FileText size={18} />
            </div>
            <div className="document-summary-stats">
              <span>待审核 {pendingDocumentCount}</span>
              <span>已通过 {approvedDocumentCount}</span>
              <span>需处理 {attentionDocumentCount}</span>
            </div>
            <Link className="secondary-button" href={`/drivers/${driver.id}?documents=1`}>
              打开证件管理
            </Link>
          </div>

          <h2>绑定车辆</h2>
          <div className="review-note">只列出可用且尚未绑定到该司机的车辆。</div>
          <form action={bindVehicleAction} className="form-panel">
            <input type="hidden" name="driverId" value={driver.id} />
            <label>
              车辆
              <select name="vehicleId" required defaultValue="">
                <option value="" disabled>
                  选择车辆
                </option>
                {availableVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plateNumber}
                    {vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary-button"
              disabled={availableVehicles.length === 0}
              type="submit"
            >
              <Link2 size={16} />
              绑定车辆
            </button>
          </form>
        </aside>
      </section>

      <section className="stat-strip detail-stat-strip">
        <div>
          <span>关联小票</span>
          <strong>{trips.length}</strong>
        </div>
        <div>
          <span>进行中/待处理</span>
          <strong>{activeTripCount}</strong>
        </div>
        <div>
          <span>已完成</span>
          <strong>{completedTripCount}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>关联小票</h2>
            <p>只显示当前司机参与的趟次账单。</p>
          </div>
          <span className="panel-kicker">{trips.length} 单</span>
        </div>
        {trips.length > 0 ? (
          <TripTable trips={trips} />
        ) : (
          <div className="empty-state">
            <strong>暂无关联小票</strong>
            <span>创建趟次并分配给该司机后会显示在这里。</span>
          </div>
        )}
      </section>

      {showDocumentsModal ? (
        <div className="modal-backdrop">
          <section className="modal-card document-modal-card">
            <div className="modal-header">
              <div>
                <h2>证件管理</h2>
                <p>审核 {driver.name} 的司机端上传证件，并维护证件到期时间。</p>
              </div>
              <Link className="icon-button" aria-label="关闭" href={`/drivers/${driver.id}`}>
                <X size={18} />
              </Link>
            </div>
            <div className="document-review-stack">
              {documents.map((document) => {
                const imageUrl = documentImageUrl(document.storageKey);
                return (
                  <form key={document.type} action={updateDriverDocumentAction} className="form-panel document-review-card">
                    <input type="hidden" name="driverId" value={driver.id} />
                    <input type="hidden" name="type" value={document.type} />
                    <div className="document-review-head">
                      <div>
                        <strong>{document.name}</strong>
                        <span>{document.storageKey ? "已上传图片" : "暂未上传图片"}</span>
                      </div>
                      <StatusBadge status={document.status} />
                    </div>
                    {imageUrl ? (
                      <Link
                        className="document-thumbnail-link"
                        href={`/drivers/${driver.id}?documents=1&preview=${document.type}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="document-thumbnail" src={imageUrl} alt={`${document.name}预览`} />
                        <span>点击放大查看</span>
                      </Link>
                    ) : (
                      <div className="document-thumbnail-empty">
                        <FileText size={22} />
                        <span>暂无证件图片</span>
                      </div>
                    )}
                    <label>
                      状态
                      <select name="status" defaultValue={document.status}>
                        <option value="missing">未上传</option>
                        <option value="pending">待审核</option>
                        <option value="approved">已通过</option>
                        <option value="rejected">已退回</option>
                        <option value="expired">已过期</option>
                      </select>
                    </label>
                    <label>
                      到期时间
                      <input name="expiresAt" type="date" defaultValue={dateInputValue(document.expiresAt)} />
                    </label>
                    <label>
                      审核备注
                      <textarea name="note" defaultValue={document.note ?? ""} rows={2} />
                    </label>
                    <button className="secondary-button" type="submit">
                      保存证件
                    </button>
                  </form>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {previewImageUrl && previewDocument ? (
        <div className="modal-backdrop document-preview-backdrop">
          <section className="modal-card document-preview-card">
            <div className="modal-header">
              <div>
                <h2>{previewDocument.name}</h2>
                <p>证件图片预览</p>
              </div>
              <Link className="icon-button" aria-label="关闭预览" href={`/drivers/${driver.id}?documents=1`}>
                <X size={18} />
              </Link>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="document-preview-image" src={previewImageUrl} alt={`${previewDocument.name}大图预览`} />
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
