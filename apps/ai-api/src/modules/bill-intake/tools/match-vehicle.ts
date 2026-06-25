import type { Confidence } from "../domain/types";
import type { VehicleContext } from "./context";

/**
 * 根据识别到的车牌文本匹配系统车辆。
 *
 * 只匹配可用车辆；唯一精确匹配返回高置信度，唯一模糊匹配返回中置信度。
 */
export function matchVehicle(input: { plateNumber?: string | null; vehicles: VehicleContext[] }) {
  const value = input.plateNumber?.trim();
  const availableVehicles = input.vehicles.filter((vehicle) => vehicle.status === "available");
  const exact = value ? availableVehicles.filter((vehicle) => vehicle.plateNumber === value) : [];
  const candidates =
    exact.length > 0
      ? exact
      : value
        ? availableVehicles.filter(
            (vehicle) => vehicle.plateNumber.includes(value) || value.includes(vehicle.plateNumber),
          )
        : [];
  const confidence: Confidence = exact.length === 1 ? "high" : candidates.length === 1 ? "medium" : "low";

  return {
    candidates: candidates.map((vehicle) => ({ id: vehicle.id, plateNumber: vehicle.plateNumber })),
    bestMatchId: candidates.length === 1 ? candidates[0]?.id : undefined,
    confidence,
    unique: candidates.length === 1,
  };
}
