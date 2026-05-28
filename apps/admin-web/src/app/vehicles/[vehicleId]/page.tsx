import { ArrowLeft, Link2, Unlink, Wrench } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { TripTable } from "@/components/admin/trip-table";
import {
  apiGet,
  apiPost,
  formatDateTime,
  formatMoney,
  type ApiDriver,
  type ApiTrip,
  type ApiVehicle,
  type ApiVehicleMaintenanceList,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function bindDriverAction(formData: FormData) {
  "use server";
  const vehicleId = String(formData.get("vehicleId") || "");
  const driverId = String(formData.get("driverId") || "");
  await apiPost(`/admin/vehicles/${vehicleId}/drivers`, { driverId });
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}`);
}

async function unbindDriverAction(formData: FormData) {
  "use server";
  const vehicleId = String(formData.get("vehicleId") || "");
  const driverId = String(formData.get("driverId") || "");
  await apiPost(`/admin/vehicles/${vehicleId}/drivers/${driverId}/unbind`);
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}`);
}

async function updateVehicleAction(formData: FormData) {
  "use server";
  const vehicleId = String(formData.get("vehicleId") || "");
  await apiPost(`/admin/vehicles/${vehicleId}`, {
    plateNumber: String(formData.get("plateNumber") || ""),
    vehicleType: String(formData.get("vehicleType") || ""),
    note: String(formData.get("note") || ""),
    status: String(formData.get("status") || "available"),
  });
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/vehicles");
  redirect(`/vehicles/${vehicleId}`);
}

