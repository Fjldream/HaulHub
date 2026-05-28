import { Plus, Users } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { redirectWithActionError } from "@/lib/action-errors";
import { apiGet, apiPost, type ApiTeam } from "@/lib/api-client";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

async function createTeamAction(formData: FormData) {
  "use server";
  try {
    await apiPost("/admin/teams", {
      name: String(formData.get("name") || ""),
      note: String(formData.get("note") || ""),
      status: String(formData.get("status") || "active"),
    });
  } catch (error) {
    redirectWithActionError("/teams", error);
  }
  revalidatePath("/teams");
  redirect("/teams");
}

export default async function TeamsPage() {
  const session = await getAdminSession();
  if (session?.role !== "administrator") {
    redirect("/");
  }

  const { teams } = await apiGet<{ teams: ApiTeam[] }>("/admin/teams");
  const activeCount = teams.filter((team) => team.status === "active").length;
  const totalVehicles = teams.reduce((total, team) => total + team.vehicleCount, 0);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>团队管理</h1>
          <p>平台超级管理员维护团队；管理员、司机、车辆和利润统计都按团队隔离。</p>
        </div>
      </section>

      <section className="stat-strip">
        <div>
          <span>团队数量</span>
          <strong>{teams.length}</strong>
        </div>
        <div>
          <span>启用团队</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>车辆总数</span>
          <strong>{totalVehicles}</strong>
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>
                <Users size={18} />
                团队列表
              </h2>
              <p>团队停用后，后续可再扩展为禁止该团队成员登录。</p>
            </div>
            <span className="panel-kicker">{teams.length} 个</span>
          </div>
          <div className="data-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>团队</th>
                  <th>状态</th>
                  <th>成员</th>
                  <th>车辆</th>
                  <th>趟次</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id}>
                    <td>
                      <strong>{team.name}</strong>
                    </td>
                    <td>
                      <StatusBadge status={team.status} />
                    </td>
                    <td>{team.userCount}</td>
                    <td>{team.vehicleCount}</td>
                    <td>{team.tripCount}</td>
                    <td>{team.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="review-panel">
          <h2>新增团队</h2>
          <form action={createTeamAction} className="form-panel">
            <label>
              团队名称
              <input name="name" placeholder="如：团队A、上海车队" required />
            </label>
            <label>
              状态
              <select name="status" defaultValue="active">
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
            </label>
            <label>
              备注
              <textarea name="note" placeholder="可填写区域、负责人或说明" />
            </label>
            <button className="primary-button" type="submit">
              <Plus size={16} />
              创建团队
            </button>
          </form>
        </aside>
      </section>
    </AdminShell>
  );
}
