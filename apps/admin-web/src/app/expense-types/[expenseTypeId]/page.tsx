import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { apiGet, apiPost, type ApiExpenseType } from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function updateExpenseTypeAction(formData: FormData) {
  "use server";
  const expenseTypeId = String(formData.get("expenseTypeId") || "");
  await apiPost<{ expenseType: ApiExpenseType }>(`/admin/expense-types/${expenseTypeId}`, {
    name: String(formData.get("name") || ""),
    requiresReceipt: formData.get("requiresReceipt") === "on",
    sortOrder: Number(formData.get("sortOrder") || 0),
    enabled: formData.get("enabled") === "on",
  });
  revalidatePath(`/expense-types/${expenseTypeId}`);
  revalidatePath("/expense-types");
  redirect("/expense-types");
}

export default async function ExpenseTypeDetailPage({
  params,
}: {
  params: Promise<{ expenseTypeId: string }>;
}) {
  const { expenseTypeId } = await params;
  const { expenseType } = await apiGet<{ expenseType: ApiExpenseType }>(
    `/admin/expense-types/${expenseTypeId}`,
  );

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>{expenseType.name}</h1>
          <p>修改司机端可选费用类型、票据必传规则和排序。</p>
        </div>
        <Link className="secondary-button" href="/expense-types">
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </section>

      <section className="detail-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>当前规则</h2>
              <p>历史费用会保留创建时的费用类型名称快照。</p>
            </div>
            <StatusBadge status={expenseType.enabled ? "enabled" : "disabled"} />
          </div>
          <div className="info-list">
            <div>
              <span>类别名称</span>
              <strong>{expenseType.name}</strong>
            </div>
            <div>
              <span>票据规则</span>
              <strong>{expenseType.requiresReceipt ? "必传票据" : "非必传"}</strong>
            </div>
            <div>
              <span>司机端状态</span>
              <strong>{expenseType.enabled ? "可选择" : "已隐藏"}</strong>
            </div>
            <div>
              <span>排序</span>
              <strong>{expenseType.sortOrder}</strong>
            </div>
          </div>
        </div>

        <aside className="review-panel">
          <h2>编辑规则</h2>
          <div className="review-note">
            停用后司机新增费用时不再显示该类别，历史费用记录不会被改名。
          </div>
          <form action={updateExpenseTypeAction} className="form-panel">
            <input type="hidden" name="expenseTypeId" value={expenseType.id} />
            <label>
              类别名称
              <input name="name" defaultValue={expenseType.name} required />
            </label>
            <label>
              排序
              <input name="sortOrder" type="number" min="0" defaultValue={expenseType.sortOrder} />
            </label>
            <label className="checkbox-row">
              <input
                name="requiresReceipt"
                type="checkbox"
                defaultChecked={expenseType.requiresReceipt}
              />
              <span>该类别必须上传票据</span>
            </label>
            <label className="checkbox-row">
              <input name="enabled" type="checkbox" defaultChecked={expenseType.enabled} />
              <span>司机端启用该类别</span>
            </label>
            <button className="primary-button" type="submit">
              <Save size={16} />
              保存规则
            </button>
          </form>
        </aside>
      </section>
    </AdminShell>
  );
}
