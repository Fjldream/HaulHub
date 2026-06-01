import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { TripDispatchFields } from "@/components/admin/trip-dispatch-fields";
import { TripLocationPicker } from "@/components/admin/trip-location-picker";
import { redirectWithActionError } from "@/lib/action-errors";
import {
  apiGet,
  apiPost,
  type ApiDriver,
  type ApiTrip,
  type ApiVehicle,
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

async function updateTripAction(formData: FormData) {
  "use server";
  const tripId = String(formData.get("tripId") || "");

  try {
    await apiPost<{ trip: ApiTrip }>(`/admin/trips/${tripId}`, {
      vehicleId: String(formData.get("vehicleId") || ""),
      driverId: String(formData.get("driverId") || ""),
      customerName: String(formData.get("customerName") || ""),
      loadLocation: String(formData.get("loadLocation") || ""),
      loadAddress: String(formData.get("loadAddress") || ""),
      loadLatitude: String(formData.get("loadLatitude") || ""),
      loadLongitude: String(formData.get("loadLongitude") || ""),
      loadPoiId: String(formData.get("loadPoiId") || ""),
      unloadLocation: String(formData.get("unloadLocation") || ""),
      unloadAddress: String(formData.get("unloadAddress") || ""),
      unloadLatitude: String(formData.get("unloadLatitude") || ""),
      unloadLongitude: String(formData.get("unloadLongitude") || ""),
      unloadPoiId: String(formData.get("unloadPoiId") || ""),
      locationProvider: String(formData.get("loadProvider") || formData.get("unloadProvider") || ""),
      estimatedFreight: String(formData.get("estimatedFreight") || ""),
      driverNote: String(formData.get("driverNote") || ""),
      accountingNote: String(formData.get("accountingNote") || ""),
    });
  } catch (error) {
    redirectWithActionError(`/trips/${tripId}/edit`, error, "保存失败，请检查车辆和司机信息");
  }

  redirect(`/trips/${tripId}`);
}

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const [{ trip }, { vehicles }, { drivers }] = await Promise.all([
    apiGet<{ trip: ApiTrip }>(`/admin/trips/${tripId}`),
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    apiGet<{ drivers: ApiDriver[] }>("/admin/drivers"),
  ]);
  const isClosed = ["completed", "cancelled"].includes(trip.status);
  const availableVehicles = vehicles.filter(
    (vehicle) => vehicle.status === "available" || vehicle.id === trip.vehicle.id,
  );
  const activeDrivers = drivers.filter(
    (driver) => driver.status === "active" || driver.id === trip.driver.id,
  );

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>编辑趟次</h1>
          <p>{trip.tripNo} - 已完成或已撤销的趟次不能直接修改。</p>
        </div>
        <div className="button-row">
          <StatusBadge status={trip.status} />
          <Link className="secondary-button" href={`/trips/${trip.id}`}>
            <ArrowLeft size={16} />
            返回详情
          </Link>
        </div>
      </section>

      {isClosed ? (
        <section className="empty-state">
          <strong>该趟次已结束</strong>
          <span>已完成或已撤销的账单默认不允许直接修改，后续可通过操作记录追溯。</span>
        </section>
      ) : (
        <form action={updateTripAction} className="form-panel">
          <input type="hidden" name="tripId" value={trip.id} />
          <section className="form-section">
            <div className="form-section-head">
              <h2>派车信息</h2>
              <p>更换车辆后，只能选择已绑定该车辆的司机。</p>
            </div>
            <div className="form-grid">
              <TripDispatchFields
                vehicles={availableVehicles}
                drivers={activeDrivers}
                initialVehicleId={trip.vehicle.id}
                initialDriverId={trip.driver.id}
              />
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>趟次内容</h2>
              <p>司机端只展示路线、客户和司机备注，不展示运费与利润。</p>
            </div>
            <div className="form-grid">
              <label>
                客户名称
                <input name="customerName" required defaultValue={trip.customerName} />
              </label>
              <label>
                预计运费
                <input
                  inputMode="decimal"
                  name="estimatedFreight"
                  pattern="\d+(\.\d{1,2})?"
                  required
                  defaultValue={trip.estimatedFreight ?? ""}
                />
              </label>
              <TripLocationPicker
                label="装货地"
                fieldPrefix="load"
                placeholder="例如：上海嘉定物流园"
                initialValue={{
                  location: trip.loadLocation,
                  address: trip.loadAddress,
                  latitude: trip.loadLatitude,
                  longitude: trip.loadLongitude,
                  poiId: trip.loadPoiId,
                  provider: trip.locationProvider,
                }}
              />
              <TripLocationPicker
                label="卸货地"
                fieldPrefix="unload"
                placeholder="例如：杭州萧山仓库"
                initialValue={{
                  location: trip.unloadLocation,
                  address: trip.unloadAddress,
                  latitude: trip.unloadLatitude,
                  longitude: trip.unloadLongitude,
                  poiId: trip.unloadPoiId,
                  provider: trip.locationProvider,
                }}
              />
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>备注</h2>
              <p>司机备注会展示给司机，会计内部备注仅后台可见。</p>
            </div>
            <div className="form-grid">
              <label>
                给司机看的备注
                <textarea
                  name="driverNote"
                  defaultValue={trip.driverNote ?? ""}
                  placeholder="例如：到仓库后联系王经理"
                />
              </label>
              <label>
                管理内部备注
                <textarea
                  name="accountingNote"
                  defaultValue={trip.accountingNote ?? ""}
                  placeholder="例如：回单后确认运费"
                />
              </label>
            </div>
          </section>

          <div className="form-actions">
            <Link className="secondary-button" href={`/trips/${trip.id}`}>
              取消
            </Link>
            <button className="primary-button" type="submit">
              <Save size={16} />
              保存修改
            </button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}

