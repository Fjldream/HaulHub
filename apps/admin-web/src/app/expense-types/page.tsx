import { Edit3, Plus, ReceiptText, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { apiGet, type ApiExpenseType } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function ExpenseTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; receiptRule?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.q?.trim()) {
    query.set("q", params.q.trim());
  }
  if (params.receiptRule && params.receiptRule !== "all") {
    query.set("receiptRule", params.receiptRule);
  }
  const { expenseTypes } = await apiGet<{ expenseTypes: ApiExpenseType[] }>(
    `/admin/expense-types${query.size > 0 ? `?${query.toString()}` : ""}`,
  );
  const receiptRequiredCount = expenseTypes.filter((type) => type.requiresReceipt).length;
  const enabledCount = expenseTypes.filter((type) => type.enabled).length;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>费用类别配置</h1>
          <p>控制司机端可选费用类型和票据必传规则。</p>
        </div>
        <Link className="primary-button" href="/expense-types/new">
          <Plus size={16} />
          新增类别
        </Link>
      </section>
      <section className="stat-strip">
        <div>
          <span>启用类别</span>
          <strong>{enabledCount}</strong>
        </div>
        <div>
          <span>必传票据</span>
          <strong>{receiptRequiredCount}</strong>
        </div>
        <div>
          <span>司机端可选</span>
          <strong>{enabledCount}</strong>
        </div>
      </section>
      <form className="table-toolbar">
        <label className="toolbar-search">
          <Search size={16} />
          <input name="q" placeholder="搜索费用类别" defaultValue={params.q ?? ""} />
        </label>
        <div className="toolbar-group">
          <select name="receiptRule" defaultValue={params.receiptRule ?? "all"}>
            <option value="all">全部规则</option>
            <option value="required">必传票据</option>
            <option value="optional">非必传</option>
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
            <h2>费用类型</h2>
            <p>历史费用保留当时的类型名称快照。</p>
          </div>
          <span className="panel-kicker">{expenseTypes.length} 项</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>票据规则</th>
                <th>状态</th>
                <th>排序</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {expenseTypes.map((type) => (
                <tr key={type.id}>
                  <td className="strong">{type.name}</td>
                  <td>
                    <span className={type.requiresReceipt ? "status accent" : "status neutral"}>
                      <ReceiptText size={13} />
                      {type.requiresReceipt ? "必传票据" : "非必传"}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={type.enabled ? "enabled" : "disabled"} />
                  </td>
                  <td>{type.sortOrder}</td>
                  <td>
                    <div className="table-actions">
                      <Link
                        className="icon-link"
                        href={`/expense-types/${type.id}`}
                        title="编辑类别"
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
