import { Calculator, Edit3, Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { DecimalInput } from "@/components/admin/decimal-input";
import {
  defaultSalaryMonth,
  isSalaryMonth,
  normalizePayrollTypeFilter,
  payrollTypeLabel,
  payrollTypes,
} from "@/components/admin/payroll-model";
import { redirectWithActionError } from "@/lib/action-errors";
import {
  apiGet,
  apiPost,
  type ApiDriver,
  type ApiDriverPayroll,
  type DriverPayrollList,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

type PayrollSearchParams = {
  month?: string;
  driverId?: string;
  type?: string;
  q?: string;
};

function money(value: string | null | undefined) {
  return `¥${Number(value ?? 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function buildPayrollQuery(params: PayrollSearchParams) {
  const query = new URLSearchParams();
  if (params.month && isSalaryMonth(params.month)) {
    query.set("month", params.month);
  }
  if (params.driverId && params.driverId !== "all") {
    query.set("driverId", params.driverId);
  }
  const type = normalizePayrollTypeFilter(params.type);
  if (type !== "all") {
    query.set("type", type);
  }
  if (params.q?.trim()) {
    query.set("q", params.q.trim());
  }
  query.set("pageSize", "100");
  return query;
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

async function createPayrollAction(formData: FormData) {
  "use server";
  const salaryMonth = formString(formData, "salaryMonth");
  const driverId = formString(formData, "driverId");
  const targetPath = `/drivers/payroll?${new URLSearchParams({
    ...(salaryMonth ? { month: salaryMonth } : {}),
    ...(driverId ? { driverId } : {}),
  }).toString()}`;

  try {
    await apiPost<{ payroll: ApiDriverPayroll }>("/admin/driver-payrolls", payrollPayload(formData));
  } catch (error) {
    redirectWithActionError(targetPath, error);
  }

  revalidatePath("/drivers/payroll");
  redirect(targetPath);
}

export default async function DriverPayrollPage({
  searchParams,
}: {
  searchParams: Promise<PayrollSearchParams>;
}) {
  const params = await searchParams;
  const selectedMonth = params.month && isSalaryMonth(params.month) ? params.month : defaultSalaryMonth();
  const selectedType = normalizePayrollTypeFilter(params.type);
  const listQuery = buildPayrollQuery({ ...params, month: selectedMonth, type: selectedType });
  const [{ drivers }, payrollList] = await Promise.all([
    apiGet<{ drivers: ApiDriver[] }>("/admin/drivers"),
    apiGet<DriverPayrollList>(`/admin/driver-payrolls?${listQuery.toString()}`),
  ]);
  const payrolls = payrollList.payrolls;
  const selectedDriver = drivers.find((driver) => driver.id === params.driverId);
  const tripPayrollCount = payrolls.filter((payroll) => payroll.type === "trip").length;
  const paidCount = payrolls.filter((payroll) => payroll.paidAt).length;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>司机工资</h1>
          <p>按月份维护司机固定工资、趟次工资、奖金和扣款调整。</p>
        </div>
        <Link
          className="secondary-button"
          href={`/drivers/trip-payroll?${new URLSearchParams({
            month: selectedMonth,
            ...(params.driverId && params.driverId !== "all" ? { driverId: params.driverId } : {}),
          }).toString()}`}
        >
          <Calculator size={16} />
          趟次计薪
        </Link>
      </section>

      <form className="table-toolbar payroll-filter-form">
        <label className="toolbar-search">
          <Search size={16} />
          <input name="q" placeholder="搜索司机姓名、手机号或备注" defaultValue={params.q ?? ""} />
        </label>
        <div className="toolbar-group">
          <input name="month" type="month" defaultValue={selectedMonth} />
          <select name="driverId" defaultValue={params.driverId ?? "all"}>
            <option value="all">全部司机</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={selectedType}>
            <option value="all">全部类型</option>
            {payrollTypes.map((type) => (
              <option key={type} value={type}>
                {payrollTypeLabel(type)}
              </option>
            ))}
          </select>
          <button className="secondary-button" type="submit">
            <SlidersHorizontal size={16} />
            筛选
          </button>
        </div>
      </form>

      <section className="stat-strip payroll-stat-strip">
        <div>
          <span>筛选月份</span>
          <strong>{selectedMonth}</strong>
        </div>
        <div>
          <span>工资总额</span>
          <strong>{money(payrollList.summary.totalAmount)}</strong>
        </div>
        <div>
          <span>趟次工资</span>
          <strong>{tripPayrollCount}</strong>
        </div>
        <div>
          <span>已付款记录</span>
          <strong>{paidCount}</strong>
        </div>
      </section>

      <section className="panel payroll-create-panel">
        <div className="panel-header">
          <div>
            <h2>新增工资记录</h2>
            <p>{selectedDriver ? `当前筛选司机：${selectedDriver.name}` : "选择司机、月份和类型后录入金额。"}</p>
          </div>
        </div>
        <form action={createPayrollAction} className="payroll-entry-form">
          <label>
            司机
            <select name="driverId" defaultValue={params.driverId && params.driverId !== "all" ? params.driverId : ""} required>
              <option value="" disabled>
                选择司机
              </option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} · {driver.phone}
                </option>
              ))}
            </select>
          </label>
          <label>
            工资月份
            <input name="salaryMonth" type="month" defaultValue={selectedMonth} required />
          </label>
          <label>
            类型
            <select name="type" defaultValue="fixed" required>
              {payrollTypes.map((type) => (
                <option key={type} value={type}>
                  {payrollTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            金额
            <DecimalInput labelText="金额" name="amount" placeholder="0.00" required />
          </label>
          <label>
            趟次数
            <input inputMode="numeric" min={0} name="tripCount" placeholder="趟次工资可填" type="number" />
          </label>
          <label>
            单趟金额
            <DecimalInput labelText="单趟金额" name="unitAmount" placeholder="0.00" />
          </label>
          <label>
            付款日期
            <input name="paidAt" type="date" />
          </label>
          <label className="payroll-note-field">
            备注
            <input name="note" placeholder="例如：6月趟次工资" />
          </label>
          <ConfirmSubmitButton className="primary-button" pendingChildren="提交中...">
            <Plus size={16} />
            新增工资
          </ConfirmSubmitButton>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>工资记录</h2>
            <p>共 {payrollList.total} 条记录，当前显示 {payrolls.length} 条。</p>
          </div>
          <span className="panel-kicker">第 {payrollList.page} / {payrollList.totalPages} 页</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>司机</th>
                <th>月份</th>
                <th>类型</th>
                <th className="num">金额</th>
                <th>趟次</th>
                <th>付款日期</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map((payroll) => (
                <tr key={payroll.id}>
                  <td>
                    <div className="cell-stack">
                      <strong>{payroll.driverName ?? "未知司机"}</strong>
                      <span>{payroll.driverPhone ?? payroll.driverId}</span>
                    </div>
                  </td>
                  <td>{payroll.salaryMonth}</td>
                  <td>{payrollTypeLabel(payroll.type)}</td>
                  <td className="num strong">{money(payroll.amount)}</td>
                  <td>
                    {payroll.tripCount == null ? "-" : `${payroll.tripCount} 趟`}
                    {payroll.unitAmount ? ` · ${money(payroll.unitAmount)}/趟` : ""}
                  </td>
                  <td>{dateInputValue(payroll.paidAt) || "未付款"}</td>
                  <td className="payroll-note-cell">{payroll.note ?? "-"}</td>
                  <td>
                    <Link className="icon-link" href={`/drivers/payroll/${payroll.id}`} title="编辑工资">
                      <Edit3 size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
              {payrolls.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <strong>暂无工资记录</strong>
                      <span>调整筛选条件，或在上方新增一条工资记录。</span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
