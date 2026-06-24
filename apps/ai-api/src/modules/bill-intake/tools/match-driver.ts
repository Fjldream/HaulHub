import type { Confidence } from "../domain/types";
import type { DriverContext } from "./context";

export function matchDriver(input: {
  driverName?: string | null;
  phone?: string | null;
  vehicleId?: string | null;
  drivers: DriverContext[];
}) {
  const name = input.driverName?.trim();
  const phone = input.phone?.trim();
  const activeDrivers = input.drivers.filter((driver) => driver.status === "active");
  const exact = activeDrivers.filter(
    (driver) => (name && driver.name === name) || (phone && driver.phone === phone),
  );
  const candidates =
    exact.length > 0
      ? exact
      : activeDrivers.filter(
          (driver) =>
            (name && (driver.name.includes(name) || name.includes(driver.name))) ||
            (phone && driver.phone?.includes(phone)),
        );
  const vehicleBoundCandidates = input.vehicleId
    ? candidates.filter((driver) => driver.boundVehicleIds?.includes(input.vehicleId ?? ""))
    : candidates;
  const finalCandidates = vehicleBoundCandidates.length > 0 ? vehicleBoundCandidates : candidates;
  const confidence: Confidence = exact.length === 1 ? "high" : finalCandidates.length === 1 ? "medium" : "low";

  return {
    candidates: finalCandidates.map((driver) => ({ id: driver.id, name: driver.name, phone: driver.phone })),
    bestMatchId: finalCandidates.length === 1 ? finalCandidates[0]?.id : undefined,
    confidence,
    unique: finalCandidates.length === 1,
    boundToVehicle:
      input.vehicleId && finalCandidates.length === 1
        ? Boolean(finalCandidates[0]?.boundVehicleIds?.includes(input.vehicleId))
        : undefined,
  };
}
