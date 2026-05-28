import { ArrowLeft, KeyRound, Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { TripTable } from "@/components/admin/trip-table";
import { redirectWithActionError } from "@/lib/action-errors";
import { apiGet, apiPost, type ApiDriver, type ApiTrip, type ApiVehicle } from "@/lib/api-client";

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

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>;
}) {
  const { driverId } = await params;
  const [{ driver }, { vehicles }, { trips }] = await Promise.all([
    apiGet<{ driver: ApiDriver }>(`/admin/drivers/${driverId}`),
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    apiGet<{ trips: ApiTrip[] }>(`/admin/trips?driverId=${driverId}`),
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
    </AdminShell>
  );
}
