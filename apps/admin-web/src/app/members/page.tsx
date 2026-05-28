import { Edit3, Save, ShieldCheck, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiGet, apiPost, formatDateTime, type ApiAdminMember, type ApiTeam } from "@/lib/api-client";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

async function createMemberAction(formData: FormData) {
  "use server";
  await apiPost("/admin/members", {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "accountant"),
    teamId: String(formData.get("teamId") ?? ""),
  });
  redirect("/members");
}

async function updateMemberStatusAction(formData: FormData) {
  "use server";
  const memberId = String(formData.get("memberId") ?? "");
  const status = String(formData.get("status") ?? "");
  await apiPost(`/admin/members/${memberId}/status`, { status });
  redirect("/members");
}

async function updateMemberAction(formData: FormData) {
  "use server";
  const memberId = String(formData.get("memberId") ?? "");
  await apiPost(`/admin/members/${memberId}`, {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    role: String(formData.get("role") ?? "accountant"),
    status: String(formData.get("status") ?? "active"),
    teamId: String(formData.get("teamId") ?? ""),
  });
  redirect("/members");
}

function roleLabel(role: ApiAdminMember["role"]) {
  return role === "administrator" ? "超级管理员" : "管理员";
}

function statusLabel(status: string) {
  return status === "active" ? "启用" : "停用";
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await getAdminSession();
  if (session?.role !== "administrator") {
    redirect("/");
  }

  const params = await searchParams;
  const [{ members }, { teams }] = await Promise.all([
    apiGet<{ members: ApiAdminMember[] }>("/admin/members"),
    apiGet<{ teams: ApiTeam[] }>("/admin/teams"),
  ]);
  const activeCount = members.filter((member) => member.status === "active").length;
  const disabledCount = members.filter((member) => member.status === "disabled").length;
  const editingMember = params.edit
    ? members.find((member) => member.id === params.edit)
    : undefined;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>成员管理</h1>
          <p>只有超级管理员可以创建、启用或停用后台登录成员。</p>
        </div>
      </section>
      <section className="stat-strip">
        <div>
          <span>启用成员</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>停用成员</span>
          <strong>{disabledCount}</strong>
        </div>
      </section>
      <section className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>后台成员</h2>
              <p>超级管理员负责团队和成员，管理员负责对应团队的日常业务。</p>
            </div>
          </div>
          <div className="data-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>手机号</th>
                  <th>角色</th>
                  <th>团队</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.name}</strong>
                    </td>
                    <td>{member.phone}</td>
                    <td>{roleLabel(member.role)}</td>
                    <td>{member.teamName ?? "平台"}</td>
                    <td>{statusLabel(member.status)}</td>
                    <td>{formatDateTime(member.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <Link className="icon-link" href={`/members?edit=${member.id}`} title="编辑成员">
                          <Edit3 size={15} />
                        </Link>
                        {member.id === session.userId ? (
                          <span className="muted-text">当前账号</span>
                        ) : (
                        <form action={updateMemberStatusAction}>
                          <input name="memberId" type="hidden" value={member.id} />
                          <input
                            name="status"
                            type="hidden"
                            value={member.status === "active" ? "disabled" : "active"}
                          />
                          <button
                            className={member.status === "active" ? "text-button danger-text" : "text-button"}
                            type="submit"
                          >
                            {member.status === "active" ? "停用" : "启用"}
                          </button>
                        </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="review-panel">
          <div className="review-note">
            <ShieldCheck size={18} />
            新成员首次登录后可以继续使用初始密码，后续再扩展强制改密。
          </div>
          <form action={createMemberAction} className="form-panel">
            <label>
              姓名
              <input name="name" placeholder="例如：管理员小陈" required />
            </label>
            <label>
              手机号
              <input name="phone" inputMode="tel" placeholder="例如：13800000009" required />
            </label>
            <label>
              初始密码
              <input name="password" minLength={6} placeholder="至少 6 位" required />
            </label>
            <label>
              角色
              <select name="role" defaultValue="accountant">
                <option value="accountant">管理员</option>
                <option value="administrator">超级管理员</option>
              </select>
            </label>
            <label>
              所属团队
              <select name="teamId" defaultValue={teams[0]?.id ?? ""}>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              <UserPlus size={16} />
              创建成员
            </button>
          </form>
        </aside>
      </section>
      {editingMember ? (
        <div className="modal-backdrop">
          <section className="modal-card">
            <div className="modal-header">
              <div>
                <h2>编辑成员</h2>
                <p>修改成员信息后，会立即影响后台登录和团队权限。</p>
              </div>
              <Link className="icon-button" aria-label="关闭" href="/members">
                <X size={18} />
              </Link>
            </div>
            <form action={updateMemberAction} className="form-panel">
              <input type="hidden" name="memberId" value={editingMember.id} />
              <label>
                姓名
                <input name="name" defaultValue={editingMember.name} required />
              </label>
              <label>
                手机号
                <input name="phone" inputMode="tel" defaultValue={editingMember.phone} required />
              </label>
              <label>
                角色
                <select name="role" defaultValue={editingMember.role}>
                  <option value="accountant">管理员</option>
                  <option value="administrator">超级管理员</option>
                </select>
              </label>
              <label>
                所属团队
                <select name="teamId" defaultValue={editingMember.teamId ?? teams[0]?.id ?? ""}>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                状态
                <select name="status" defaultValue={editingMember.status}>
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </label>
              <div className="form-actions">
                <Link className="secondary-button" href="/members">
                  取消
                </Link>
                <button className="primary-button" type="submit">
                  <Save size={16} />
                  保存成员
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
