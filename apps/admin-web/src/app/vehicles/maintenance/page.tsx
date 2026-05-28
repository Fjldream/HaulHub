import { CalendarDays, Search, SlidersHorizontal, Trash2, Wrench } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  apiDelete,
  apiGet,
  formatDateTime,
  formatMoney,
  type ApiVehicle,
  type ApiVehicleMaintenanceList,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function deleteMaintenanceAction(formData: FormData) {
  "use server";
  const recordId = String(formData.get("recordId") || "");
  const returnTo = String(formData.get("returnTo") || "/vehicles/maintenance");
  await apiDelete(`/admin/vehicle-maintenance/${recordId}`);
  revalidatePath("/vehicles/maintenance");
  revalidatePath("/reports");
  redirect(returnTo);
}

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/vehicles/maintenance?${next.toString()}`;
}

export default async function VehicleMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    vehicleId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.vehicleId && params.vehicleId !== "all") query.set("vehicleId", params.vehicleId);
  if (params.from?.trim()) query.set("from", params.from.trim());
  if (params.to?.trim()) query.set("to", params.to.trim());
  query.set("page", String(page));
  query.set("pageSize", "12");

  const [{ vehicles }, maintenance] = await Promise.all([
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    apiGet<ApiVehicleMaintenanceList>(`/admin/vehicle-maintenance?${query.toString()}`),
  ]);
  const filterParams = new URLSearchParams(query);
  filterParams.delete("pageSize");
  const totalAmount = maintenance.records.reduce(
    (total, record) => total + Number(record.amount),
    0,
  );
  const returnTo = `/vehicles/maintenance?${filterParams.toString()}`;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>维修记录</h1>
          <p>车辆管理下的维修台账，支持按车辆、日期、关键词筛选和分页。</p>
        </div>
      </section>

      <section className="stat-strip">
        <div>
          <span>筛选结果</span>
          <strong>{maintenance.total}</strong>
        </div>
        <div>
          <span>本页维修费用</span>
          <strong>{formatMoney(totalAmount.toFixed(2))}</strong>
        </div>
        <div>
          <span>页码</span>
          <strong>
            {maintenance.page}/{maintenance.totalPages}
          </strong>
        </div>
      </section>

      <form className="table-toolbar">
        <label className="toolbar-search">
          <Search size={16} />
          <input name="q" placeholder="搜索维修项目、车牌、凭证、备注" defaultValue={params.q ?? ""} />
        </label>
        <label className="toolbar-search">
          <CalendarDays size={16} />
          <input name="from" type="date" defaultValue={params.from ?? ""} aria-label="开始日期" />
        </label>
        <label className="toolbar-search">
          <CalendarDays size={16} />
          <input name="to" type="date" defaultValue={params.to ?? ""} aria-label="结束日期" />
        </label>
        <div className="toolbar-group">
          <select name="vehicleId" defaultValue={params.vehicleId ?? "all"} aria-label="车辆">
            <option value="all">全部车辆</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plateNumber}
              </option>
            ))}
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
            <h2>
              <Wrench size={18} />
              维修台账
            </h2>
            <p>删除记录后，利润统计中的维修支出会同步减少。</p>
          </div>
          <span className="panel-kicker">{maintenance.total} 条</span>
        </div>
        {maintenance.records.length > 0 ? (
          <>
            <div className="data-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>车辆</th>
                    <th>维修项目</th>
                    <th>金额</th>
                    <th>日期</th>
                    <th>凭证</th>
                    <th>录入人</th>
                    <th>说明</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenance.records.map((record) => (
                    <tr key={record.id}>
                      <td className="strong">{record.vehicle.plateNumber}</td>
                      <td>{record.component}</td>
                      <td>{formatMoney(record.amount)}</td>
                      <td>{formatDateTime(record.occurredAt)}</td>
                      <td>{record.voucherStorageKey || "-"}</td>
                      <td>{record.creator.name}</td>
                      <td>{record.note || "-"}</td>
                      <td>
                        <form action={deleteMaintenanceAction}>
                          <input type="hidden" name="recordId" value={record.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button className="text-button danger-text" type="submit">
                            <Trash2 size={15} />
                            删除
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-bar">
              {maintenance.page > 1 ? (
                <a className="secondary-button" href={pageHref(filterParams, maintenance.page - 1)}>
                  上一页
                </a>
              ) : (
                <span />
              )}
              <span>
                第 {maintenance.page} 页，共 {maintenance.totalPages} 页
              </span>
              {maintenance.page < maintenance.totalPages ? (
                <a className="secondary-button" href={pageHref(filterParams, maintenance.page + 1)}>
                  下一页
                </a>
              ) : (
                <span />
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>暂无维修记录</strong>
            <span>可在车辆详情页录入维修费用，随后会汇总到这里。</span>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
