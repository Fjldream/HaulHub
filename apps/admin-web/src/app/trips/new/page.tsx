import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { DecimalInput } from "@/components/admin/decimal-input";
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

async function createTripAction(formData: FormData) {
  "use server";
  try {
    await apiPost<{ trip: ApiTrip }>("/admin/trips", {
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
    redirectWithActionError("/trips/new", error);
  }
  redirect("/trips");
}

export default async function NewTripPage() {
  const [{ vehicles }, { drivers }] = await Promise.all([
    apiGet<{ vehicles: ApiVehicle[] }>("/admin/vehicles"),
    apiGet<{ drivers: ApiDriver[] }>("/admin/drivers"),
  ]);
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === "available");
  const activeDrivers = drivers.filter((driver) => driver.status === "active");

  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>创建趟次</h1>
          <p>分配车辆和司机，填写客户、路线与预计运费。</p>
        </div>
        <Link className="secondary-button" href="/trips">
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </section>

      <form action={createTripAction} className="form-panel">
        <section className="form-section">
          <div className="form-section-head">
            <h2>派车信息</h2>
            <p>选择车辆后，只显示已绑定该车辆的在职司机。</p>
          </div>
          <div className="form-grid">
            <TripDispatchFields vehicles={availableVehicles} drivers={activeDrivers} />
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <h2>趟次内容</h2>
            <p>这些信息会同步给司机端，但不会暴露运费和利润。</p>
          </div>
          <div className="form-grid">
            <label>
              客户名称
              <input name="customerName" required placeholder="例如：恒通物流" />
            </label>
            <label>
              预计运费
              <DecimalInput
                labelText="预计运费"
                name="estimatedFreight"
                placeholder="例如：1800.00"
                required
              />
            </label>
            <TripLocationPicker label="装货地" fieldPrefix="load" placeholder="例如：上海嘉定物流园" />
            <TripLocationPicker label="卸货地" fieldPrefix="unload" placeholder="例如：杭州萧山仓库" />
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <h2>备注</h2>
            <p>司机备注会展示在司机端，会计备注仅后台可见。</p>
          </div>
          <div className="form-grid">
            <label>
              给司机看的备注
              <textarea name="driverNote" placeholder="例如：到仓库后联系王经理" />
            </label>
            <label>
              会计内部备注
              <textarea name="accountingNote" placeholder="例如：回单后确认实际运费" />
            </label>
          </div>
        </section>

        <div className="form-actions">
          <Link className="secondary-button" href="/trips">
            取消
          </Link>
          <button className="primary-button" type="submit">
            <Save size={16} />
            保存趟次
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
