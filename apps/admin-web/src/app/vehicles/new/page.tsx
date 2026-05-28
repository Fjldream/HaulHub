import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { apiPost, apiUploadFile, type ApiVehicle } from "@/lib/api-client";

async function createVehicleAction(formData: FormData) {
  "use server";
  const imageFile = formData.get("imageFile");
  const uploadedImage =
    imageFile instanceof File && imageFile.size > 0 ? await apiUploadFile(imageFile) : null;

  await apiPost<{ vehicle: ApiVehicle }>("/admin/vehicles", {
    plateNumber: String(formData.get("plateNumber") || ""),
    brandModel: String(formData.get("brandModel") || ""),
    vehicleType: String(formData.get("vehicleType") || ""),
    loadCapacityTons: String(formData.get("loadCapacityTons") || ""),
    registeredAt: String(formData.get("registeredAt") || ""),
    insuranceExpiresAt: String(formData.get("insuranceExpiresAt") || ""),
    inspectionExpiresAt: String(formData.get("inspectionExpiresAt") || ""),
    maintenanceDueAt: String(formData.get("maintenanceDueAt") || ""),
    imageUrl: uploadedImage?.url ?? "",
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
          <p>录入车辆档案、维保时间和证件到期信息，后续可在车辆详情继续维护。</p>
        </div>
        <Link className="secondary-button" href="/vehicles">
          <ArrowLeft size={16} />
          返回列表
        </Link>
      </section>

      <form action={createVehicleAction} className="form-panel vehicle-form-panel">
        <section className="form-section">
          <div className="form-section-head">
            <h2>基础档案</h2>
            <p>车牌号必填，品牌型号和载重会展示在车辆管理列表和车辆档案页。</p>
          </div>
          <div className="form-grid">
            <label>
              车牌号
              <input name="plateNumber" placeholder="例如：京A·88888" required />
            </label>
            <label>
              车辆品牌/型号
              <input name="brandModel" placeholder="例如：一汽解放 J6P 旗舰版 6x4" />
            </label>
            <label>
              车辆类型
              <input name="vehicleType" placeholder="例如：重型半挂牵引车" />
            </label>
            <label>
              载重（吨）
              <input name="loadCapacityTons" type="number" min="0" step="0.1" placeholder="例如：40.0" />
            </label>
            <label>
              车辆图片
              <input name="imageFile" type="file" accept="image/*" />
            </label>
            <label>
              备注
              <textarea name="note" placeholder="例如：新购车辆，待绑定司机" />
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <h2>证件与维保</h2>
            <p>维保时间用于车辆列表中的待维保提醒，年检和保险会在车辆详情页展示。</p>
          </div>
          <div className="form-grid">
            <label>
              初次登记日期
              <input name="registeredAt" type="date" />
            </label>
            <label>
              保险到期时间
              <input name="insuranceExpiresAt" type="date" />
            </label>
            <label>
              年检到期时间
              <input name="inspectionExpiresAt" type="date" />
            </label>
            <label>
              下次维保时间
              <input name="maintenanceDueAt" type="date" />
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
