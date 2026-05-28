import { Edit3, Plus, Search, SlidersHorizontal, Wrench } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { apiGet, type ApiVehicle } from "@/lib/api-client";

export const dynamic = "force-dynamic";

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
  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }
  const { vehicles } = await apiGet<{ vehicles: ApiVehicle[] }>(
    `/admin/vehicles${query.size > 0 ? `?${query.toString()}` : ""}`,
  );
  const availableCount = vehicles.filter((vehicle) => vehicle.status === "available").length;
  const maintenanceCount = vehicles.filter((vehicle) => vehicle.status === "maintenance").length;
  const disabledCount = vehicles.filter((vehicle) => vehicle.status === "disabled").length;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>车辆管理</h1>
          <p>维护车牌、状态和可分配司机。</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/vehicles/maintenance">
            <Wrench size={16} />
            维修记录
          </Link>
          <Link className="primary-button" href="/vehicles/new">
            <Plus size={16} />
            新增车辆
          </Link>
        </div>
      </section>
      <section className="stat-strip">
        <div>
          <span>可用车辆</span>
          <strong>{availableCount}</strong>
        </div>
        <div>
          <span>维修中</span>
          <strong>{maintenanceCount}</strong>
        </div>
        <div>
          <span>已停用</span>
          <strong>{disabledCount}</strong>
        </div>
      </section>
      <form className="table-toolbar">
        <label className="toolbar-search">
          <Search size={16} />
          <input name="q" placeholder="搜索车牌号、车型" defaultValue={params.q ?? ""} />
        </label>
        <div className="toolbar-group">
          <select name="status" defaultValue={params.status ?? "all"}>
            <option value="all">全部状态</option>
            <option value="available">可用</option>
            <option value="maintenance">维修中</option>
            <option value="disabled">停用</option>
          </select>
          <button className="secondary-button" type="submit">
            <SlidersHorizontal size={16} />
            筛选
          </button>
        </div>
      </form>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>车辆列表</h2>
            <p>维修中或停用车辆不能创建新趟次。</p>
          </div>
          <span className="panel-kicker">{vehicles.length} 辆</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>车牌号</th>
                <th>状态</th>
                <th>车型</th>
                <th>绑定司机</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td className="strong">{vehicle.plateNumber}</td>
                  <td>
                    <StatusBadge status={vehicle.status} />
                  </td>
                  <td>{vehicle.vehicleType ?? "-"}</td>
                  <td>{vehicle.boundDrivers?.length ?? 0} 人</td>
                  <td>
                    <div className="table-actions">
                      <Link
                        className="icon-link"
                        href={`/vehicles/${vehicle.id}`}
                        title="查看车辆"
                      >
                        <Edit3 size={15} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
