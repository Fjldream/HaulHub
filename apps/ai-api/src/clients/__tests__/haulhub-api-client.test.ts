import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpHaulHubApiClient } from "../haulhub-api-client";

describe("HttpHaulHubApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests team billing context with the internal service token", async () => {
    const fetchMock = vi.fn(async (_url: URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          vehicles: [{ id: "vehicle-1", plateNumber: "沪A12345", status: "available" }],
          drivers: [
            {
              id: "driver-1",
              name: "司机老王",
              phone: "13900000001",
              status: "active",
              boundVehicleIds: ["vehicle-1"],
            },
          ],
          expenseTypes: [{ id: "expense-type-1", name: "油费", enabled: true }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpHaulHubApiClient({
      baseUrl: "http://localhost:4000/base-path",
      serviceToken: "service-token",
    });

    const context = await client.getTeamBillingContext({ teamId: "team-1", userId: "accountant-1" });

    expect(context.vehicles[0]?.plateNumber).toBe("沪A12345");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0]!;
    const init = requestInit!;
    expect(url.toString()).toBe("http://localhost:4000/internal/ai-billing/context?teamId=team-1&userId=accountant-1");
    expect(init?.headers).toMatchObject({ authorization: "Bearer service-token" });
  });

  it("fails before requesting HaulHub API when the internal service token is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new HttpHaulHubApiClient({
      baseUrl: "http://localhost:4000",
      serviceToken: "",
    });

    await expect(client.getTeamBillingContext({ teamId: "team-1", userId: "accountant-1" })).rejects.toThrow(
      "HAULHUB_SERVICE_TOKEN",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits confirmed manual completed trip payload to HaulHub API", async () => {
    const fetchMock = vi.fn(async (_url: URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ trip: { id: "trip-created", status: "completed" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new HttpHaulHubApiClient({
      baseUrl: "http://localhost:4000/base-path",
      serviceToken: "service-token",
    });

    const result = await client.createManualCompletedTrip({
      teamId: "team-1",
      userId: "accountant-1",
      payload: {
        vehicleId: "vehicle-1",
        driverId: "driver-1",
        customerName: "宏达建材",
        loadLocation: "福州",
        unloadLocation: "厦门",
        actualFreight: "1800.00",
        settledAt: "2026-06-22",
        expenses: [{ expenseTypeId: "expense-type-1", amount: "200.00", occurredAt: "2026-06-22", note: "油费" }],
      },
    });

    expect(result).toEqual({ trip: { id: "trip-created", status: "completed" } });
    const [url, maybeInit] = fetchMock.mock.calls[0]!;
    const init = maybeInit!;
    expect(url.toString()).toBe("http://localhost:4000/admin/trips/manual-completed");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      authorization: "Bearer service-token",
      "content-type": "application/json",
      "x-user-id": "accountant-1",
      "x-user-role": "accountant",
      "x-team-id": "team-1",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      vehicleId: "vehicle-1",
      driverId: "driver-1",
      customerName: "宏达建材",
    });
  });
});
