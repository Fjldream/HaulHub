import { beforeEach, describe, expect, it, vi } from "vitest";

type RequestCall = {
  url: string;
  method?: string;
  data?: unknown;
};

const apiAdminTrip = {
  id: "trip-1",
  tripNo: "T-001",
  status: "completed",
  customerName: "Customer A",
  loadLocation: "Load",
  loadAddress: null,
  loadLatitude: null,
  loadLongitude: null,
  loadPoiId: null,
  unloadLocation: "Unload",
  unloadAddress: null,
  unloadLatitude: null,
  unloadLongitude: null,
  unloadPoiId: null,
  locationProvider: null,
  expenseTotal: "88.00",
  estimatedFreight: null,
  actualFreight: "1000.00",
  profit: "912.00",
  driverNote: null,
  accountingNote: null,
  createdAt: "2026-06-16T00:00:00.000Z",
  submittedAt: null,
  returnReason: null,
  vehicle: { id: "vehicle-1", plateNumber: "沪A12345" },
  driver: { id: "driver-1", name: "Driver A" },
  expenses: [],
};

const apiVehicle = {
  id: "vehicle-1",
  plateNumber: "沪A12345",
  status: "available",
  operationalStatus: "idle",
  vehicleType: "truck",
  brandModel: "Dongfeng",
  loadCapacityTons: "12.50",
  registeredAt: "2026-01-01",
  insuranceExpiresAt: "2027-01-01",
  inspectionExpiresAt: "2027-01-01",
  maintenanceDueAt: "2026-12-01",
  unfinishedTripCount: 0,
  latestMaintenanceAt: null,
  imageUrl: "",
  note: "",
  boundDrivers: [{ id: "driver-1", name: "Driver A", phone: "13800000000", status: "active" }],
};

const apiCreatedVehicle = {
  id: "vehicle-2",
  plateNumber: "沪B67890",
  status: "available",
  vehicleType: null,
  brandModel: null,
  loadCapacityTons: null,
  registeredAt: null,
  insuranceExpiresAt: null,
  inspectionExpiresAt: null,
  maintenanceDueAt: null,
  latestMaintenanceAt: null,
  imageUrl: null,
  note: null,
};

async function importClient(responseData: unknown) {
  vi.resetModules();
  const calls: RequestCall[] = [];
  vi.stubGlobal("uni", {
    getStorageSync: vi.fn(() => ({ userId: "admin-1", role: "accountant", teamId: "team-1" })),
    request: vi.fn((options) => {
      calls.push({
        url: options.url,
        method: options.method,
        data: options.data,
      });
      options.success({ statusCode: 200, data: responseData });
    }),
  });

  const client = await import("@/api/client");
  return { client, calls };
}

describe("admin assets api client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates manual completed trips with nested total expense and maps admin trip fields", async () => {
    const { client, calls } = await importClient({ trip: apiAdminTrip });

    const trip = await client.createAdminManualCompletedTrip({
      vehicleId: "vehicle-1",
      driverId: "driver-1",
      customerName: "Customer A",
      loadLocation: "Load",
      unloadLocation: "Unload",
      actualFreight: "1000.00",
      settledAt: "2026-06-16",
      totalExpense: { amount: "88.00" },
    });

    expect(calls[0]).toMatchObject({
      url: "http://localhost:4000/admin/trips/manual-completed",
      method: "POST",
      data: expect.objectContaining({
        totalExpense: { amount: "88.00" },
      }),
    });
    expect(trip).toMatchObject({
      id: "trip-1",
      status: "completed",
      customerName: "Customer A",
      vehicleId: "vehicle-1",
      vehiclePlate: "沪A12345",
      driverId: "driver-1",
      driverName: "Driver A",
    });
  });

  it("fetches admin vehicles with search and status query", async () => {
    const { client, calls } = await importClient({ vehicles: [apiVehicle] });

    const vehicles = await client.fetchAdminVehicles("沪A", "available");

    expect(calls[0]).toMatchObject({
      url: "http://localhost:4000/admin/vehicles?q=%E6%B2%AAA&status=available",
      method: "GET",
    });
    expect(vehicles).toEqual([apiVehicle]);
  });

  it("fetches one admin vehicle by exact endpoint and normalizes missing bound drivers", async () => {
    const vehicleWithoutDrivers = { ...apiCreatedVehicle };
    const { client, calls } = await importClient({ vehicle: vehicleWithoutDrivers });

    const vehicle = await client.fetchAdminVehicle("vehicle-2");

    expect(calls[0]).toStrictEqual({
      url: "http://localhost:4000/admin/vehicles/vehicle-2",
      method: "GET",
      data: undefined,
    });
    expect(vehicle).toEqual({ ...vehicleWithoutDrivers, boundDrivers: [] });
  });

  it("creates admin vehicles without status and normalizes missing bound drivers", async () => {
    const { client, calls } = await importClient({ vehicle: apiCreatedVehicle });

    const vehicle = await client.createAdminVehicle({
      plateNumber: "沪B67890",
    });

    expect(calls[0]).toStrictEqual({
      url: "http://localhost:4000/admin/vehicles",
      method: "POST",
      data: { plateNumber: "沪B67890" },
    });
    expect(calls[0].data).not.toHaveProperty("status");
    expect(vehicle).toEqual({ ...apiCreatedVehicle, boundDrivers: [] });
  });

  it("updates admin vehicles", async () => {
    const { client, calls } = await importClient({ vehicle: apiVehicle });

    const vehicle = await client.updateAdminVehicle("vehicle-1", {
      plateNumber: "沪A12345",
      status: "maintenance",
    });

    expect(calls[0]).toMatchObject({
      url: "http://localhost:4000/admin/vehicles/vehicle-1",
      method: "POST",
      data: { plateNumber: "沪A12345", status: "maintenance" },
    });
    expect(vehicle).toEqual(apiVehicle);
  });

  it("binds and unbinds admin vehicle drivers with exact endpoints", async () => {
    const { client, calls } = await importClient({});

    await client.bindAdminVehicleDriver("vehicle-1", "driver-1");
    await client.unbindAdminVehicleDriver("vehicle-1", "driver-1");

    expect(calls).toEqual([
      {
        url: "http://localhost:4000/admin/vehicles/vehicle-1/drivers",
        method: "POST",
        data: { driverId: "driver-1" },
      },
      {
        url: "http://localhost:4000/admin/vehicles/vehicle-1/drivers/driver-1/unbind",
        method: "POST",
        data: {},
      },
    ]);
  });
});
