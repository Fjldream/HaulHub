import { Filter, History, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiGet, formatDateTime, type ApiAuditLog } from "@/lib/api-client";

export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  "trip.review_started": "开始审核",
  "trip.returned": "退回小票",
  "trip.settled": "结算小票",
  "expense.updated": "修改费用",
  "expense.deleted": "删除费用",
};

function actionLabel(action: string) {
  return actionLabels[action] ?? action;
}

function targetLabel(targetType: string) {
  if (targetType === "Trip") return "趟次";
  if (targetType === "Expense") return "费用";
  return targetType;
}

function payloadSummary(value: unknown) {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${String(item)}`)
      .join("，");
  }
  return String(value);
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ targetType?: string; action?: string; actorId?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.targetType && params.targetType !== "all") query.set("targetType", params.targetType);
  if (params.action && params.action !== "all") query.set("action", params.action);
  if (params.actorId?.trim()) query.set("actorId", params.actorId.trim());

  const { logs } = await apiGet<{ logs: ApiAuditLog[] }>(
    `/admin/audit-logs${query.size > 0 ? `?${query.toString()}` : ""}`,
  );
  const tripCount = logs.filter((log) => log.targetType === "Trip").length;
  const expenseCount = logs.filter((log) => log.targetType === "Expense").length;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>操作记录</h1>
          <p>追踪小票审核、退回、结算和费用调整记录。</p>
        </div>
      </section>

      <section className="stat-strip">
        <div>
          <span>本页记录</span>
          <strong>{logs.length}</strong>
        </div>
        <div>
          <span>趟次操作</span>
          <strong>{tripCount}</strong>
        </div>
        <div>
          <span>费用操作</span>
          <strong>{expenseCount}</strong>
        </div>
      </section>

      <form className="table-toolbar">
        <label className="toolbar-search">
          <Search size={16} />
          <input name="actorId" placeholder="按成员 ID 筛选" defaultValue={params.actorId ?? ""} />
        </label>
        <div className="toolbar-group">
          <select name="targetType" defaultValue={params.targetType ?? "all"}>
            <option value="all">全部对象</option>
            <option value="Trip">趟次</option>
            <option value="Expense">费用</option>
          </select>
          <select name="action" defaultValue={params.action ?? "all"}>
            <option value="all">全部动作</option>
            <option value="trip.review_started">开始审核</option>
            <option value="trip.returned">退回小票</option>
            <option value="trip.settled">结算小票</option>
            <option value="expense.updated">修改费用</option>
            <option value="expense.deleted">删除费用</option>
          </select>
          <button className="secondary-button" type="submit">
            <Filter size={16} />
            筛选
          </button>
        </div>
      </form>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>审计日志</h2>
            <p>最多显示最近 100 条记录。</p>
          </div>
          <History size={20} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>成员</th>
                <th>对象</th>
                <th>动作</th>
                <th>变更前</th>
                <th>变更后</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>
                    <div className="cell-stack">
                      <strong>{log.actorName}</strong>
                      <span>{log.actorRole}</span>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <strong>{targetLabel(log.targetType)}</strong>
                      <span>{log.targetId}</span>
                    </div>
                  </td>
                  <td>
                    <span className="status info">{actionLabel(log.action)}</span>
                  </td>
                  <td className="audit-payload">{payloadSummary(log.before)}</td>
                  <td className="audit-payload">{payloadSummary(log.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 ? (
            <div className="empty-state">
              <strong>暂无操作记录</strong>
              <span>完成审核、退回、结算或费用调整后会显示在这里。</span>
            </div>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
