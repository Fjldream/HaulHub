import { describe, expect, it } from "vitest";
import { getDriversBoundToVehicle } from "./trip-dispatch-fields-model";
import type { ApiDriver, ApiVehicle } from "@/lib/api-client";

function vehicle(id: string, plateNumber = id): ApiVehicle {
  return {
    id,
    plateNumber,
    status: "available",
    vehicleType: null,
  };
}

function driver(id: string, boundVehicles?: ApiVehicle[]): ApiDriver {
  return {
    id,
    name: id,
    phone: "13800000000",
    status: "active",
    boundVehicles,
  };
}

describe("getDriversBoundToVehicle", () => {
  it("only returns drivers bound to the selected vehicle", () => {
    const truckA = vehicle("truck-a");
    const truckB = vehicle("truck-b");
    const drivers = [
      driver("bound-a", [truckA]),
      driver("bound-b", [truckB]),
      driver("unbound", []),
      driver("missing-binding"),
    ];

    expect(getDriversBoundToVehicle(drivers, truckA.id).map((item) => item.id)).toEqual([
      "bound-a",
    ]);
  });

  it("returns no drivers before a vehicle is selected", () => {
    expect(getDriversBoundToVehicle([driver("bound-a", [vehicle("truck-a")])], "")).toEqual([]);
  });
});
