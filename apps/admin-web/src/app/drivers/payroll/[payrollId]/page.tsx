import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { DecimalInput } from "@/components/admin/decimal-input";
import { payrollTypeLabel, payrollTypes } from "@/components/admin/payroll-model";
import { redirectWithActionError } from "@/lib/action-errors";
import { apiGet, apiPost, type ApiDriver, type ApiDriverPayroll } from "@/lib/api-client";

export const dynamic = "force-dynamic";

function money(value: string | null | undefined) {
  return `¥${Number(value ?? 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function formString(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

function payrollPayload(formData: FormData) {
  const tripCount = formString(formData, "tripCount");
  const unitAmount = formString(formData, "unitAmount");
  const paidAt = formString(formData, "paidAt");
  const note = formString(formData, "note");

  return {
    driverId: formString(formData, "driverId"),
    salaryMonth: formString(formData, "salaryMonth"),
    type: formString(formData, "type"),
    amount: formString(formData, "amount"),
    tripCount: tripCount ? Number(tripCount) : undefined,
    unitAmount: unitAmount || undefined,
    paidAt: paidAt || undefined,
    note: note || undefined,
  };
}

async function updatePayrollAction(formData: FormData) {
  "use server";
  const payrollId = formString(formData, "payrollId");
  const targetPath = `/drivers/payroll/${payrollId}`;

  try {
    await apiPost<{ payroll: ApiDriverPayroll }>(`/admin/driver-payrolls/${payrollId}`, payrollPayload(formData));
  } catch (error) {
    redirectWithActionError(targetPath, error);
  }

  revalidatePath(targetPath);
  revalidatePath("/drivers/payroll");
  redirect(targetPath);
}

async function deletePayrollAction(formData: FormData) {
  "use server";
  const payrollId = formString(formData, "payrollId");
  const targetPath = `/drivers/payroll/${payrollId}`;

  try {
    await apiPost<{ deleted: true }>(`/admin/driver-payrolls/${payrollId}/delete`);
  } catch (error) {
    redirectWithActionError(targetPath, error);
  }

  revalidatePath("/drivers/payroll");
  redirect("/drivers/payroll");
}

export default async function DriverPayrollDetailPage({
  params,
}: {
  params: Promise<{ payrollId: string }>;
}) {
  const { payrollId } = await params;
  const [{ payroll }, { drivers }] = await Promise.all([
    apiGet<{ payroll: ApiDriverPayroll }>(`/admin/driver-payrolls/${payrollId}`),
    apiGet<{ drivers: ApiDriver[] }>("/admin/drivers"),
  ]);

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>编辑工资记录</h1>
          <p>
            {payroll.driverName ?? "未知司机"} · {payroll.salaryMonth} · {payrollTypeLabel(payroll.type)}
          </p>
        </div>
        <Link className="secondary-button" href="/drivers/payroll">
          <ArrowLeft size={16} />
          返回工资列表
        </Link>
      </section>

      <section className="detail-layout payroll-detail-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>工资信息</h2>
              <p>修改司机、月份、类型、金额和付款备注。</p>
            </div>
            <span className="panel-kicker">{money(payroll.amount)}</span>
          </div>
          <form action={updatePayrollAction} className="payroll-entry-form payroll-edit-form">
            <input name="payrollId" type="hidden" value={payroll.id} />
            <label>
              司机
              <select name="driverId" defaultValue={payroll.driverId} required>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} · {driver.phone}
                  </option>
                ))}
              </select>
            </label>
            <label>
              工资月份
              <input name="salaryMonth" type="month" defaultValue={payroll.salaryMonth} required />
            </label>
            <label>
              类型
              <select name="type" defaultValue={payroll.type} required>
                {payrollTypes.map((type) => (
                  <option key={type} value={type}>
                    {payrollTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              金额
              <DecimalInput labelText="金额" name="amount" defaultValue={payroll.amount} required />
            </label>
            <label>
              趟次数
              <input
                inputMode="numeric"
                min={0}
                name="tripCount"
                type="number"
                defaultValue={payroll.tripCount ?? ""}
              />
            </label>
            <label>
              单趟金额
              <DecimalInput labelText="单趟金额" name="unitAmount" defaultValue={payroll.unitAmount ?? ""} />
            </label>
            <label>
              付款日期
              <input name="paidAt" type="date" defaultValue={dateInputValue(payroll.paidAt)} />
            </label>
            <label className="payroll-note-field">
              备注
              <input name="note" defaultValue={payroll.note ?? ""} />
            </label>
            <div className="payroll-form-actions">
              <Link className="secondary-button" href="/drivers/payroll">
                取消
              </Link>
              <button className="primary-button" type="submit">
                <Save size={16} />
                保存修改
              </button>
            </div>
          </form>
        </section>

        <aside className="review-panel payroll-danger-panel">
          <h2>记录摘要</h2>
          <div className="info-list">
            <div>
              <span>创建人</span>
              <strong>{payroll.creatorName ?? "-"}</strong>
            </div>
            <div>
              <span>创建时间</span>
              <strong>{dateInputValue(payroll.createdAt)}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{dateInputValue(payroll.updatedAt)}</strong>
            </div>
            <div>
              <span>付款日期</span>
              <strong>{dateInputValue(payroll.paidAt) || "未付款"}</strong>
            </div>
          </div>
          <form action={deletePayrollAction} className="form-panel">
            <input name="payrollId" type="hidden" value={payroll.id} />
            <button className="danger-button" type="submit">
              <Trash2 size={16} />
              删除工资记录
            </button>
          </form>
        </aside>
      </section>
    </AdminShell>
  );
}
