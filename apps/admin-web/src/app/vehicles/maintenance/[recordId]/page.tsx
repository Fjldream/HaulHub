import { ArrowLeft, CalendarDays, FileText, ReceiptText, Truck, Wrench } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiGet, formatDateTime, formatMoney, type ApiVehicleMaintenance } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function VehicleMaintenanceDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const { record } = await apiGet<{ record: ApiVehicleMaintenance }>(
    `/admin/vehicle-maintenance/${recordId}`,
  );

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>维修详情</h1>
          <p>查看单条车辆维修费用的项目、凭证、录入人和关联车辆。</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" href={`/vehicles/${record.vehicle.id}`}>
            <ArrowLeft size={16} />
            返回车辆
          </Link>
          <Link className="secondary-button" href={`/vehicles/maintenance?vehicleId=${record.vehicle.id}`}>
            维修记录
          </Link>
        </div>
      </section>

      <section className="detail-layout maintenance-detail-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>
                <Wrench size={18} />
                {record.component}
              </h2>
              <p>{record.note || "暂无备注"}</p>
            </div>
            <strong className="maintenance-detail-amount">{formatMoney(record.amount)}</strong>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>维修车辆</dt>
              <dd>{record.vehicle.plateNumber}</dd>
            </div>
            <div>
              <dt>维修日期</dt>
              <dd>{formatDateTime(record.occurredAt)}</dd>
            </div>
            <div>
              <dt>录入人</dt>
              <dd>{record.creator.name}</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{formatDateTime(record.createdAt)}</dd>
            </div>
            <div>
              <dt>凭证</dt>
              <dd>{record.voucherStorageKey || "无凭证"}</dd>
            </div>
            <div>
              <dt>记录编号</dt>
              <dd>{record.id}</dd>
            </div>
          </dl>
        </div>

        <aside className="review-panel">
          <h2>关联操作</h2>
          <Link className="secondary-button" href={`/vehicles/${record.vehicle.id}`}>
            <Truck size={16} />
            查看车辆档案
          </Link>
          <Link className="secondary-button" href={`/vehicles/maintenance?vehicleId=${record.vehicle.id}`}>
            <ReceiptText size={16} />
            查看车辆维修台账
          </Link>
          <div className="review-note">
            <CalendarDays size={16} />
            维修费用会计入利润统计中的车辆维修支出。
          </div>
          <div className="review-note">
            <FileText size={16} />
            后续如果加入凭证上传，这里可以直接展示票据图片。
          </div>
        </aside>
      </section>
    </AdminShell>
  );
}
