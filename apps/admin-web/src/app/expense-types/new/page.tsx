import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiPost, type ApiExpenseType } from "@/lib/api-client";

async function createExpenseTypeAction(formData: FormData) {
  "use server";
  await apiPost<{ expenseType: ApiExpenseType }>("/admin/expense-types", {
    name: String(formData.get("name") || ""),
    requiresReceipt: formData.get("requiresReceipt") === "on",
    sortOrder: Number(formData.get("sortOrder") || 0),
  });
  redirect("/expense-types");
}

export default function NewExpenseTypePage() {
  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>新增费用类别</h1>
          <p>配置司机端可选择的费用类型和票据必传规则。</p>
        </div>
        <Link className="secondary-button" href="/expense-types">
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </section>
      <form action={createExpenseTypeAction} className="form-panel">
        <section className="form-section">
          <div className="form-section-head">
            <h2>类别规则</h2>
            <p>停用、改名和历史快照处理将在编辑功能里继续补齐。</p>
          </div>
          <div className="form-grid">
            <label>
              类别名称
              <input name="name" placeholder="例如：洗车费" required />
            </label>
            <label>
              排序
              <input defaultValue="10" min="0" name="sortOrder" type="number" />
            </label>
            <label className="checkbox-row">
              <input name="requiresReceipt" type="checkbox" />
              <span>该类别必须上传票据</span>
            </label>
          </div>
        </section>
        <div className="form-actions">
          <Link className="secondary-button" href="/expense-types">
            取消
          </Link>
          <button className="primary-button" type="submit">
            <Save size={16} />
            保存类别
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
