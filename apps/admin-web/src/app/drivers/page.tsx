import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { apiGet, type ApiDriver } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const { drivers } = await apiGet<{ drivers: ApiDriver[] }>("/admin/drivers");

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>司机管理</h1>
          <p>维护司机账号、状态和车辆绑定。</p>
        </div>
        <button className="primary-button">新增司机</button>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>手机号</th>
                <th>状态</th>
                <th>可驾驶车辆</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="strong">{driver.name}</td>
                  <td>{driver.phone}</td>
                  <td>
                    <StatusBadge status={driver.status} />
                  </td>
                  <td>-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
