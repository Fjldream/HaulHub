import { describe, expect, it } from "vitest";
import type { ApiTrip } from "@/lib/api-client";
import {
  deriveWorkbenchTripRoutes,
  formatRouteCreatedAt,
  readableRoutePlace,
} from "./workbench-trip-routes-model";

function trip(overrides: Partial<ApiTrip> = {}): ApiTrip {
  return {
    id: "trip-1",
    tripNo: "T20260601001",
    status: "in_progress",
    customerName: "上海冷链",
    loadLocation: "上海仓",
    loadAddress: "上海市浦东新区",
    loadLatitude: 31.2304,
    loadLongitude: 121.4737,
    loadPoiId: null,
    unloadLocation: "苏州仓",
    unloadAddress: "苏州市工业园区",
    unloadLatitude: 31.2989,
    unloadLongitude: 120.5853,
    unloadPoiId: null,
    locationProvider: null,
    estimatedFreight: null,
    actualFreight: null,
    driverNote: null,
    accountingNote: null,
    expenseTotal: "0",
    profit: null,
    profitRate: null,
    returnReason: null,
    createdAt: "2026-05-02T03:04:00+08:00",
    submittedAt: null,
    reviewStartedAt: null,
    completedAt: null,
    vehicle: {
      id: "vehicle-1",
      plateNumber: "沪A12345",
    },
    driver: {
      id: "driver-1",
      name: "王师傅",
    },
    expenses: [],
    ...overrides,
  };
}

describe("deriveWorkbenchTripRoutes", () => {
  it("turns an in-progress trip with complete coordinates into one drawable route", () => {
    const result = deriveWorkbenchTripRoutes([
      trip({
        loadLongitude: 121.5,
        loadLatitude: 31.2,
        unloadLongitude: 120.6,
        unloadLatitude: 31.3,
      }),
    ]);

    expect(result.drawableRoutes).toHaveLength(1);
    expect(result.drawableRoutes[0]).toMatchObject({
      id: "trip-1",
      tripNo: "T20260601001",
      coordinateStatus: "坐标完整",
      detailHref: "/trips/trip-1",
      editHref: "/trips/trip-1/edit",
      origin: {
        place: "上海仓",
        lngLat: [121.5, 31.2],
      },
      destination: {
        place: "苏州仓",
        lngLat: [120.6, 31.3],
      },
    });
    expect(result.missingCoordinateTrips).toEqual([]);
    expect(result.hiddenRouteCount).toBe(0);
  });

  it("puts in-progress trips missing either endpoint coordinate into missingCoordinateTrips", () => {
    const result = deriveWorkbenchTripRoutes([
      trip({ id: "missing-load", loadLatitude: null }),
      trip({ id: "missing-unload", unloadLongitude: null }),
    ]);

    expect(result.drawableRoutes).toEqual([]);
    expect(result.missingCoordinateTrips).toHaveLength(2);
    expect(result.missingCoordinateTrips.map((item) => item.coordinateStatus)).toEqual([
      "待补地点",
      "待补地点",
    ]);
  });

  it("puts invalid coordinates into missingCoordinateTrips", () => {
    const result = deriveWorkbenchTripRoutes([
      trip({ id: "bad-longitude", loadLongitude: 181 }),
      trip({ id: "bad-latitude", unloadLatitude: -91 }),
    ]);

    expect(result.drawableRoutes).toEqual([]);
    expect(result.missingCoordinateTrips).toHaveLength(2);
    expect(result.missingCoordinateTrips.map((item) => item.coordinateStatus)).toEqual([
      "坐标异常",
      "坐标异常",
    ]);
  });

  it("ignores trips that are not in progress", () => {
    const result = deriveWorkbenchTripRoutes([
      trip({ id: "completed", status: "completed" }),
      trip({ id: "pending", status: "pending_review" }),
      trip({ id: "in-progress", status: "in_progress" }),
    ]);

    expect(result.drawableRoutes.map((item) => item.id)).toEqual(["in-progress"]);
    expect(result.missingCoordinateTrips).toEqual([]);
  });

  it("caps drawable routes at 50 and reports the hidden overflow", () => {
    const result = deriveWorkbenchTripRoutes(
      Array.from({ length: 52 }, (_, index) =>
        trip({
          id: `trip-${index + 1}`,
          tripNo: `T${index + 1}`,
          loadLongitude: 100 + index * 0.01,
          unloadLongitude: 101 + index * 0.01,
        }),
      ),
    );

    expect(result.drawableRoutes).toHaveLength(50);
    expect(result.drawableRoutes.at(-1)?.id).toBe("trip-50");
    expect(result.hiddenRouteCount).toBe(2);
  });
});

describe("route display helpers", () => {
  it("formats route created time compactly and falls back for empty values", () => {
    expect(formatRouteCreatedAt("2026-05-02T03:04:00+08:00")).toBe("5月2日 03:04");
    expect(formatRouteCreatedAt("")).toBe("-");
    expect(formatRouteCreatedAt(null)).toBe("-");
  });

  it("returns a readable place or a fallback for empty and placeholder values", () => {
    expect(readableRoutePlace("上海仓")).toBe("上海仓");
    expect(readableRoutePlace("")).toBe("地点待补");
    expect(readableRoutePlace("???")).toBe("地点待补");
    expect(readableRoutePlace(null)).toBe("地点待补");
  });
});
