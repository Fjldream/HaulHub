import { Edit3, KeyRound, Plus, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { redirectWithActionError } from "@/lib/action-errors";
import { apiGet, apiPost, type ApiDriver } from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function updateDriverStatusAction(formData: FormData) {
  "use server";
  const driverId = String(formData.get("driverId") || "");
  try {
    await apiPost(`/admin/drivers/${driverId}`, {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      status: String(formData.get("status") || "active"),
    });
  } catch (error) {
    redirectWithActionError("/drivers", error);
  }
  revalidatePath("/drivers");
  redirect("/drivers");
}

async function resetDriverPasswordAction(formData: FormData) {
  "use server";
  const driverId = String(formData.get("driverId") || "");
  try {
    await apiPost(`/admin/drivers/${driverId}/password`, {
      password: String(formData.get("password") || "123456"),
    });
  } catch (error) {
    redirectWithActionError("/drivers", error);
  }
  revalidatePath("/drivers");
  redirect("/drivers");
}

export default async function DriversPage({
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
  const { drivers } = await apiGet<{ drivers: ApiDriver[] }>(
    `/admin/drivers${query.size > 0 ? `?${query.toString()}` : ""}`,
  );
  const activeCount = drivers.filter((driver) => driver.status === "active").length;
  const disabledCount = drivers.filter((driver) => driver.status === "disabled").length;
  const firstLoginCount = drivers.filter((driver) => driver.isFirstLogin).length;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>司机管理</h1>
          <p>维护司机账号、状态和车辆绑定。</p>
        </div>
        <Link className="primary-button" href="/drivers/new">
          <Plus size={16} />
          新增司机
        </Link>
      </section>
      <section className="stat-strip">
        <div>
          <span>在职司机</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>停用司机</span>
          <strong>{disabledCount}</strong>
        </div>
        <div>
          <span>需首次改密</span>
          <strong>{firstLoginCount}</strong>
        </div>
      </section>
      <form className="table-toolbar">
        <label className="toolbar-search">
          <Search size={16} />
          <input name="q" placeholder="搜索司机姓名、手机号" defaultValue={params.q ?? ""} />
        </label>
        <div className="toolbar-group">
          <select name="status" defaultValue={params.status ?? "all"}>
            <option value="all">全部状态</option>
            <option value="active">在职</option>
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
            <h2>司机列表</h2>
            <p>停用司机不能分配到新趟次。</p>
          </div>
          <span className="panel-kicker">{drivers.length} 人</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>手机号</th>
                <th>状态</th>
                <th>可驾驶车辆</th>
                <th>账号安全</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="strong">{driver.name}</td>
                  <td>{driver.phone}</td>
                  <td>
                    <StatusBadge status={driver.status} />
                  </td>
                  <td>{driver.boundVehicles?.length ?? 0} 辆</td>
                  <td>
                    <span className="receipt-cell">
                      <ShieldCheck size={15} />
                      {driver.isFirstLogin ? "需改密" : "正常"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <form action={updateDriverStatusAction}>
                        <input name="driverId" type="hidden" value={driver.id} />
                        <input name="name" type="hidden" value={driver.name} />
                        <input name="phone" type="hidden" value={driver.phone} />
                        <input
                          name="status"
                          type="hidden"
                          value={driver.status === "active" ? "disabled" : "active"}
                        />
                        <button
                          className={driver.status === "active" ? "text-button danger-text" : "text-button"}
                          type="submit"
                        >
                          {driver.status === "active" ? "停用" : "启用"}
                        </button>
                      </form>
                      <form action={resetDriverPasswordAction}>
                        <input name="driverId" type="hidden" value={driver.id} />
                        <input name="password" type="hidden" value="123456" />
                        <button className="icon-link" title="重置密码为 123456" type="submit">
                          <KeyRound size={15} />
                        </button>
                      </form>
                      <Link
                        className="icon-link"
                        href={`/drivers/${driver.id}`}
                        title="查看司机"
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
