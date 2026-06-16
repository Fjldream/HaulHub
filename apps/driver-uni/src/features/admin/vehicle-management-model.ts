export type VehicleStatus = "available" | "maintenance" | "disabled" | "";

export interface VehicleForm {
  plateNumber: string;
  vehicleType: string;
  brandModel: string;
  loadCapacityTons: string;
  registeredAt: string;
  insuranceExpiresAt: string;
  inspectionExpiresAt: string;
  maintenanceDueAt: string;
  imageUrl: string;
  note: string;
  status: VehicleStatus;
}

interface DriverOption {
  id: string;
  status: string;
}

const DECIMAL_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export function validateVehicleForm(form: VehicleForm): string[] {
  const errors: string[] = [];
  const loadCapacity = form.loadCapacityTons.trim();

  if (form.plateNumber.trim() === "") {
    errors.push("请填写车牌号");
  }

  if (loadCapacity !== "") {
    if (loadCapacity.startsWith("-") && DECIMAL_PATTERN.test(loadCapacity.slice(1))) {
      errors.push("核载吨位不能为负数");
    } else if (!DECIMAL_PATTERN.test(loadCapacity)) {
      errors.push("请填写正确的核载吨位");
    }
  }

  if (form.status === "") {
    errors.push("请选择车辆状态");
  }

  return errors;
}

export function getBindableDrivers<T extends DriverOption>(drivers: T[], boundDriverIds: string[]): T[] {
  const boundDriverIdSet = new Set(boundDriverIds);

  return drivers.filter((driver) => driver.status === "active" && !boundDriverIdSet.has(driver.id));
}

export function vehicleStatusText(status: string): string {
  const labels: Record<Exclude<VehicleStatus, "">, string> = {
    available: "可用",
    maintenance: "维修",
    disabled: "停用",
  };

  return labels[status as Exclude<VehicleStatus, "">] ?? status;
}
