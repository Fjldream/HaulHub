import { Filter, Plus } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { TripTable } from "@/components/admin/trip-table";

export default function TripsPage() {
  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>趟次管理</h1>
          <p>筛选、创建和进入趟次账单审核。</p>
        </div>
        <div className="button-row">
          <button className="secondary-button">
            <Filter size={16} />
            筛选
          </button>
          <button className="primary-button">
            <Plus size={16} />
            创建趟次
          </button>
        </div>
      </section>
      <section className="filter-bar">
        <input placeholder="搜索趟次编号、车牌、司机" />
        <select defaultValue="all">
          <option value="all">全部状态</option>
          <option value="submitted">已提交</option>
          <option value="under_review">审核中</option>
          <option value="completed">已完成</option>
        </select>
        <input type="date" />
      </section>
      <section className="panel">
        <TripTable />
      </section>
    </AdminShell>
  );
}
