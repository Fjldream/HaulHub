import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AiBillIntakeWorkbench } from "@/components/admin/ai-bill-intake-workbench";
import { apiGet, type ApiDriver, type ApiExpenseType, type ApiVehicle } from "@/lib/api-client";

export const dynamic = "force-dynamic";

/**
 * AI 账单补录页面。
 *
 * @returns 带后台框架的 AI 补录工作台。
 */
export default async function AiBillIntakePage() {
  const [{ vehicles }, { drivers }, { expenseTypes }] = await Promise.all([
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    apiGet<{ drivers: ApiDriver[] }>("/admin/drivers"),
    apiGet<{ expenseTypes: ApiExpenseType[] }>("/admin/expense-types"),
  ]);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>AI 账单补录</h1>
          <p>上传图片或输入文字，由 Agent 生成草稿；会计确认后再提交后端校验。</p>
        </div>
        <Link className="secondary-button" href="/trips">
          <ArrowLeft size={16} />
          返回趟次
        </Link>
      </section>

      <AiBillIntakeWorkbench
        vehicles={vehicles.filter((vehicle) => vehicle.status === "available")}
        drivers={drivers.filter((driver) => driver.status === "active")}
        expenseTypes={expenseTypes.filter((type) => type.enabled)}
      />
    </AdminShell>
  );
}
