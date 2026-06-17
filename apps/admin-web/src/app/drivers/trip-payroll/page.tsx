import { ArrowRight, Calculator, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { isSalaryMonth } from "@/components/admin/payroll-model";
import { apiGet, type ApiDriver, type DriverPayrollTripCount } from "@/lib/api-client";

export const dynamic = "force-dynamic";

type TripPayrollSearchParams = {
  month?: string;
  driverId?: string;
};

function currentSalaryMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function roleLabel(role: string) {
  return role === "primary" ? "主司机" : "协同司机";
}

export default async function TripPayrollPage({
  searchParams,
}: {
  searchParams: Promise<TripPayrollSearchParams>;
}) {
  const params = await searchParams;
  const selectedMonth = params.month && isSalaryMonth(params.month) ? params.month : currentSalaryMonth();
  const selectedDriverId = params.driverId ?? "";
  const { drivers } = await apiGet<{ drivers: ApiDriver[] }>("/admin/drivers");
  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId);
  const canQuery = Boolean(selectedDriverId && isSalaryMonth(selectedMonth));
  const result = canQuery
    ? await apiGet<DriverPayrollTripCount>(
        `/admin/driver-payrolls/trip-count?${new URLSearchParams({
          driverId: selectedDriverId,
          month: selectedMonth,
        }).toString()}`,
      )
    : null;
  const createPayrollHref = `/drivers/payroll?${new URLSearchParams({
    month: selectedMonth,
    ...(selectedDriverId ? { driverId: selectedDriverId } : {}),
  }).toString()}`;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>趟次计薪</h1>
          <p>查询司机在指定月份作为主司机和协同司机完成的趟次数。</p>
        </div>
        <Link className="secondary-button" href="/drivers/payroll">
          <Calculator size={16} />
          工资记录
        </Link>
      </section>

      <form className="table-toolbar payroll-filter-form">
        <label className="toolbar-search">
          <Search size={16} />
          <select name="driverId" defaultValue={selectedDriverId} required>
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
        <div className="toolbar-group">
          <input name="month" type="month" defaultValue={selectedMonth} required />
          <button className="secondary-button" type="submit">
            <SlidersHorizontal size={16} />
            查询
          </button>
          <Link className="primary-button" href={createPayrollHref}>
            <ArrowRight size={16} />
            创建工资
          </Link>
        </div>
      </form>

      {result ? (
        <>
          <section className="stat-strip payroll-stat-strip">
            <div>
              <span>主司机趟次</span>
              <strong>{result.summary.primaryTripCount}</strong>
            </div>
            <div>
              <span>协同趟次</span>
              <strong>{result.summary.assistantTripCount}</strong>
            </div>
            <div>
              <span>合计计薪趟次</span>
              <strong>{result.summary.payrollTripCount}</strong>
            </div>
            <div>
              <span>查询司机</span>
              <strong>{selectedDriver?.name ?? "-"}</strong>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>完成趟次明细</h2>
                <p>{selectedMonth} 共 {result.trips.length} 条可计薪趟次。</p>
              </div>
              <Link className="secondary-button" href={createPayrollHref}>
                进入工资录入
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>趟次编号</th>
                    <th>客户</th>
                    <th>完成日期</th>
                    <th>角色</th>
                    <th>主司机</th>
                    <th>车辆</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trips.map((trip) => (
                    <tr key={trip.id}>
                      <td className="strong">{trip.tripNo}</td>
                      <td>{trip.customerName ?? "-"}</td>
                      <td>{formatDate(trip.completedAt)}</td>
                      <td>
                        <span className={trip.role === "primary" ? "status info" : "status accent"}>
                          {roleLabel(trip.role)}
                        </span>
                      </td>
                      <td>{trip.driverName ?? "-"}</td>
                      <td>{trip.vehiclePlateNumber ?? "-"}</td>
                    </tr>
                  ))}
                  {result.trips.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <strong>暂无可计薪趟次</strong>
                          <span>该司机在当前月份没有已完成趟次。</span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="empty-state payroll-empty-state">
          <strong>请选择司机和月份</strong>
          <span>选择后会展示主司机趟次、协同趟次和合计计薪趟次。</span>
        </section>
      )}
    </AdminShell>
  );
}
