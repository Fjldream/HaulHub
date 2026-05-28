import Link from "next/link";
import {
  Database,
  FileImage,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiGet, type ApiAdminMember } from "@/lib/api-client";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

function roleLabel(role: string) {
  return role === "administrator" ? "超级管理员" : "管理员";
}

function statusLabel(status: string) {
  return status === "active" ? "启用" : "停用";
}

export default async function SettingsPage() {
  const session = await getAdminSession();
  const members =
    session?.role === "administrator"
      ? (await apiGet<{ members: ApiAdminMember[] }>("/admin/members")).members
      : [];
  const activeMemberCount = members.filter((member) => member.status === "active").length;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>系统设置</h1>
          <p>集中查看后台账号、权限边界、业务规则和数据配置。</p>
        </div>
        {session?.role === "administrator" ? (
          <Link className="primary-button" href="/members">
            <UserCog size={16} />
            管理成员
          </Link>
        ) : null}
      </section>

      <section className="stat-strip">
        <div>
          <span>当前角色</span>
          <strong>{roleLabel(session?.role ?? "accountant")}</strong>
        </div>
        <div>
          <span>后台成员</span>
          <strong>{session?.role === "administrator" ? activeMemberCount : "受限"}</strong>
        </div>
        <div>
          <span>会话有效期</span>
          <strong>8 小时</strong>
        </div>
      </section>

      <section className="settings-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>账号与权限</h2>
              <p>超级管理员负责成员管理，管理员账号负责日常账单处理。</p>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className="settings-list">
            <div>
              <strong>当前账号</strong>
              <span>{session?.name ?? "未登录"}</span>
            </div>
            <div>
              <strong>权限范围</strong>
              <span>
                {session?.role === "administrator"
                  ? "可管理后台成员、业务数据和报表"
                  : "可处理趟次、费用、车辆、司机和报表"}
              </span>
            </div>
            <div>
              <strong>成员管理</strong>
              <span>
                {session?.role === "administrator"
                  ? "已开启，仅超级管理员可见"
                  : "当前账号不可见，不可操作"}
              </span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>业务规则</h2>
              <p>这些规则已在后台和司机端共同生效。</p>
            </div>
            <ReceiptText size={20} />
          </div>
          <div className="settings-list">
            <div>
              <strong>金额精度</strong>
              <span>人民币，两位小数，Decimal 存储</span>
            </div>
            <div>
              <strong>小票提交</strong>
              <span>必传票据缺失时，司机端禁止提交</span>
            </div>
            <div>
              <strong>审核流程</strong>
              <span>已提交小票可审核、退回或结算归档</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>数据与安全</h2>
              <p>第一版以本地 API 和数据库为主，预留存储迁移口径。</p>
            </div>
            <Database size={20} />
          </div>
          <div className="settings-list">
            <div>
              <strong>票据存储</strong>
              <span>当前记录存储键，后续可迁移对象存储</span>
            </div>
            <div>
              <strong>登录鉴权</strong>
              <span>后台使用 HttpOnly Cookie，API 使用角色头校验</span>
            </div>
            <div>
              <strong>操作审计</strong>
              <span>审核、退回、结算和费用调整会写入审计日志</span>
            </div>
          </div>
        </div>

        <aside className="review-panel settings-side-panel">
          <div className="review-note">
            <LockKeyhole size={18} />
            Administrator 账号是最高权限账号，建议只保留给实际负责人使用。
          </div>
          <div className="settings-action-list">
            <Link href="/trips">
              <ReceiptText size={17} />
              处理待审核小票
            </Link>
            <Link href="/expense-types">
              <FileImage size={17} />
              维护费用与票据规则
            </Link>
            {session?.role === "administrator" ? (
              <Link href="/members">
                <UserCog size={17} />
                创建或停用后台成员
              </Link>
            ) : null}
          </div>
          {session?.role === "administrator" && members.length > 0 ? (
            <div className="member-mini-list">
              <h2>成员概览</h2>
              {members.slice(0, 5).map((member) => (
                <div key={member.id}>
                  <span>{member.name}</span>
                  <strong>
                    {roleLabel(member.role)} · {statusLabel(member.status)}
                  </strong>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </section>
    </AdminShell>
  );
}
