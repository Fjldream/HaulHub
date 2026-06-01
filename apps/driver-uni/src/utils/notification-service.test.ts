import { describe, expect, it, vi } from "vitest";
import { fetchUnreadDriverNoticeCount } from "./notification-service";
import type { DriverTrip } from "@/api/client";

function trip(input: Partial<DriverTrip> & Pick<DriverTrip, "id" | "rawStatus">): DriverTrip {
  return {
    id: input.id,
    plateNumber: input.plateNumber ?? `TEST-${input.id}`,
    customerName: input.customerName ?? "测试客户",
    loadLocation: input.loadLocation ?? "装货地",
    loadAddress: input.loadAddress ?? null,
    loadLatitude: input.loadLatitude ?? null,
    loadLongitude: input.loadLongitude ?? null,
    loadPoiId: input.loadPoiId ?? null,
    unloadLocation: input.unloadLocation ?? "卸货地",
    unloadAddress: input.unloadAddress ?? null,
    unloadLatitude: input.unloadLatitude ?? null,
    unloadLongitude: input.unloadLongitude ?? null,
    unloadPoiId: input.unloadPoiId ?? null,
    locationProvider: input.locationProvider ?? null,
    rawCreatedAt: input.rawCreatedAt ?? "2026-05-31T00:00:00.000Z",
    rawStatus: input.rawStatus,
    status: input.status ?? input.rawStatus,
    plannedAt: input.plannedAt ?? "2026-05-31",
    driverNote: input.driverNote ?? "请补充后重新提交",
    expenseTotal: input.expenseTotal ?? "0.00",
    missingItems: input.missingItems ?? [],
    canEdit: input.canEdit ?? false,
    canStart: input.canStart ?? false,
    canSubmit: input.canSubmit ?? false,
  };
}

describe("fetchUnreadDriverNoticeCount", () => {
  it("loads all driver trips once and counts notifications across every status", async () => {
    const loadTrips = vi.fn(async () => [
      trip({ id: "assigned", rawStatus: "assigned" }),
      trip({ id: "submitted", rawStatus: "submitted", missingItems: ["油费票据"] }),
      trip({ id: "completed", rawStatus: "completed" }),
      trip({ id: "returned", rawStatus: "returned" }),
    ]);

    const count = await fetchUnreadDriverNoticeCount(loadTrips, {
      settings: { newTicketNotify: true, missingReceiptNotify: true },
      readIds: [],
    });

    expect(loadTrips).toHaveBeenCalledTimes(1);
    expect(loadTrips).toHaveBeenCalledWith();
    expect(count).toBe(4);
  });
});
