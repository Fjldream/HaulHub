import {
  ArrowLeft,
  CalendarClock,
  FileText,
  Link2,
  MapPin,
  PenLine,
  Route,
  ShieldCheck,
  TrendingUp,
  Truck,
  Unlink,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  apiGet,
  apiPost,
  apiUploadFile,
  formatMoney,
  type ApiDriver,
  type ApiTrip,
  type ApiVehicle,
  type ApiVehicleMaintenanceList,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

const truckPlaceholder =
  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80";

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
  const imageFile = formData.get("imageFile");
  const uploadedImage =
    imageFile instanceof File && imageFile.size > 0 ? await apiUploadFile(imageFile) : null;

  await apiPost(`/admin/vehicles/${vehicleId}`, {
    plateNumber: String(formData.get("plateNumber") || ""),
    brandModel: String(formData.get("brandModel") || ""),
    vehicleType: String(formData.get("vehicleType") || ""),
    loadCapacityTons: String(formData.get("loadCapacityTons") || ""),
    registeredAt: String(formData.get("registeredAt") || ""),
    insuranceExpiresAt: String(formData.get("insuranceExpiresAt") || ""),
    inspectionExpiresAt: String(formData.get("inspectionExpiresAt") || ""),
    maintenanceDueAt: String(formData.get("maintenanceDueAt") || ""),
    imageUrl: uploadedImage?.url ?? String(formData.get("currentImageUrl") || ""),
    note: String(formData.get("note") || ""),
    status: String(formData.get("status") || "available"),
  });
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/vehicles");
  redirect(`/vehicles/${vehicleId}`);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function tripDate(trip: ApiTrip) {
  return trip.completedAt ?? trip.submittedAt ?? trip.createdAt;
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
  const now = new Date();
  const monthTripCount = trips.filter((trip) => {
    const createdAt = new Date(trip.createdAt);
    return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
  }).length;
  const completedTripCount = trips.filter((trip) => trip.status === "completed").length;
  const activeTripCount = trips.filter((trip) => trip.status !== "completed").length;
  const maintenanceTotal = maintenanceRecords.reduce(
    (total, record) => total + Number(record.amount),
    0,
  );
  const profitTotal = trips.reduce((total, trip) => total + Number(trip.profit ?? 0), 0);
  const timeline = [
    ...trips.slice(0, 5).map((trip) => ({
      id: `trip-${trip.id}`,
      type: "trip" as const,
      href: `/trips/${trip.id}`,
      date: tripDate(trip),
      title: `运单：${trip.tripNo}`,
      subtitle: `${trip.loadLocation} -> ${trip.unloadLocation}`,
      amount: trip.profit ? `利润 ${formatMoney(trip.profit)}` : "待核算",
      status: trip.status,
    })),
    ...maintenanceRecords.slice(0, 5).map((record) => ({
      id: `maintenance-${record.id}`,
      type: "maintenance" as const,
      href: `/vehicles/maintenance/${record.id}`,
      date: record.occurredAt,
      title: `例行维保：${record.component}`,
      subtitle: record.note || "无备注",
      amount: `费用 ${formatMoney(record.amount)}`,
      status: "maintenance",
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  return (
    <AdminShell>
      <section className="vehicle-profile-heading">
        <div>
          <div className="breadcrumb">车辆管理 / 车辆详情</div>
          <h1>
            {vehicle.plateNumber}
            <StatusBadge status={vehicle.operationalStatus ?? vehicle.status} />
          </h1>
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/vehicles">
            <ArrowLeft size={16} />
            返回列表
          </Link>
          <a className="secondary-button" href="#vehicle-edit">
            <PenLine size={16} />
            编辑档案
          </a>
        </div>
      </section>

      <section className="vehicle-metric-grid">
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-icon">
              <Route size={18} />
            </span>
          </div>
          <span>本月出车次数</span>
          <strong>{monthTripCount} 次</strong>
        </div>
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-icon danger-soft">
              <Wrench size={18} />
            </span>
          </div>
          <span>累计维修费用</span>
          <strong>{formatMoney(maintenanceTotal.toFixed(2))}</strong>
        </div>
        <div className="metric-card dark">
          <div className="metric-card-top">
            <span className="metric-icon">
              <TrendingUp size={18} />
            </span>
          </div>
          <span>累计利润贡献</span>
          <strong>{formatMoney(profitTotal.toFixed(2))}</strong>
        </div>
      </section>

      <section className="vehicle-profile-grid">
        <div className="vehicle-profile-left">
          <article className="vehicle-archive-card">
            <div className="vehicle-photo">
              <img alt="" src={vehicle.imageUrl || truckPlaceholder} />
              <strong>{vehicle.brandModel || vehicle.vehicleType || "车辆档案"}</strong>
            </div>
            <div className="archive-body">
              <h2>
                <FileText size={18} />
                核心档案信息
              </h2>
              <dl className="archive-grid">
                <div>
                  <dt>品牌型号</dt>
                  <dd>{vehicle.brandModel || "-"}</dd>
                </div>
                <div>
                  <dt>车辆类型</dt>
                  <dd>{vehicle.vehicleType || "-"}</dd>
                </div>
                <div>
                  <dt>核定载重</dt>
                  <dd>{vehicle.loadCapacityTons ? `${vehicle.loadCapacityTons} 吨` : "-"}</dd>
                </div>
                <div>
                  <dt>初次登记日期</dt>
                  <dd>{formatDate(vehicle.registeredAt)}</dd>
                </div>
                <div>
                  <dt>保险到期日</dt>
                  <dd>{formatDate(vehicle.insuranceExpiresAt)}</dd>
                </div>
                <div>
                  <dt>年检到期日</dt>
                  <dd>{formatDate(vehicle.inspectionExpiresAt)}</dd>
                </div>
                <div>
                  <dt>下次维保日</dt>
                  <dd>{formatDate(vehicle.maintenanceDueAt)}</dd>
                </div>
                <div>
                  <dt>当前驾驶员</dt>
                  <dd>{boundDrivers.map((driver) => driver.name).join("、") || "未指派"}</dd>
                </div>
              </dl>
            </div>
          </article>

          <article className="vehicle-health-card">
            <div>
              <h2>
                <ShieldCheck size={18} />
                运营状态
              </h2>
              <span>根据小票和维保档案自动汇总</span>
            </div>
            <div className="health-bars">
              <label>
                <span>未完成小票</span>
                <strong>{activeTripCount}</strong>
                <i style={{ width: `${Math.min(activeTripCount * 18, 100)}%` }} />
              </label>
              <label>
                <span>已完成小票</span>
                <strong>{completedTripCount}</strong>
                <i style={{ width: `${Math.min(completedTripCount * 18, 100)}%` }} />
              </label>
            </div>
          </article>
        </div>

        <aside className="vehicle-timeline-card">
          <div className="panel-header">
            <div>
              <h2>历史任务轨迹</h2>
              <p>最近小票与维修记录按时间合并展示。</p>
            </div>
          </div>
          <div className="vehicle-timeline">
            {timeline.length > 0 ? (
              timeline.map((item) => (
                <div className={item.type === "maintenance" ? "warn" : ""} key={item.id}>
                  <span className="timeline-icon">
                    {item.type === "maintenance" ? <Wrench size={15} /> : <Truck size={15} />}
                  </span>
                  <Link href={item.href}>
                    <header>
                      <strong>{item.title}</strong>
                      <StatusBadge status={item.status} />
                    </header>
                    <p>
                      <MapPin size={14} />
                      {item.subtitle}
                    </p>
                    <footer>
                      <span>{item.amount}</span>
                      <time>{formatDate(item.date)}</time>
                    </footer>
                  </Link>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <strong>暂无历史轨迹</strong>
                <span>车辆产生小票或维修记录后会在这里展示。</span>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="vehicle-admin-grid">
        <section className="panel" id="vehicle-edit">
          <div className="panel-header">
            <div>
              <h2>编辑车辆档案</h2>
              <p>这里维护车辆基础资料、证件到期和下次维保时间。</p>
            </div>
          </div>
          <form action={updateVehicleAction} className="vehicle-inline-form">
            <input type="hidden" name="vehicleId" value={vehicle.id} />
            <label>
              车牌号
              <input name="plateNumber" defaultValue={vehicle.plateNumber} required />
            </label>
            <label>
              品牌型号
              <input name="brandModel" defaultValue={vehicle.brandModel ?? ""} />
            </label>
            <label>
              车辆类型
              <input name="vehicleType" defaultValue={vehicle.vehicleType ?? ""} />
            </label>
            <label>
              载重（吨）
              <input
                name="loadCapacityTons"
                type="number"
                min="0"
                step="0.1"
                defaultValue={vehicle.loadCapacityTons ?? ""}
              />
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
              初次登记日期
              <input name="registeredAt" type="date" defaultValue={dateInputValue(vehicle.registeredAt)} />
            </label>
            <label>
              保险到期时间
              <input
                name="insuranceExpiresAt"
                type="date"
                defaultValue={dateInputValue(vehicle.insuranceExpiresAt)}
              />
            </label>
            <label>
              年检到期时间
              <input
                name="inspectionExpiresAt"
                type="date"
                defaultValue={dateInputValue(vehicle.inspectionExpiresAt)}
              />
            </label>
            <label>
              下次维保时间
              <input name="maintenanceDueAt" type="date" defaultValue={dateInputValue(vehicle.maintenanceDueAt)} />
            </label>
            <label>
              车辆图片
              <input type="hidden" name="currentImageUrl" value={vehicle.imageUrl ?? ""} />
              <input name="imageFile" type="file" accept="image/*" />
            </label>
            <label className="span-2">
              备注
              <textarea name="note" defaultValue={vehicle.note ?? ""} />
            </label>
            <button className="primary-button" type="submit">
              保存档案
            </button>
          </form>
        </section>

        <aside className="panel vehicle-driver-panel">
          <div className="panel-header">
            <div>
              <h2>绑定司机</h2>
              <p>只有已绑定司机才能被分配到该车辆的新小票。</p>
            </div>
          </div>
          <div className="bound-driver-list">
            {boundDrivers.map((driver) => (
              <form action={unbindDriverAction} key={driver.id}>
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <input type="hidden" name="driverId" value={driver.id} />
                <div>
                  <strong>{driver.name}</strong>
                  <span>{driver.phone}</span>
                </div>
                <button className="text-button" type="submit">
                  <Unlink size={15} />
                  解绑
                </button>
              </form>
            ))}
            {boundDrivers.length === 0 ? <p className="muted-text">暂未绑定司机。</p> : null}
          </div>
          <form action={bindDriverAction} className="bind-driver-form">
            <input type="hidden" name="vehicleId" value={vehicle.id} />
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
            <button className="primary-button" disabled={availableDrivers.length === 0} type="submit">
              <Link2 size={16} />
              绑定司机
            </button>
          </form>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>维修费用记录</h2>
            <p>这里显示最近 5 条。完整台账可进入维修记录页面。</p>
          </div>
          <Link className="text-button" href={`/vehicles/maintenance?vehicleId=${vehicle.id}`}>
            查看全部 {maintenanceRecordTotal} 条
          </Link>
        </div>
        {maintenanceRecords.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>维修项目</th>
                  <th>金额</th>
                  <th>日期</th>
                  <th>凭证</th>
                  <th>录入人</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="strong">{record.component}</td>
                    <td>{formatMoney(record.amount)}</td>
                    <td>{formatDate(record.occurredAt)}</td>
                    <td>{record.voucherStorageKey || "-"}</td>
                    <td>{record.creator.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <strong>暂无维修费用</strong>
            <span>录入维修记录后会在这里形成车辆维修台账。</span>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
