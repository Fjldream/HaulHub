"use client";

import { useMemo, useState } from "react";
import type { ApiDriver, ApiVehicle } from "@/lib/api-client";
import { getDriversBoundToVehicle } from "./trip-dispatch-fields-model";

interface TripDispatchFieldsProps {
  vehicles: ApiVehicle[];
  drivers: ApiDriver[];
  initialVehicleId?: string;
  initialDriverId?: string;
  initialAssistantDriverIds?: string[];
}

export function TripDispatchFields({
  vehicles,
  drivers,
  initialVehicleId = "",
  initialDriverId = "",
  initialAssistantDriverIds = [],
}: TripDispatchFieldsProps) {
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const eligibleDrivers = useMemo(
    () => getDriversBoundToVehicle(drivers, vehicleId),
    [drivers, vehicleId],
  );
  const [requestedDriverId, setRequestedDriverId] = useState(initialDriverId);
  const [assistantDriverIds, setAssistantDriverIds] = useState(initialAssistantDriverIds);
  const driverId = eligibleDrivers.some((driver) => driver.id === requestedDriverId)
    ? requestedDriverId
    : "";
  const assistantCandidates = eligibleDrivers.filter((driver) => driver.id !== driverId);
  const selectedAssistantDriverIds = assistantDriverIds.filter((id) =>
    assistantCandidates.some((driver) => driver.id === id),
  );

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
            setAssistantDriverIds([]);
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
      <fieldset className="form-fieldset">
        <legend>协同司机（可选）</legend>
        {assistantCandidates.length > 0 ? (
          <div className="assistant-driver-options">
            {assistantCandidates.map((driver) => {
              const checked = selectedAssistantDriverIds.includes(driver.id);
              return (
                <label key={driver.id} className="assistant-driver-option">
                  <input
                    type="checkbox"
                    name="assistantDriverIds"
                    value={driver.id}
                    checked={checked}
                    onChange={(event) => {
                      setAssistantDriverIds((current) =>
                        event.target.checked
                          ? Array.from(new Set([...current, driver.id]))
                          : current.filter((id) => id !== driver.id),
                      );
                    }}
                  />
                  <span className="assistant-driver-option-body">
                    <strong>{driver.name}</strong>
                    <small>{driver.phone}</small>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <span className="form-hint">选择主司机后，可从同车绑定司机中选择协同司机。</span>
        )}
      </fieldset>
    </>
  );
}
