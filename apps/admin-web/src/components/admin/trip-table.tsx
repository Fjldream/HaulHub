import Link from "next/link";
import { Eye } from "lucide-react";
import { trips } from "@/lib/mock-data";
import { StatusBadge } from "./status-badge";

export function TripTable() {
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
              <td>{trip.plateNumber}</td>
              <td>{trip.driver}</td>
              <td>
                <div className="cell-stack">
                  <strong>{trip.customer}</strong>
                  <span>{trip.route}</span>
                </div>
              </td>
              <td>
                <StatusBadge status={trip.status} />
              </td>
              <td>{trip.submittedAt}</td>
              <td className="num">{trip.actualFreight}</td>
              <td className="num">{trip.expenseTotal}</td>
              <td className="num profit">{trip.profit}</td>
              <td>
                <Link className="icon-link" href={`/trips/${trip.id}`} title="查看账单">
                  <Eye size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
