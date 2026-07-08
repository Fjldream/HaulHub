import { Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { TripTable } from "@/components/admin/trip-table";
import { apiGet, type ApiTrip, type ApiVehicle } from "@/lib/api-client";

export const dynamic = "force-dynamic";

function toParamList(value?: string | string[]) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter(Boolean);
}

function withoutVehicleFilters(params: { q?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.status && params.status !== "all") query.set("status", params.status);
  const queryString = query.toString();
  return queryString ? `/trips?${queryString}` : "/trips";
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; vehicleId?: string | string[] }>;
}) {
  const params = await searchParams;
  const selectedVehicleIds = toParamList(params.vehicleId);
  const selectedVehicleIdSet = new Set(selectedVehicleIds);
  const query = new URLSearchParams();
  if (params.q?.trim()) {
    query.set("q", params.q.trim());
  }
  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }
  for (const vehicleId of selectedVehicleIds) {
    query.append("vehicleId", vehicleId);
  }

  const [{ trips }, { vehicles }] = await Promise.all([
    apiGet<{ trips: ApiTrip[] }>(`/admin/trips${query.size > 0 ? `?${query.toString()}` : ""}`),
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
  ]);
  const submittedCount = trips.filter((trip) => trip.status === "submitted").length;
  const reviewCount = trips.filter((trip) => trip.status === "under_review").length;
  const completedCount = trips.filter((trip) => trip.status === "completed").length;
  const cancelledCount = trips.filter((trip) => trip.status === "cancelled").length;
  const selectedVehicles = vehicles.filter((vehicle) => selectedVehicleIdSet.has(vehicle.id));
  const vehicleFilterText =
    selectedVehicles.length === 0
      ? "全部车辆"
      : selectedVehicles.length === 1
        ? selectedVehicles[0].plateNumber
        : `已选 ${selectedVehicles.length} 辆`;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>趟次管理</h1>
          <p>筛选、创建和进入趟次小票审核。</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/trips/ai-intake">
            AI识别补录
          </Link>
          <Link className="secondary-button" href="/trips/manual-completed/new">
            补录完成账单
          </Link>
          <Link className="primary-button" href="/trips/new">
            <Plus size={16} />
            创建趟次
          </Link>
        </div>
      </section>

      <section className="stat-strip">
        <div>
          <span>待审核</span>
          <strong>{submittedCount}</strong>
        </div>
        <div>
          <span>审核中</span>
          <strong>{reviewCount}</strong>
        </div>
        <div>
          <span>已完成</span>
          <strong>{completedCount}</strong>
        </div>
        <div>
          <span>已撤销</span>
          <strong>{cancelledCount}</strong>
        </div>
      </section>

      <form className="table-toolbar">
        <label className="toolbar-search">
          <Search size={16} />
          <input name="q" placeholder="搜索趟次编号、车牌、司机" defaultValue={params.q ?? ""} />
        </label>
        <div className="toolbar-group">
          <select name="status" defaultValue={params.status ?? "all"}>
            <option value="all">全部状态</option>
            <option value="assigned">待出车</option>
            <option value="in_progress">进行中</option>
            <option value="submitted">已提交</option>
            <option value="under_review">审核中</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已撤销</option>
          </select>
          <details className="multi-select-filter">
            <summary>
              <span>车辆</span>
              <strong>{vehicleFilterText}</strong>
            </summary>
            <div className="multi-select-menu">
              <Link className={selectedVehicleIds.length === 0 ? "active" : ""} href={withoutVehicleFilters(params)}>
                全部车辆
              </Link>
              {vehicles.map((vehicle) => (
                <label key={vehicle.id}>
                  <input
                    type="checkbox"
                    name="vehicleId"
                    value={vehicle.id}
                    defaultChecked={selectedVehicleIdSet.has(vehicle.id)}
                  />
                  <span>{vehicle.plateNumber}</span>
                </label>
              ))}
            </div>
          </details>
          <input type="date" />
          <button className="secondary-button" type="submit">
            <Filter size={16} />
            应用筛选
          </button>
        </div>
      </form>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>趟次小票</h2>
            <p>按创建时间排序，优先处理已提交和审核中的账单。</p>
          </div>
          <span className="panel-kicker">{trips.length} 单</span>
        </div>
        <TripTable trips={trips} />
      </section>
    </AdminShell>
  );
}
