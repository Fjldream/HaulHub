import { ArrowRight, Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { apiGet, type ApiTeam } from "@/lib/api-client";
import { getAdminSession, setActiveTeam } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

async function selectTeamAction(formData: FormData) {
  "use server";
  const teamId = String(formData.get("teamId") || "");
  const teamName = String(formData.get("teamName") || "");
  await setActiveTeam({ id: teamId, name: teamName });
  redirect("/");
}

export default async function SelectTeamPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "administrator" && session.activeTeamId) {
    redirect("/");
  }

  const { teams } = await apiGet<{ teams: ApiTeam[] }>("/admin/teams");
  const activeTeams = teams.filter((team) => team.status === "active");

  return (
    <main className="login-page team-select-page">
      <section className="login-panel team-select-panel">
        <div className="login-brand">
          <span>拉货小票</span>
          <strong>选择团队进入后台</strong>
        </div>
        <div className="team-select-list">
          {activeTeams.map((team) => (
            <form action={selectTeamAction} key={team.id}>
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="teamName" value={team.name} />
              <button className="team-select-card" type="submit">
                <span>
                  <Building2 size={20} />
                </span>
                <div>
                  <strong>{team.name}</strong>
                  <small>
                    {team.userCount} 成员 · {team.vehicleCount} 车辆 · {team.tripCount} 趟次
                  </small>
                </div>
                <ArrowRight size={18} />
              </button>
            </form>
          ))}
        </div>
        {activeTeams.length === 0 ? (
          <div className="empty-state compact">
            <strong>暂无可进入团队</strong>
            <span>请先创建或启用团队。</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}
