import { AlertTriangle, CheckCircle2, Clock, Truck } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { TripTable } from "@/components/admin/trip-table";

const metrics = [
  { label: "待审核账单", value: "12", helper: "较昨日 +3", icon: AlertTriangle },
  { label: "进行中趟次", value: "18", helper: "今日新增 6", icon: Truck },
  { label: "本月已完成", value: "126", helper: "结算闭环", icon: CheckCircle2 },
  { label: "平均审核耗时", value: "1.8h", helper: "近 7 日", icon: Clock },
];

export default function Home() {
  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>工作台</h1>
          <p>优先处理已提交账单、票据缺失和待确认运费。</p>
        </div>
        <button className="primary-button">创建趟次</button>
      </section>

      <section className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
              <Icon size={20} />
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
        <TripTable />
      </section>
    </AdminShell>
  );
}
