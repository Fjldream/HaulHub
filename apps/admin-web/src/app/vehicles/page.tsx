import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search,
  Truck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { apiGet, type ApiVehicle } from "@/lib/api-client";

export const dynamic = "force-dynamic";

const promoImage =
  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1400&q=80";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function isMaintenanceUrgent(vehicle: ApiVehicle) {
  if (!vehicle.maintenanceDueAt) return false;
  const due = new Date(vehicle.maintenanceDueAt).getTime();
  const days = Math.ceil((due - Date.now()) / 86_400_000);
  return days <= 7;
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.q?.trim()) {
    query.set("q", params.q.trim());
  }

  const { vehicles: allVehicles } = await apiGet<{ vehicles: ApiVehicle[] }>(
    `/admin/vehicles${query.size > 0 ? `?${query.toString()}` : ""}`,
  );

  const selectedStatus = params.status ?? "all";
  const vehicles =
    selectedStatus === "all"
      ? allVehicles
      : allVehicles.filter((vehicle) => (vehicle.operationalStatus ?? vehicle.status) === selectedStatus);

  const idleCount = allVehicles.filter((vehicle) => vehicle.operationalStatus === "idle").length;
  const transportingCount = allVehicles.filter(
    (vehicle) => vehicle.operationalStatus === "transporting",
  ).length;
  const maintenanceCount = allVehicles.filter(
    (vehicle) => vehicle.operationalStatus === "maintenance",
  ).length;
  const urgentVehicles = allVehicles.filter(isMaintenanceUrgent).slice(0, 3);
  const monthlyAddedCount = allVehicles.filter((vehicle) => {
    const createdAt = vehicle.registeredAt ? new Date(vehicle.registeredAt) : null;
    if (!createdAt) return false;
    const now = new Date();
    return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
  }).length;

  return (
    <AdminShell>
      <section className="vehicle-list-head">
        <div>
          <h1>车辆管理</h1>
          <p>维护车辆档案、运输状态、维保时间和绑定司机。</p>
        </div>
        <form className="vehicle-search">
          <Search size={18} />
          <input
            name="q"
            placeholder="搜索车牌号、品牌、型号或所属司机..."
            defaultValue={params.q ?? ""}
          />
        </form>
        <Link className="primary-button" href="/vehicles/new">
          <Plus size={16} />
          新增车辆
        </Link>
      </section>

      <section className="vehicle-toolbar-grid">
        <form className="vehicle-filter-panel">
          <input type="hidden" name="q" value={params.q ?? ""} />
          <div className="vehicle-tabs">
            {[
              ["all", `全部 (${allVehicles.length})`],
              ["idle", `空闲中 (${idleCount})`],
              ["transporting", `运输中 (${transportingCount})`],
              ["maintenance", `维修中 (${maintenanceCount})`],
            ].map(([value, label]) => (
              <button
                className={selectedStatus === value ? "active" : ""}
                key={value}
                name="status"
                type="submit"
                value={value}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="vehicle-filter-actions">
            <button className="secondary-button" type="button">
              所有车辆品牌
            </button>
            <button className="secondary-button" type="submit">
              <Filter size={16} />
              高级筛选
            </button>
          </div>
        </form>

        <div className="vehicle-month-card">
          <span>本月新增车辆</span>
          <strong>{monthlyAddedCount} 台</strong>
          <small>按车辆登记日期统计</small>
          <Truck size={42} />
        </div>
      </section>

      <section className="panel vehicle-table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>车牌号</th>
                <th>车辆品牌/型号</th>
                <th>载重（吨）</th>
                <th>当前状态</th>
                <th>所属司机</th>
                <th>最近维保</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => {
                const driver = vehicle.boundDrivers?.[0];
                return (
                  <tr key={vehicle.id}>
                    <td className="strong">{vehicle.plateNumber}</td>
                    <td>
                      <div className="cell-stack">
                        <strong>{vehicle.brandModel || vehicle.vehicleType || "未填写品牌型号"}</strong>
                        <span>{vehicle.vehicleType || "-"}</span>
                      </div>
                    </td>
                    <td>{vehicle.loadCapacityTons ?? "-"}</td>
                    <td>
                      <StatusBadge status={vehicle.operationalStatus ?? vehicle.status} />
                    </td>
                    <td>
                      {driver ? (
                        <div className="driver-chip">
                          <span>{driver.name.slice(0, 1)}</span>
                          <strong>{driver.name}</strong>
                        </div>
                      ) : (
                        "未指派"
                      )}
                    </td>
                    <td>{formatDate(vehicle.maintenanceDueAt)}</td>
                    <td>
                      <div className="table-actions">
                        <Link className="text-button" href={`/vehicles/${vehicle.id}`}>
                          详情
                        </Link>
                        <Link className="text-button" href={`/vehicles/${vehicle.id}`}>
                          编辑
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pagination-bar">
          <span>
            显示 1 到 {vehicles.length} 条，共 {vehicles.length} 条数据
          </span>
          <div className="button-row">
            <button className="icon-button" disabled type="button">
              <ChevronLeft size={16} />
            </button>
            <button className="primary-button" type="button">
              1
            </button>
            <button className="icon-button" disabled type="button">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className="vehicle-lower-grid">
        <div className="panel maintenance-alert-panel">
          <div className="panel-header">
            <div>
              <h2>待维保提醒</h2>
              <p>按车辆编辑中的下次维保时间计算。</p>
            </div>
            <span className="status danger">{urgentVehicles.length} 台紧急</span>
          </div>
          <div className="maintenance-alert-list">
            {urgentVehicles.length > 0 ? (
              urgentVehicles.map((vehicle) => (
                <div className="maintenance-alert-row" key={vehicle.id}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>{vehicle.plateNumber}</strong>
                    <span>下次维保：{formatDate(vehicle.maintenanceDueAt)}</span>
                  </div>
                  <Link className="secondary-button" href={`/vehicles/${vehicle.id}`}>
                    立即处理
                  </Link>
                </div>
              ))
            ) : (
              <div className="maintenance-alert-row calm">
                <CalendarClock size={18} />
                <div>
                  <strong>暂无临近维保车辆</strong>
                  <span>录入下次维保时间后，这里会自动提醒。</span>
                </div>
                <Link className="secondary-button" href="/vehicles/maintenance">
                  维修记录
                </Link>
              </div>
            )}
          </div>
        </div>

        <article className="vehicle-promo-card">
          <img alt="" src={promoImage} />
          <div>
            <Wrench size={26} />
            <h2>数字化车队管理</h2>
            <p>通过车辆档案、运输状态和维保提醒，减少停运时间，让每一辆车都保持最佳运营状态。</p>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
