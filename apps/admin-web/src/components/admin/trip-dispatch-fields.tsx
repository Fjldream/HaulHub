"use client";

import { useMemo, useState } from "react";
import type { ApiDriver, ApiVehicle } from "@/lib/api-client";
import { getDriversBoundToVehicle } from "./trip-dispatch-fields-model";

interface TripDispatchFieldsProps {
  vehicles: ApiVehicle[];
  drivers: ApiDriver[];
  initialVehicleId?: string;
  initialDriverId?: string;
}

export function TripDispatchFields({
  vehicles,
  drivers,
  initialVehicleId = "",
  initialDriverId = "",
}: TripDispatchFieldsProps) {
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const eligibleDrivers = useMemo(
    () => getDriversBoundToVehicle(drivers, vehicleId),
    [drivers, vehicleId],
  );
  const [requestedDriverId, setRequestedDriverId] = useState(initialDriverId);
  const driverId = eligibleDrivers.some((driver) => driver.id === requestedDriverId)
    ? requestedDriverId
    : "";

  const driverPlaceholder = vehicleId ? "该车辆暂无绑定司机" : "请先选择车辆";

  return (
    <>
      <label>
        车辆
        <select
          name="vehicleId"
          required
          value={vehicleId}
          onChange={(event) => {
            setVehicleId(event.target.value);
            setRequestedDriverId("");
          }}
        >
          <option value="" disabled>
            选择车辆
          </option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plateNumber}
              {vehicle.vehicleType ? ` - ${vehicle.vehicleType}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        司机
        <select
          name="driverId"
          required
          disabled={!vehicleId || eligibleDrivers.length === 0}
          value={driverId}
          onChange={(event) => setRequestedDriverId(event.target.value)}
        >
          <option value="" disabled>
            {eligibleDrivers.length > 0 ? "选择司机" : driverPlaceholder}
          </option>
          {eligibleDrivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name} - {driver.phone}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
