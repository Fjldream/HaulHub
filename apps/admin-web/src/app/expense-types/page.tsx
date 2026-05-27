import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { expenseTypes } from "@/lib/mock-data";

export default function ExpenseTypesPage() {
  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>费用类别配置</h1>
          <p>控制司机端可选费用类型和票据必传规则。</p>
        </div>
        <button className="primary-button">新增类别</button>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>票据规则</th>
                <th>状态</th>
                <th>排序</th>
              </tr>
            </thead>
            <tbody>
              {expenseTypes.map((type) => (
                <tr key={type.name}>
                  <td className="strong">{type.name}</td>
                  <td>{type.requiresReceipt}</td>
                  <td><StatusBadge status={type.enabled} /></td>
                  <td>{type.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
