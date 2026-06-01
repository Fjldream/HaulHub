import { describe, expect, it } from "vitest";
import {
  buildAmapNavigationUrl,
  buildAmapSearchUrl,
  getTripLocationTarget,
  type NavigableTrip,
} from "./map-navigation";

function trip(input: Partial<NavigableTrip> = {}): NavigableTrip {
  return {
    loadLocation: "上海嘉定物流园3号门",
    loadAddress: "上海市嘉定区胜辛路88号",
    loadLatitude: 31.366942,
    loadLongitude: 121.250801,
    unloadLocation: "杭州萧山仓库A区",
    unloadAddress: "杭州市萧山区建设一路99号",
    unloadLatitude: 30.183806,
    unloadLongitude: 120.264253,
    ...input,
  };
}

describe("map navigation helpers", () => {
  it("builds an amap navigation url with gcj02 longitude and latitude", () => {
    expect(
      buildAmapNavigationUrl({
        name: "上海嘉定物流园3号门",
        latitude: 31.366942,
        longitude: 121.250801,
      }),
    ).toBe(
      "amapuri://route/plan/?sourceApplication=HaulHub&dlat=31.366942&dlon=121.250801&dname=%E4%B8%8A%E6%B5%B7%E5%98%89%E5%AE%9A%E7%89%A9%E6%B5%81%E5%9B%AD3%E5%8F%B7%E9%97%A8&dev=0&t=0",
    );
  });

  it("builds amap urls when URLSearchParams is unavailable in mini program runtime", () => {
    const original = globalThis.URLSearchParams;
    try {
      (globalThis as unknown as { URLSearchParams?: typeof URLSearchParams }).URLSearchParams = undefined;

      expect(
        buildAmapNavigationUrl({
          name: "Dock A",
          latitude: 31.366942,
          longitude: 121.250801,
        }),
      ).toBe(
        "amapuri://route/plan/?sourceApplication=HaulHub&dlat=31.366942&dlon=121.250801&dname=Dock%20A&dev=0&t=0",
      );
      expect(buildAmapSearchUrl("Dock A")).toBe(
        "https://uri.amap.com/search?keyword=Dock%20A&view=map",
      );
    } finally {
      globalThis.URLSearchParams = original;
    }
  });

  it("returns a precise load location target when coordinates exist", () => {
    expect(getTripLocationTarget(trip(), "load")).toEqual({
      name: "上海嘉定物流园3号门",
      address: "上海市嘉定区胜辛路88号",
      latitude: 31.366942,
      longitude: 121.250801,
      precise: true,
    });
  });

  it("falls back to text search when old trip data has no coordinates", () => {
    expect(
      getTripLocationTarget(
        trip({
          unloadAddress: null,
          unloadLatitude: null,
          unloadLongitude: null,
        }),
        "unload",
      ),
    ).toEqual({
      name: "杭州萧山仓库A区",
      address: "杭州萧山仓库A区",
      latitude: null,
      longitude: null,
      precise: false,
    });
  });

  it("builds an amap search url for old text-only locations", () => {
    expect(buildAmapSearchUrl("杭州萧山仓库A区")).toBe(
      "https://uri.amap.com/search?keyword=%E6%9D%AD%E5%B7%9E%E8%90%A7%E5%B1%B1%E4%BB%93%E5%BA%93A%E5%8C%BA&view=map",
    );
  });
});
