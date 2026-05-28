import { Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { TripTable } from "@/components/admin/trip-table";
import { apiGet, type ApiTrip } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.q?.trim()) {
    query.set("q", params.q.trim());
  }
  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }
  const { trips } = await apiGet<{ trips: ApiTrip[] }>(
    `/admin/trips${query.size > 0 ? `?${query.toString()}` : ""}`,
  );
  const submittedCount = trips.filter((trip) => trip.status === "submitted").length;
  const reviewCount = trips.filter((trip) => trip.status === "under_review").length;
  const completedCount = trips.filter((trip) => trip.status === "completed").length;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>趟次管理</h1>
          <p>筛选、创建和进入趟次账单审核。</p>
        </div>
        <div className="button-row">
          <Link className="primary-button" href="/trips/new">
            <Plus size={16} />
            创建趟次
          </Link>
        </div>
      </section>
      <section className="stat-strip">
        <div>
          <span>待审核</span>
          <strong>{submittedCount}</strong>
        </div>
        <div>
          <span>审核中</span>
          <strong>{reviewCount}</strong>
        </div>
        <div>
          <span>已完成</span>
          <strong>{completedCount}</strong>
        </div>
      </section>
      <form className="table-toolbar">
        <label className="toolbar-search">
          <Search size={16} />
          <input
            name="q"
            placeholder="搜索趟次编号、车牌、司机"
            defaultValue={params.q ?? ""}
          />
        </label>
        <div className="toolbar-group">
          <select name="status" defaultValue={params.status ?? "all"}>
            <option value="all">全部状态</option>
            <option value="assigned">待出车</option>
            <option value="in_progress">进行中</option>
            <option value="submitted">已提交</option>
            <option value="under_review">审核中</option>
            <option value="completed">已完成</option>
          </select>
          <input type="date" />
          <button className="secondary-button" type="submit">
            <Filter size={16} />
            应用筛选
          </button>
        </div>
      </form>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>趟次账单</h2>
            <p>按创建时间排序，优先处理已提交和审核中账单。</p>
          </div>
          <span className="panel-kicker">{trips.length} 单</span>
        </div>
        <TripTable trips={trips} />
      </section>
    </AdminShell>
  );
}
