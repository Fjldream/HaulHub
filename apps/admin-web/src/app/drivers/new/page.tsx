import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { redirectWithActionError } from "@/lib/action-errors";
import { apiPost, type ApiDriver } from "@/lib/api-client";

async function createDriverAction(formData: FormData) {
  "use server";
  try {
    await apiPost<{ driver: ApiDriver }>("/admin/drivers", {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      initialPassword: String(formData.get("initialPassword") || ""),
    });
  } catch (error) {
    redirectWithActionError("/drivers/new", error);
  }
  redirect("/drivers");
}

export default function NewDriverPage() {
  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>新增司机</h1>
          <p>手机号作为登录账号，新账号默认在职并要求首次登录后改密。</p>
        </div>
        <Link className="secondary-button" href="/drivers">
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </section>
      <form action={createDriverAction} className="form-panel">
        <section className="form-section">
          <div className="form-section-head">
            <h2>账号信息</h2>
            <p>司机端不会展示运费、利润和经营报表。</p>
          </div>
          <div className="form-grid">
            <label>
              司机姓名
              <input name="name" placeholder="例如：司机小赵" required />
            </label>
            <label>
              手机号
              <input inputMode="tel" name="phone" placeholder="例如：13900000009" required />
            </label>
            <label>
              初始密码
              <input
                minLength={6}
                name="initialPassword"
                placeholder="至少 6 位"
                required
                type="password"
              />
            </label>
          </div>
        </section>
        <div className="form-actions">
          <Link className="secondary-button" href="/drivers">
            取消
          </Link>
          <button className="primary-button" type="submit">
            <Save size={16} />
            保存司机
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
