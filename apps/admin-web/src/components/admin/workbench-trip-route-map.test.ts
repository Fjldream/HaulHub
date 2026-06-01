import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("WorkbenchTripRouteMap source contract", () => {
  const source = readFileSync(
    path.resolve(__dirname, "workbench-trip-route-map.tsx"),
    "utf8",
  );

  it("offers a large map dialog control from the route map", () => {
    expect(source).toContain("放大查看");
    expect(source).toContain('role={mapExpanded ? "dialog" : undefined}');
    expect(source).toContain("route-map-modal-backdrop");
  });

  it("renders route endpoints and a truck plate marker separately", () => {
    expect(source).toContain("route-marker-point");
    expect(source).toContain('anchor: "center",\n            content: markerHtml');
    expect(source).toContain("truckMarkerHtml");
    expect(source).toContain("route-truck-marker");
    expect(source).toContain("🚚");
    expect(source).toContain("route-map-zoomed-out");
    expect(source).toContain("getZoom()");
  });
});