async function createMaintenanceAction(formData: FormData) {
  "use server";
  const vehicleId = String(formData.get("vehicleId") || "");
  await apiPost("/admin/vehicle-maintenance", {
    vehicleId,
    component: String(formData.get("component") || ""),
    amount: String(formData.get("amount") || ""),
    occurredAt: String(formData.get("occurredAt") || ""),
    voucherStorageKey: String(formData.get("voucherStorageKey") || ""),
    note: String(formData.get("note") || ""),
  });
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/reports");
  redirect(`/vehicles/${vehicleId}`);
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const [
    { vehicle },
    { drivers },
    { trips },
    { records: maintenanceRecords, total: maintenanceRecordTotal },
  ] = await Promise.all([
    apiGet<{ vehicle: ApiVehicle }>(`/admin/vehicles/${vehicleId}`),
    apiGet<{ drivers: ApiDriver[] }>("/admin/drivers"),
    apiGet<{ trips: ApiTrip[] }>(`/admin/trips?vehicleId=${vehicleId}`),
    apiGet<ApiVehicleMaintenanceList>(`/admin/vehicle-maintenance?vehicleId=${vehicleId}&pageSize=5`),
  ]);
  const boundDrivers = vehicle.boundDrivers ?? [];
  const boundDriverIds = new Set(boundDrivers.map((driver) => driver.id));
  const availableDrivers = drivers.filter(
    (driver) => driver.status === "active" && !boundDriverIds.has(driver.id),
  );
  const completedTripCount = trips.filter((trip) => trip.status === "completed").length;
  const activeTripCount = trips.filter((trip) =>
    ["assigned", "in_progress", "submitted", "under_review", "returned"].includes(trip.status),
  ).length;
  const maintenanceTotal = maintenanceRecords.reduce(
    (total, record) => total + Number(record.amount),
    0,
  );

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>{vehicle.plateNumber}</h1>
          <p>维护车辆可分配司机。创建趟次时只能选择已绑定司机。</p>
        </div>
        <Link className="secondary-button" href="/vehicles">
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </section>

      <section className="detail-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>车辆资料</h2>
              <p>{vehicle.vehicleType ?? "未填写车型"}</p>
            </div>
            <StatusBadge status={vehicle.status} />
          </div>
          <div className="info-list">
            <div>
              <span>车牌号</span>
              <strong>{vehicle.plateNumber}</strong>
            </div>
            <div>
              <span>车型</span>
              <strong>{vehicle.vehicleType ?? "-"}</strong>
            </div>
            <div>
              <span>备注</span>
              <strong>{vehicle.note ?? "-"}</strong>
            </div>
            <div>
              <span>绑定司机</span>
              <strong>{boundDrivers.length} 人</strong>
            </div>
          </div>

          <div className="panel-header compact">
            <div>
              <h2>已绑定司机</h2>
              <p>解绑后该司机不能再被分配到这辆车的新趟次。</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>司机</th>
                  <th>手机号</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {boundDrivers.map((driver) => (
                  <tr key={driver.id}>
                    <td className="strong">{driver.name}</td>
                    <td>{driver.phone}</td>
                    <td>
                      <StatusBadge status={driver.status} />
                    </td>
                    <td>
                      <form action={unbindDriverAction}>
                        <input type="hidden" name="vehicleId" value={vehicle.id} />
                        <input type="hidden" name="driverId" value={driver.id} />
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
            {boundDrivers.length === 0 ? (
              <div className="empty-state">
                <strong>还没有绑定司机</strong>
                <span>绑定后才能用这辆车创建趟次。</span>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="review-panel">
          <h2>编辑车辆</h2>
          <form action={updateVehicleAction} className="form-panel">
            <input type="hidden" name="vehicleId" value={vehicle.id} />
            <label>
              车牌号
              <input name="plateNumber" defaultValue={vehicle.plateNumber} required />
            </label>
            <label>
              车型
              <input name="vehicleType" defaultValue={vehicle.vehicleType ?? ""} />
            </label>
            <label>
              状态
              <select name="status" defaultValue={vehicle.status}>
                <option value="available">可用</option>
                <option value="maintenance">维修中</option>
                <option value="disabled">停用</option>
              </select>
            </label>
            <label>
              备注
              <textarea name="note" defaultValue={vehicle.note ?? ""} />
            </label>
            <button className="primary-button" type="submit">
              保存车辆
            </button>
          </form>

          <h2>绑定司机</h2>
          <div className="review-note">只列出在职且尚未绑定到该车辆的司机。</div>
          <form action={bindDriverAction} className="form-panel">
            <input type="hidden" name="vehicleId" value={vehicle.id} />
            <label>
              司机
              <select name="driverId" required defaultValue="">
                <option value="" disabled>
                  选择司机
                </option>
                {availableDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} · {driver.phone}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary-button"
              disabled={availableDrivers.length === 0}
              type="submit"
            >
              <Link2 size={16} />
              绑定司机
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
        <div>
          <span>最近维修费用</span>
          <strong>{formatMoney(maintenanceTotal.toFixed(2))}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>维修费用记录</h2>
            <p>这里显示最近 5 条。完整台账可进入车辆管理下的维修记录。</p>
          </div>
          <Link className="text-button" href={`/vehicles/maintenance?vehicleId=${vehicle.id}`}>
            查看全部 {maintenanceRecordTotal} 条
          </Link>
        </div>
        <form action={createMaintenanceAction} className="form-panel maintenance-entry-form">
          <input type="hidden" name="vehicleId" value={vehicle.id} />
          <label>
            维修部件 / 项目
            <input name="component" placeholder="如：轮胎更换、刹车保养" required />
          </label>
          <label>
            金额
            <input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
          </label>
          <label>
            维修日期
            <input name="occurredAt" type="date" required />
          </label>
          <label>
            凭证（可选）
            <input name="voucherStorageKey" placeholder="票据编号、图片路径或备注编号" />
          </label>
          <label>
            说明（可选）
            <textarea name="note" placeholder="维修原因、供应商、里程数等" />
          </label>
          <button className="primary-button" type="submit">
            <Wrench size={16} />
            保存维修费用
          </button>
        </form>
        {maintenanceRecords.length > 0 ? (
          <div className="data-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>维修项目</th>
                  <th>金额</th>
                  <th>日期</th>
                  <th>凭证</th>
                  <th>录入人</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.component}</strong>
                    </td>
                    <td>{formatMoney(record.amount)}</td>
                    <td>{formatDateTime(record.occurredAt)}</td>
                    <td>{record.voucherStorageKey || "-"}</td>
                    <td>{record.creator.name}</td>
                    <td>{record.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <strong>暂无维修费用</strong>
            <span>录入维修项目后，会在这里形成车辆维修台账。</span>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>关联小票</h2>
            <p>只显示当前车辆参与的趟次账单。</p>
          </div>
          <span className="panel-kicker">{trips.length} 单</span>
        </div>
        {trips.length > 0 ? (
          <TripTable trips={trips} />
        ) : (
          <div className="empty-state">
            <strong>暂无关联小票</strong>
            <span>创建趟次并分配到该车辆后会显示在这里。</span>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
