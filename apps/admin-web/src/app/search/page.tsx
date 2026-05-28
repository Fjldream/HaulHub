import { ArrowRight, Car, ClipboardList, ReceiptText, Search, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  apiGet,
  type ApiDriver,
  type ApiExpenseType,
  type ApiTrip,
  type ApiVehicle,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const keyword = params.q?.trim() ?? "";
  const query = new URLSearchParams();
  if (keyword) {
    query.set("q", keyword);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const [{ trips }, { vehicles }, { drivers }, { expenseTypes }] = keyword
    ? await Promise.all([
        apiGet<{ trips: ApiTrip[] }>(`/admin/trips${suffix}`),
        apiGet<{ vehicles: ApiVehicle[] }>(`/admin/vehicles${suffix}`),
        apiGet<{ drivers: ApiDriver[] }>(`/admin/drivers${suffix}`),
        apiGet<{ expenseTypes: ApiExpenseType[] }>(`/admin/expense-types${suffix}`),
      ])
    : [{ trips: [] }, { vehicles: [] }, { drivers: [] }, { expenseTypes: [] }];
  const total = trips.length + vehicles.length + drivers.length + expenseTypes.length;

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>全局搜索</h1>
          <p>搜索趟次、车辆、司机和费用类型，不再固定跳转到趟次管理。</p>
        </div>
      </section>

      <form className="table-toolbar">
        <label className="toolbar-search">
          <Search size={16} />
          <input name="q" placeholder="输入趟次编号、车牌、司机或费用类型" defaultValue={keyword} />
        </label>
        <button className="secondary-button" type="submit">
          <Search size={16} />
          搜索
        </button>
      </form>

      <section className="stat-strip">
        <div>
          <span>匹配结果</span>
          <strong>{total}</strong>
        </div>
        <div>
          <span>趟次</span>
          <strong>{trips.length}</strong>
        </div>
        <div>
          <span>车辆 / 司机</span>
          <strong>{vehicles.length + drivers.length}</strong>
        </div>
      </section>

      {!keyword ? (
        <section className="panel">
          <div className="empty-state">
            <strong>输入关键词开始搜索</strong>
            <span>支持趟次编号、车牌号、司机姓名、手机号和费用类型。</span>
          </div>
        </section>
      ) : (
        <section className="search-result-grid">
          <ResultPanel
            count={trips.length}
            href={`/trips${suffix}`}
            icon={<ClipboardList size={18} />}
            title="趟次"
          >
            {trips.slice(0, 6).map((trip) => (
              <Link className="search-result-row" href={`/trips/${trip.id}`} key={trip.id}>
                <div>
                  <strong>{trip.tripNo}</strong>
                  <span>
                    {trip.vehicle.plateNumber} · {trip.driver.name}
                  </span>
                </div>
                <StatusBadge status={trip.status} />
              </Link>
            ))}
          </ResultPanel>

          <ResultPanel
            count={vehicles.length}
            href={`/vehicles${suffix}`}
            icon={<Car size={18} />}
            title="车辆"
          >
            {vehicles.slice(0, 6).map((vehicle) => (
              <Link className="search-result-row" href={`/vehicles/${vehicle.id}`} key={vehicle.id}>
                <div>
                  <strong>{vehicle.plateNumber}</strong>
                  <span>{vehicle.vehicleType ?? "未填写车型"}</span>
                </div>
                <StatusBadge status={vehicle.status} />
              </Link>
            ))}
          </ResultPanel>

          <ResultPanel
            count={drivers.length}
            href={`/drivers${suffix}`}
            icon={<Users size={18} />}
            title="司机"
          >
            {drivers.slice(0, 6).map((driver) => (
              <Link className="search-result-row" href={`/drivers/${driver.id}`} key={driver.id}>
                <div>
                  <strong>{driver.name}</strong>
                  <span>{driver.phone}</span>
                </div>
                <StatusBadge status={driver.status} />
              </Link>
            ))}
          </ResultPanel>

          <ResultPanel
            count={expenseTypes.length}
            href={`/expense-types${suffix}`}
            icon={<ReceiptText size={18} />}
            title="费用类型"
          >
            {expenseTypes.slice(0, 6).map((type) => (
              <Link
                className="search-result-row"
                href={`/expense-types/${type.id}`}
                key={type.id}
              >
                <div>
                  <strong>{type.name}</strong>
                  <span>{type.requiresReceipt ? "需要凭证" : "无需强制凭证"}</span>
                </div>
                <StatusBadge status={type.enabled ? "enabled" : "disabled"} />
              </Link>
            ))}
          </ResultPanel>
        </section>
      )}
    </AdminShell>
  );
}

function ResultPanel({
  children,
  count,
  href,
  icon,
  title,
}: {
  children: ReactNode;
  count: number;
  href: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h2>
            {icon}
            {title}
          </h2>
          <p>找到 {count} 条结果</p>
        </div>
        <Link className="text-button" href={href}>
          查看全部
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="search-result-list">
        {count > 0 ? (
          children
        ) : (
          <div className="empty-state compact">
            <strong>没有匹配结果</strong>
            <span>换一个关键词试试。</span>
          </div>
        )}
      </div>
    </article>
  );
}
