import type { ApiDriver } from "@/lib/api-client";

export function isDriverBoundToVehicle(driver: ApiDriver, vehicleId: string): boolean {
  if (!vehicleId) {
    return false;
  }

  return Boolean(driver.boundVehicles?.some((vehicle) => vehicle.id === vehicleId));
}

export function getDriversBoundToVehicle(drivers: ApiDriver[], vehicleId: string): ApiDriver[] {
  return drivers.filter((driver) => isDriverBoundToVehicle(driver, vehicleId));
}
