import {
  Bell,
  ClipboardCheck,
  ExternalLink,
  Fullscreen,
  MapPinned,
  ReceiptText,
  Route,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { statusLabel } from "@/components/admin/status-badge";
import { redirectWithActionError } from "@/lib/action-errors";
import {
  apiGet,
  type ApiTrip,
  type ProfitPeriodGroup,
  type ProfitSummary,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

function money(value: string | null | undefined) {
  return `¥${Number(value ?? 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: dateInput(from), to: dateInput(to) };
}

function weekRange() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 5));
  return { from: dateInput(from), to: dateInput(to) };
}

function compactDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function readablePlace(value: string | null | undefined) {
  if (!value || value.includes("?")) {
    return "位置同步中";
  }
  return value;
}

async function unavailableAction() {
  "use server";
  redirectWithActionError("/", new Error("功能暂未开放"));
}

function barHeight(value: number, max: number) {
  if (max <= 0) {
    return "14%";
  }
  return `${Math.max(14, Math.round((value / max) * 82))}%`;
}

export default async function Home() {
  const [tripResponse, monthReport, weekReport] = await Promise.all([
    apiGet<{ trips: ApiTrip[] }>("/admin/trips"),
    apiGet<{ summary: ProfitSummary; byPeriod: ProfitPeriodGroup[] }>(
      `/admin/reports/profit?period=month&${new URLSearchParams(monthRange()).toString()}`,
    ),
    apiGet<{ summary: ProfitSummary; byPeriod: ProfitPeriodGroup[] }>(
      `/admin/reports/profit?period=week&${new URLSearchParams(weekRange()).toString()}`,
    ),
  ]);

  const trips = tripResponse.trips;
  const submittedTrips = trips.filter((trip) => trip.status === "submitted");
  const inProgressTrips = trips.filter((trip) => trip.status === "in_progress");
  const operationalTrips = trips.filter((trip) =>
    ["assigned", "in_progress", "submitted", "under_review", "returned"].includes(trip.status),
  );
  const today = new Date().toISOString().slice(0, 10);
  const submittedToday = submittedTrips.filter((trip) => (trip.submittedAt ?? trip.createdAt).startsWith(today)).length;
  const hasSubmittedRows = submittedTrips.length > 0;
  const pendingRows = (hasSubmittedRows ? submittedTrips : operationalTrips).slice(0, 4);
  const financeBars = ["周一", "周二", "周三", "周四", "周五"].map((label, index) => {
    const source = weekReport.byPeriod[index];
    const income = Number(source?.actualFreightTotal ?? 0);
    const cost = Number(source?.totalExpense ?? 0);
    return { label, income, cost };
  });
  const maxFinance = Math.max(
    ...financeBars.flatMap((item) => [item.income, item.cost]),
    Number(weekReport.summary.actualFreightTotal),
    Number(weekReport.summary.expenseTotal),
    1,
  );

  const metrics = [
    {
      label: "待审核",
      value: String(submittedTrips.length),
      badge: submittedToday > 0 ? `+${submittedToday} 今日` : "今日",
      icon: ClipboardCheck,
    },
    {
      label: "进行中趟次",
      value: String(inProgressTrips.length),
      badge: "实时",
      icon: Route,
    },
    {
      label: "近期利润",
      value: money(monthReport.summary.profitTotal),
      badge: "本月",
      icon: TrendingUp,
    },
    {
      label: "总运费",
      value: money(monthReport.summary.actualFreightTotal),
      badge: "本月",
      icon: WalletCards,
    },
  ];

  return (
    <AdminShell>
      <section className="workbench-page">
        <section className="workbench-metrics">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article className="workbench-metric-card" key={metric.label}>
                <div className="workbench-metric-top">
                  <span className="workbench-metric-icon">
                    <Icon size={22} />
                  </span>
                  <span>{metric.badge}</span>
                </div>
                <p>{metric.label}</p>
                <strong>{metric.value}</strong>
              </article>
            );
          })}
        </section>

        <section className="workbench-main-grid">
          <article className="workbench-panel">
            <div className="workbench-panel-head">
              <div>
                <h2>{hasSubmittedRows ? "待审核趟次" : "待处理趟次"}</h2>
                {!hasSubmittedRows && operationalTrips.length > 0 ? (
                  <p>当前没有待审核趟次，已展示进行中和待出车趟次。</p>
                ) : null}
              </div>
              <Link href="/trips?status=submitted">
                查看全部 <ExternalLink size={14} />
              </Link>
            </div>
            <div className="workbench-table-wrap">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>趟次编号</th>
                    <th>车牌号</th>
                    <th>司机姓名</th>
                    <th>审核状态</th>
                    <th>管理操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.map((trip) => (
                    <tr key={trip.id}>
                      <td>{trip.tripNo}</td>
                      <td>{trip.vehicle.plateNumber}</td>
                      <td>{trip.driver.name}</td>
                      <td>
                        <span className="workbench-pill">{statusLabel(trip.status)}</span>
                      </td>
                      <td>
                        <Link href={`/trips/${trip.id}`}>详情</Link>
                        <span className="table-divider" />
                        <Link href={`/trips/${trip.id}`}>处理</Link>
                      </td>
                    </tr>
                  ))}
                  {pendingRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="workbench-empty">当前团队暂无趟次数据</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="workbench-panel finance-panel">
            <div className="workbench-panel-head">
              <h2>财务概览</h2>
              <span className="workbench-select">本周数据</span>
            </div>
            <div className="finance-chart">
              <div className="finance-plot">
                {financeBars.map((item) => (
                  <div className="finance-day" key={item.label}>
                    <div className="finance-bars">
                      <span
                        className="finance-bar income"
                        style={{ height: barHeight(item.income, maxFinance) }}
                        title={`运费收入 ${money(String(item.income))}`}
                      />
                      <span
                        className="finance-bar cost"
                        style={{ height: barHeight(item.cost, maxFinance) }}
                        title={`成本支出 ${money(String(item.cost))}`}
                      />
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="finance-baseline" />
              <div className="finance-legend">
                <span>
                  <i className="legend-dot income" /> 运费收入 {money(weekReport.summary.actualFreightTotal)}
                </span>
                <span>
                  <i className="legend-dot cost" /> 成本支出 {money(weekReport.summary.expenseTotal)}
                </span>
              </div>
            </div>
          </article>
        </section>

        <section className="workbench-panel monitor-panel">
          <div className="workbench-panel-head monitor-head">
            <div>
              <h2>进行中趟次监控</h2>
              <p>当前车队实时地理位置追踪</p>
            </div>
            <div className="monitor-actions">
              <form action={unavailableAction}>
                <button className="primary-button" type="submit">
                  <ReceiptText size={16} />
                  查看列表模式
                </button>
              </form>
              <form action={unavailableAction}>
                <button className="secondary-button" type="submit">
                  <Fullscreen size={16} />
                  全屏展开地图
                </button>
              </form>
            </div>
          </div>
          <div className="monitor-map" aria-label="车辆监控占位地图">
            <div className="map-grid" />
            <span className="map-pin primary">
              <MapPinned size={22} />
            </span>
            <span className="map-pin secondary">
              <Bell size={18} />
            </span>
            <div className="monitor-truck-card">
              <strong>{inProgressTrips[0]?.vehicle.plateNumber ?? "暂无运输中车辆"}</strong>
              <span>
                {inProgressTrips[0]
                  ? `${readablePlace(inProgressTrips[0].loadLocation)} → ${readablePlace(inProgressTrips[0].unloadLocation)}`
                  : "等待车辆位置接入"}
              </span>
              <small>{compactDate(inProgressTrips[0]?.createdAt)}</small>
            </div>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}
