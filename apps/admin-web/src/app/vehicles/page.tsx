import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { vehicles } from "@/lib/mock-data";

export default function VehiclesPage() {
  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>车辆管理</h1>
          <p>维护车牌、状态和可分配司机。</p>
        </div>
        <button className="primary-button">新增车辆</button>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>车牌号</th>
                <th>状态</th>
                <th>车型</th>
                <th>绑定司机</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.plateNumber}>
                  <td className="strong">{vehicle.plateNumber}</td>
                  <td><StatusBadge status={vehicle.status} /></td>
                  <td>{vehicle.type}</td>
                  <td>{vehicle.drivers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
