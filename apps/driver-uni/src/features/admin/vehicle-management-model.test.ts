import { describe, expect, it } from "vitest";
import {
  getBindableDrivers,
  validateVehicleForm,
  vehicleStatusText,
  type VehicleForm,
} from "./vehicle-management-model";

function form(input: Partial<VehicleForm> = {}): VehicleForm {
  return {
    plateNumber: "沪A12345",
    vehicleType: "厢式货车",
    brandModel: "东风天锦",
    loadCapacityTons: "12.5",
    registeredAt: "2026-06-16",
    insuranceExpiresAt: "2027-06-16",
    inspectionExpiresAt: "2027-06-16",
    maintenanceDueAt: "2026-12-16",
    imageUrl: "",
    note: "",
    status: "available",
    ...input,
  };
}

describe("vehicle management model", () => {
  it("returns no errors for a valid form", () => {
    expect(validateVehicleForm(form())).toEqual([]);
    expect(validateVehicleForm(form({ loadCapacityTons: "" }))).toEqual([]);
    expect(validateVehicleForm(form({ loadCapacityTons: "0" }))).toEqual([]);
  });

  it("rejects missing plate and invalid capacity values", () => {
    expect(validateVehicleForm(form({ plateNumber: "   " }))).toContain("请填写车牌号");
    expect(validateVehicleForm(form({ loadCapacityTons: "-1" }))).toContain("核载吨位不能为负数");
    expect(validateVehicleForm(form({ loadCapacityTons: "abc" }))).toContain("请填写正确的核载吨位");
    expect(validateVehicleForm(form({ loadCapacityTons: "1.234" }))).toContain(
      "请填写正确的核载吨位",
    );
  });

  it("requires a selected status", () => {
    expect(validateVehicleForm(form({ status: "" }))).toEqual(["请选择车辆状态"]);
  });

  it("returns active drivers that are not already bound", () => {
    const drivers = [
      { id: "driver-1", name: "张师傅", status: "active" },
      { id: "driver-2", name: "李师傅", status: "disabled" },
      { id: "driver-3", name: "王师傅", status: "active" },
    ];

    expect(getBindableDrivers(drivers, ["driver-3"])).toEqual([drivers[0]]);
  });

  it("maps vehicle status labels", () => {
    expect(vehicleStatusText("available")).toBe("可用");
    expect(vehicleStatusText("maintenance")).toBe("维修");
    expect(vehicleStatusText("disabled")).toBe("停用");
    expect(vehicleStatusText("archived")).toBe("archived");
  });
});
