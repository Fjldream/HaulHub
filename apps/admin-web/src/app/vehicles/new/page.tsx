import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiPost, type ApiVehicle } from "@/lib/api-client";

async function createVehicleAction(formData: FormData) {
  "use server";
  await apiPost<{ vehicle: ApiVehicle }>("/admin/vehicles", {
    plateNumber: String(formData.get("plateNumber") || ""),
    vehicleType: String(formData.get("vehicleType") || ""),
    note: String(formData.get("note") || ""),
  });
  redirect("/vehicles");
}

export default function NewVehiclePage() {
  return (
    <AdminShell>
      <section className="page-heading">
        <div>
          <h1>新增车辆</h1>
          <p>录入车牌、车型和备注，新车辆默认可用。</p>
        </div>
        <Link className="secondary-button" href="/vehicles">
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </section>
      <form action={createVehicleAction} className="form-panel">
        <section className="form-section">
          <div className="form-section-head">
            <h2>车辆信息</h2>
            <p>车牌号必须唯一，维修或停用状态后续可在编辑页调整。</p>
          </div>
          <div className="form-grid">
            <label>
              车牌号
              <input name="plateNumber" placeholder="例如：沪D·88990" required />
            </label>
            <label>
              车型
              <input name="vehicleType" placeholder="例如：4.2米厢式货车" />
            </label>
            <label>
              备注
              <textarea name="note" placeholder="例如：新购车辆，待绑定司机" />
            </label>
          </div>
        </section>
        <div className="form-actions">
          <Link className="secondary-button" href="/vehicles">
            取消
          </Link>
          <button className="primary-button" type="submit">
            <Save size={16} />
            保存车辆
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
