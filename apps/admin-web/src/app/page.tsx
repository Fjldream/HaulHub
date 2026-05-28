import { AlertTriangle, CheckCircle2, Clock, Truck } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { TripTable } from "@/components/admin/trip-table";
import { apiGet, type ApiTrip } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { trips } = await apiGet<{ trips: ApiTrip[] }>("/admin/trips");
  const submittedCount = trips.filter((trip) => trip.status === "submitted").length;
  const inProgressCount = trips.filter((trip) => trip.status === "in_progress").length;
  const completedCount = trips.filter((trip) => trip.status === "completed").length;
  const recentTrips = trips.slice(0, 5);
  const metrics = [
    { label: "待审核账单", value: String(submittedCount), helper: "司机已提交", icon: AlertTriangle },
    { label: "进行中趟次", value: String(inProgressCount), helper: "等待司机提交", icon: Truck },
    { label: "已完成", value: String(completedCount), helper: "结算闭环", icon: CheckCircle2 },
    { label: "平均审核耗时", value: "1.8h", helper: "最近 7 日", icon: Clock },
  ];

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>工作台</h1>
          <p>优先处理已提交账单、票据缺失和待确认运费。</p>
        </div>
        <Link className="primary-button" href="/trips/new">
          创建趟次
        </Link>
      </section>

      <section className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
              <div className="metric-card-top">
                <span className="metric-icon">
                  <Icon size={20} />
                </span>
                <span className="metric-trend">实时</span>
              </div>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </article>
          );
        })}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>最近账单</h2>
            <p>按提交时间排序，优先审核状态变化。</p>
          </div>
        </div>
        <TripTable trips={recentTrips} />
      </section>
    </AdminShell>
  );
}
