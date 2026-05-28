import { Edit3, Eye } from "lucide-react";
import Link from "next/link";
import { formatDateTime, formatMoney, type ApiTrip } from "@/lib/api-client";
import { StatusBadge } from "./status-badge";

export function TripTable({ trips }: { trips: ApiTrip[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>趟次编号</th>
            <th>车牌</th>
            <th>司机</th>
            <th>客户/路线</th>
            <th>状态</th>
            <th>提交时间</th>
            <th className="num">实际运费</th>
            <th className="num">费用合计</th>
            <th className="num">利润</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr key={trip.id}>
              <td className="strong">{trip.tripNo}</td>
              <td>{trip.vehicle.plateNumber}</td>
              <td>{trip.driver.name}</td>
              <td>
                <div className="cell-stack">
                  <strong>{trip.customerName}</strong>
                  <span>
                    {trip.loadLocation} -&gt; {trip.unloadLocation}
                  </span>
                </div>
              </td>
              <td>
                <StatusBadge status={trip.status} />
              </td>
              <td>{formatDateTime(trip.submittedAt)}</td>
              <td className="num">{formatMoney(trip.actualFreight)}</td>
              <td className="num">{formatMoney(trip.expenseTotal)}</td>
              <td className="num profit">{formatMoney(trip.profit)}</td>
              <td>
                <div className="table-actions">
                  <Link className="icon-link" href={`/trips/${trip.id}`} title="查看账单">
                    <Eye size={16} />
                  </Link>
                  {!["completed", "cancelled"].includes(trip.status) ? (
                    <Link className="icon-link" href={`/trips/${trip.id}/edit`} title="编辑趟次">
                      <Edit3 size={16} />
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
