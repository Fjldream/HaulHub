# Workbench Active Trip Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workbench static “in progress trip monitor” placeholder with a lightweight work-order route map that shows active trip load/unload routes without implying realtime vehicle location.

**Architecture:** Keep the workbench page as a server component that fetches trips, move all route derivation into a pure tested model module, and render the map/list in one focused client component. Extract the existing AMap script loader from `TripLocationPicker` so both location picking and route display use the same runtime-loaded SDK.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, existing AMap JS SDK integration, existing global CSS and lucide-react icons.

---

## File Structure

- Create `apps/admin-web/src/lib/amap-loader.ts`: shared browser-only AMap script loader, public `loadAmap()` function, AMap TypeScript interfaces used by both map components.
- Modify `apps/admin-web/src/components/admin/trip-location-picker.tsx`: remove local AMap loader/types and import them from `@/lib/amap-loader`.
- Create `apps/admin-web/src/components/admin/workbench-trip-routes-model.ts`: pure route derivation, coordinate validation, list limits, and date/place formatting helpers.
- Create `apps/admin-web/src/components/admin/workbench-trip-routes-model.test.ts`: Vitest coverage for drawable routes, missing coordinates, invalid coordinates, non-active statuses, and the 50-route cap.
- Create `apps/admin-web/src/components/admin/workbench-trip-route-map.tsx`: client component that renders route list, AMap canvas, selected-route state, empty/error states, markers, polylines, and info windows.
- Modify `apps/admin-web/src/app/page.tsx`: remove static monitor placeholder, import `WorkbenchTripRouteMap`, pass `inProgressTrips`, and change monitor actions to real links.
- Modify `apps/admin-web/src/app/globals.css`: replace old `.monitor-map` placeholder styles with route-map, route-list, selected, empty, and responsive styles.

## Task 1: Route Derivation Model

**Files:**
- Create: `apps/admin-web/src/components/admin/workbench-trip-routes-model.ts`
- Create: `apps/admin-web/src/components/admin/workbench-trip-routes-model.test.ts`

- [ ] **Step 1: Write failing tests for active route derivation**

Create `apps/admin-web/src/components/admin/workbench-trip-routes-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ApiTrip } from "@/lib/api-client";
import { deriveWorkbenchTripRoutes, formatRouteCreatedAt, readableRoutePlace } from "./workbench-trip-routes-model";

function trip(overrides: Partial<ApiTrip>): ApiTrip {
  return {
    id: "trip-1",
    tripNo: "HH202606010001",
    status: "in_progress",
    customerName: "恒通物流",
    loadLocation: "上海嘉定物流园",
    loadAddress: "上海市嘉定区",
    loadLatitude: 31.3741,
    loadLongitude: 121.2504,
    loadPoiId: "load-poi",
    unloadLocation: "杭州萧山仓库",
    unloadAddress: "杭州市萧山区",
    unloadLatitude: 30.1838,
    unloadLongitude: 120.2646,
    unloadPoiId: "unload-poi",
    locationProvider: "amap",
    estimatedFreight: "1800",
    actualFreight: null,
    driverNote: null,
    accountingNote: null,
    expenseTotal: "0.00",
    profit: null,
    profitRate: null,
    returnReason: null,
    createdAt: "2026-06-01T02:30:00.000Z",
    submittedAt: null,
    reviewStartedAt: null,
    completedAt: null,
    vehicle: { id: "vehicle-1", plateNumber: "沪A12345" },
    driver: { id: "driver-1", name: "司机老李" },
    expenses: [],
    ...overrides,
  };
}

describe("deriveWorkbenchTripRoutes", () => {
  it("returns drawable routes for in-progress trips with complete coordinates", () => {
    const result = deriveWorkbenchTripRoutes([trip({ id: "trip-1" })]);

    expect(result.drawableRoutes).toHaveLength(1);
    expect(result.missingCoordinateTrips).toHaveLength(0);
    expect(result.totalInProgress).toBe(1);
    expect(result.drawableRoutes[0]).toMatchObject({
      id: "trip-1",
      plateNumber: "沪A12345",
      driverName: "司机老李",
      customerName: "恒通物流",
      load: {
        label: "上海嘉定物流园",
        lngLat: [121.2504, 31.3741],
      },
      unload: {
        label: "杭州萧山仓库",
        lngLat: [120.2646, 30.1838],
      },
    });
  });

  it("puts in-progress trips with missing endpoint coordinates in the missing list", () => {
    const result = deriveWorkbenchTripRoutes([
      trip({ id: "trip-missing-load", loadLatitude: null }),
      trip({ id: "trip-missing-unload", unloadLongitude: null }),
    ]);

    expect(result.drawableRoutes).toHaveLength(0);
    expect(result.missingCoordinateTrips.map((item) => item.id)).toEqual([
      "trip-missing-load",
      "trip-missing-unload",
    ]);
    expect(result.missingCoordinateTrips[0].coordinateStatus).toBe("待补地点");
  });

  it("puts invalid coordinates in the missing list with a coordinate error status", () => {
    const result = deriveWorkbenchTripRoutes([
      trip({ id: "trip-invalid", loadLatitude: 120, loadLongitude: 200 }),
    ]);

    expect(result.drawableRoutes).toHaveLength(0);
    expect(result.missingCoordinateTrips[0]).toMatchObject({
      id: "trip-invalid",
      coordinateStatus: "坐标异常",
    });
  });

  it("ignores trips that are not in progress", () => {
    const result = deriveWorkbenchTripRoutes([
      trip({ id: "assigned", status: "assigned" }),
      trip({ id: "submitted", status: "submitted" }),
    ]);

    expect(result.totalInProgress).toBe(0);
    expect(result.drawableRoutes).toHaveLength(0);
    expect(result.missingCoordinateTrips).toHaveLength(0);
  });

  it("caps drawable routes at 50 and exposes overflow count", () => {
    const trips = Array.from({ length: 52 }, (_, index) =>
      trip({
        id: `trip-${index}`,
        tripNo: `HH${index}`,
        loadLatitude: 31 + index * 0.001,
        unloadLatitude: 30 + index * 0.001,
      }),
    );

    const result = deriveWorkbenchTripRoutes(trips);

    expect(result.drawableRoutes).toHaveLength(50);
    expect(result.hiddenRouteCount).toBe(2);
  });
});

describe("route display helpers", () => {
  it("formats route creation dates compactly", () => {
    expect(formatRouteCreatedAt("2026-06-01T02:30:00.000Z")).toMatch(/06\/01|2026/);
  });

  it("keeps readable places and hides broken placeholder text", () => {
    expect(readableRoutePlace("上海嘉定物流园")).toBe("上海嘉定物流园");
    expect(readableRoutePlace("????")).toBe("地点待补");
    expect(readableRoutePlace("")).toBe("地点待补");
  });
});
```

- [ ] **Step 2: Run the route model test and verify it fails**

Run:

```bash
npm --workspace @haulhub/admin-web test -- workbench-trip-routes-model.test.ts
```

Expected: FAIL because `workbench-trip-routes-model.ts` does not exist.

- [ ] **Step 3: Implement the route model**

Create `apps/admin-web/src/components/admin/workbench-trip-routes-model.ts`:

```ts
import type { ApiTrip } from "@/lib/api-client";

const MAX_DRAWABLE_ROUTES = 50;

export type LngLat = [number, number];
export type CoordinateStatus = "坐标完整" | "待补地点" | "坐标异常";

export interface WorkbenchRouteEndpoint {
  label: string;
  address: string | null;
  lngLat: LngLat;
}

export interface WorkbenchDrawableRoute {
  id: string;
  tripNo: string;
  plateNumber: string;
  driverName: string;
  customerName: string;
  load: WorkbenchRouteEndpoint;
  unload: WorkbenchRouteEndpoint;
  createdAt: string;
  detailHref: string;
  editHref: string;
  coordinateStatus: CoordinateStatus;
}

export interface WorkbenchMissingCoordinateTrip {
  id: string;
  tripNo: string;
  plateNumber: string;
  driverName: string;
  customerName: string;
  loadLocation: string;
  unloadLocation: string;
  createdAt: string;
  detailHref: string;
  editHref: string;
  coordinateStatus: Exclude<CoordinateStatus, "坐标完整">;
}

export interface WorkbenchTripRoutesResult {
  drawableRoutes: WorkbenchDrawableRoute[];
  missingCoordinateTrips: WorkbenchMissingCoordinateTrip[];
  totalInProgress: number;
  hiddenRouteCount: number;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLngLat(longitude: number, latitude: number) {
  return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}

export function readableRoutePlace(value: string | null | undefined) {
  if (!value || value.includes("?")) {
    return "地点待补";
  }
  return value;
}

export function formatRouteCreatedAt(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function missingTrip(trip: ApiTrip, coordinateStatus: Exclude<CoordinateStatus, "坐标完整">) {
  return {
    id: trip.id,
    tripNo: trip.tripNo,
    plateNumber: trip.vehicle.plateNumber,
    driverName: trip.driver.name,
    customerName: trip.customerName,
    loadLocation: readableRoutePlace(trip.loadLocation),
    unloadLocation: readableRoutePlace(trip.unloadLocation),
    createdAt: trip.createdAt,
    detailHref: `/trips/${trip.id}`,
    editHref: `/trips/${trip.id}/edit`,
    coordinateStatus,
  };
}

export function deriveWorkbenchTripRoutes(trips: ApiTrip[]): WorkbenchTripRoutesResult {
  const inProgressTrips = trips.filter((trip) => trip.status === "in_progress");
  const drawableRoutes: WorkbenchDrawableRoute[] = [];
  const missingCoordinateTrips: WorkbenchMissingCoordinateTrip[] = [];

  for (const trip of inProgressTrips) {
    const hasAllCoordinates =
      isFiniteNumber(trip.loadLongitude) &&
      isFiniteNumber(trip.loadLatitude) &&
      isFiniteNumber(trip.unloadLongitude) &&
      isFiniteNumber(trip.unloadLatitude);

    if (!hasAllCoordinates) {
      missingCoordinateTrips.push(missingTrip(trip, "待补地点"));
      continue;
    }

    if (
      !isValidLngLat(trip.loadLongitude, trip.loadLatitude) ||
      !isValidLngLat(trip.unloadLongitude, trip.unloadLatitude)
    ) {
      missingCoordinateTrips.push(missingTrip(trip, "坐标异常"));
      continue;
    }

    if (drawableRoutes.length >= MAX_DRAWABLE_ROUTES) {
      continue;
    }

    drawableRoutes.push({
      id: trip.id,
      tripNo: trip.tripNo,
      plateNumber: trip.vehicle.plateNumber,
      driverName: trip.driver.name,
      customerName: trip.customerName,
      load: {
        label: readableRoutePlace(trip.loadLocation),
        address: trip.loadAddress,
        lngLat: [trip.loadLongitude, trip.loadLatitude],
      },
      unload: {
        label: readableRoutePlace(trip.unloadLocation),
        address: trip.unloadAddress,
        lngLat: [trip.unloadLongitude, trip.unloadLatitude],
      },
      createdAt: trip.createdAt,
      detailHref: `/trips/${trip.id}`,
      editHref: `/trips/${trip.id}/edit`,
      coordinateStatus: "坐标完整",
    });
  }

  return {
    drawableRoutes,
    missingCoordinateTrips,
    totalInProgress: inProgressTrips.length,
    hiddenRouteCount: Math.max(0, inProgressTrips.length - missingCoordinateTrips.length - drawableRoutes.length),
  };
}
```

- [ ] **Step 4: Run the route model test and verify it passes**

Run:

```bash
npm --workspace @haulhub/admin-web test -- workbench-trip-routes-model.test.ts
```

Expected: PASS for all tests in `workbench-trip-routes-model.test.ts`.

- [ ] **Step 5: Commit route model**

Run:

```bash
git add apps/admin-web/src/components/admin/workbench-trip-routes-model.ts apps/admin-web/src/components/admin/workbench-trip-routes-model.test.ts
git commit -m "Add workbench route derivation model"
```

Expected: commit succeeds and includes only the model and model test.

## Task 2: Shared AMap Loader

**Files:**
- Create: `apps/admin-web/src/lib/amap-loader.ts`
- Modify: `apps/admin-web/src/components/admin/trip-location-picker.tsx`

- [ ] **Step 1: Create the shared AMap loader**

Create `apps/admin-web/src/lib/amap-loader.ts`:

```ts
export type AMapLngLat = [number, number];

export interface AMapClickEvent {
  lnglat: {
    getLng(): number;
    getLat(): number;
  };
}

export interface AMapBounds {
  extend(position: AMapLngLat): void;
}

export interface AMapMap {
  add(overlay: AMapMarker | AMapPolyline | Array<AMapMarker | AMapPolyline>): void;
  remove(overlay: AMapMarker | AMapPolyline | Array<AMapMarker | AMapPolyline>): void;
  destroy(): void;
  on(eventName: "click", callback: (event: AMapClickEvent) => void): void;
  setCenter(position: AMapLngLat): void;
  setFitView(overlays?: Array<AMapMarker | AMapPolyline>, immediately?: boolean, avoid?: number[]): void;
  setZoom(zoom: number): void;
}

export interface AMapMarker {
  on(eventName: "click" | "dragend", callback: (event: AMapClickEvent) => void): void;
  setPosition(position: AMapLngLat): void;
  setTitle(title: string): void;
}

export interface AMapPolyline {
  on(eventName: "click", callback: () => void): void;
  setOptions(options: { strokeColor?: string; strokeOpacity?: number; strokeWeight?: number; zIndex?: number }): void;
}

export interface AMapInfoWindow {
  close(): void;
  open(map: AMapMap, position: AMapLngLat): void;
  setContent(content: string): void;
}

export interface AMapGeocoder {
  getAddress(
    position: AMapLngLat,
    callback: (status: string, result?: { regeocode?: { formattedAddress?: string } }) => void,
  ): void;
}

export interface AMapGlobal {
  Map: new (container: string, options: { center: AMapLngLat; resizeEnable: boolean; zoom: number }) => AMapMap;
  Marker: new (options: {
    content?: string;
    cursor?: string;
    draggable?: boolean;
    offset?: unknown;
    position: AMapLngLat;
    title?: string;
  }) => AMapMarker;
  Polyline: new (options: {
    path: AMapLngLat[];
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    zIndex: number;
  }) => AMapPolyline;
  InfoWindow: new (options: { anchor?: string; content: string; offset?: unknown }) => AMapInfoWindow;
  Geocoder: new (options: { radius: number }) => AMapGeocoder;
  Pixel: new (x: number, y: number) => unknown;
}

declare global {
  interface Window {
    AMap?: AMapGlobal;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

const amapJsKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY ?? "";
const amapSecurityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE ?? "";
const amapScriptId = "haulhub-amap-js-sdk";

let amapPromise: Promise<AMapGlobal> | null = null;

export function loadAmap() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("地图只能在浏览器中打开"));
  }
  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }
  if (!amapJsKey) {
    return Promise.reject(new Error("缺少高德 JS API Key，请配置 NEXT_PUBLIC_AMAP_JS_KEY"));
  }
  if (!amapPromise) {
    if (amapSecurityJsCode) {
      window._AMapSecurityConfig = { securityJsCode: amapSecurityJsCode };
    }
    amapPromise = new Promise((resolve, reject) => {
      document.getElementById(amapScriptId)?.remove();
      const script = document.createElement("script");
      script.async = true;
      script.id = amapScriptId;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
        amapJsKey,
      )}&plugin=AMap.Geocoder`;
      script.onload = () => {
        if (window.AMap) {
          resolve(window.AMap);
          return;
        }
        amapPromise = null;
        script.remove();
        reject(new Error("高德地图加载失败，请检查 JS API Key、域名白名单或网络"));
      };
      script.onerror = () => {
        amapPromise = null;
        script.remove();
        reject(new Error("高德地图脚本加载失败，请检查 JS API Key、域名白名单或网络"));
      };
      document.head.appendChild(script);
    });
  }
  return amapPromise;
}
```

- [ ] **Step 2: Refactor TripLocationPicker imports and local types**

In `apps/admin-web/src/components/admin/trip-location-picker.tsx`, replace the local AMap constants, interfaces, global declaration, promise, script id, and `loadAmap()` function with imports:

```ts
import {
  loadAmap,
  type AMapClickEvent,
  type AMapGeocoder,
  type AMapLngLat,
  type AMapMap,
  type AMapMarker,
} from "@/lib/amap-loader";
```

Then replace the local `type LngLat = [number, number];` usage with `AMapLngLat`:

```ts
const center: AMapLngLat =
  selected.longitude != null && selected.latitude != null
    ? [selected.longitude, selected.latitude]
    : [121.473667, 31.230525];
```

- [ ] **Step 3: Run TypeScript/build verification**

Run:

```bash
npm --workspace @haulhub/admin-web build
```

Expected: build succeeds. If the build fails because `AMapMap.add` type is too broad or too narrow, adjust only `apps/admin-web/src/lib/amap-loader.ts` interfaces so both `TripLocationPicker` and the upcoming route map compile.

- [ ] **Step 4: Commit shared loader**

Run:

```bash
git add apps/admin-web/src/lib/amap-loader.ts apps/admin-web/src/components/admin/trip-location-picker.tsx
git commit -m "Share AMap loader across admin maps"
```

Expected: commit succeeds and includes the loader plus the location picker refactor.

## Task 3: Workbench Route Map Component

**Files:**
- Create: `apps/admin-web/src/components/admin/workbench-trip-route-map.tsx`

- [ ] **Step 1: Create the client route map component**

Create `apps/admin-web/src/components/admin/workbench-trip-route-map.tsx`:

```tsx
"use client";

import { AlertTriangle, ExternalLink, MapPinned, Navigation, PencilLine, Route } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  loadAmap,
  type AMapInfoWindow,
  type AMapMap,
  type AMapMarker,
  type AMapPolyline,
} from "@/lib/amap-loader";
import type { ApiTrip } from "@/lib/api-client";
import {
  deriveWorkbenchTripRoutes,
  formatRouteCreatedAt,
  type WorkbenchDrawableRoute,
} from "./workbench-trip-routes-model";

interface WorkbenchTripRouteMapProps {
  trips: ApiTrip[];
}

function routeInfoContent(route: WorkbenchDrawableRoute) {
  return `
    <div class="route-info-window">
      <strong>${route.plateNumber}</strong>
      <span>${route.driverName} · ${route.customerName}</span>
      <small>${route.load.label} → ${route.unload.label}</small>
      <a href="${route.detailHref}">查看详情</a>
    </div>
  `;
}

export function WorkbenchTripRouteMap({ trips }: WorkbenchTripRouteMapProps) {
  const rawId = useId();
  const mapId = `workbench-routes-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const routeSummary = useMemo(() => deriveWorkbenchTripRoutes(trips), [trips]);
  const [selectedTripId, setSelectedTripId] = useState(routeSummary.drawableRoutes[0]?.id ?? "");
  const [mapMessage, setMapMessage] = useState("");
  const mapRef = useRef<AMapMap | null>(null);
  const markerRefs = useRef<AMapMarker[]>([]);
  const polylineRefs = useRef<Array<{ tripId: string; polyline: AMapPolyline }>>([]);
  const infoWindowRef = useRef<AMapInfoWindow | null>(null);

  const selectedRoute =
    routeSummary.drawableRoutes.find((route) => route.id === selectedTripId) ?? routeSummary.drawableRoutes[0] ?? null;

  useEffect(() => {
    if (routeSummary.drawableRoutes.length === 0) {
      setSelectedTripId("");
      return;
    }
    if (!routeSummary.drawableRoutes.some((route) => route.id === selectedTripId)) {
      setSelectedTripId(routeSummary.drawableRoutes[0].id);
    }
  }, [routeSummary.drawableRoutes, selectedTripId]);

  useEffect(() => {
    if (routeSummary.drawableRoutes.length === 0) {
      return;
    }

    let cancelled = false;
    loadAmap()
      .then((AMap) => {
        if (cancelled) return;
        mapRef.current?.destroy();

        const firstRoute = routeSummary.drawableRoutes[0];
        const map = new AMap.Map(mapId, {
          center: firstRoute.load.lngLat,
          resizeEnable: true,
          zoom: 8,
        });
        const nextMarkers: AMapMarker[] = [];
        const nextPolylines: Array<{ tripId: string; polyline: AMapPolyline }> = [];
        const infoWindow = new AMap.InfoWindow({
          anchor: "bottom-center",
          content: "",
          offset: new AMap.Pixel(0, -12),
        });

        for (const route of routeSummary.drawableRoutes) {
          const loadMarker = new AMap.Marker({
            content: `<div class="route-marker route-marker-load">装</div>`,
            offset: new AMap.Pixel(-13, -13),
            position: route.load.lngLat,
            title: `${route.plateNumber} 装货地`,
          });
          const unloadMarker = new AMap.Marker({
            content: `<div class="route-marker route-marker-unload">卸</div>`,
            offset: new AMap.Pixel(-13, -13),
            position: route.unload.lngLat,
            title: `${route.plateNumber} 卸货地`,
          });
          const polyline = new AMap.Polyline({
            path: [route.load.lngLat, route.unload.lngLat],
            strokeColor: "#2D476F",
            strokeOpacity: 0.42,
            strokeWeight: 4,
            zIndex: 10,
          });
          const select = () => {
            setSelectedTripId(route.id);
            infoWindow.setContent(routeInfoContent(route));
            infoWindow.open(map, route.unload.lngLat);
          };
          loadMarker.on("click", select);
          unloadMarker.on("click", select);
          polyline.on("click", select);
          nextMarkers.push(loadMarker, unloadMarker);
          nextPolylines.push({ tripId: route.id, polyline });
        }

        map.add([...nextMarkers, ...nextPolylines.map((item) => item.polyline)]);
        mapRef.current = map;
        markerRefs.current = nextMarkers;
        polylineRefs.current = nextPolylines;
        infoWindowRef.current = infoWindow;
        map.setFitView([...nextMarkers, ...nextPolylines.map((item) => item.polyline)], false, [36, 36, 36, 36]);
        setMapMessage("");
      })
      .catch((error) => {
        setMapMessage(error instanceof Error ? error.message : "地图加载失败");
      });

    return () => {
      cancelled = true;
      infoWindowRef.current?.close();
      mapRef.current?.destroy();
      mapRef.current = null;
      markerRefs.current = [];
      polylineRefs.current = [];
    };
  }, [mapId, routeSummary.drawableRoutes]);

  useEffect(() => {
    for (const item of polylineRefs.current) {
      const isSelected = item.tripId === selectedTripId;
      item.polyline.setOptions({
        strokeColor: isSelected ? "#F6AD55" : "#2D476F",
        strokeOpacity: isSelected ? 0.95 : 0.42,
        strokeWeight: isSelected ? 7 : 4,
        zIndex: isSelected ? 20 : 10,
      });
    }
  }, [selectedTripId]);

  if (routeSummary.totalInProgress === 0) {
    return (
      <div className="route-monitor-empty">
        <Route size={30} />
        <strong>暂无进行中工单路线</strong>
        <span>有车辆开始运输后，这里会按工单装卸货地点生成路线。</span>
      </div>
    );
  }

  return (
    <div className="route-monitor">
      <div className="route-map-shell">
        {routeSummary.drawableRoutes.length > 0 ? <div className="route-map-canvas" id={mapId} /> : null}
        {routeSummary.drawableRoutes.length === 0 ? (
          <div className="route-monitor-empty compact">
            <MapPinned size={28} />
            <strong>这些工单需要补充装卸货坐标后才能上图</strong>
            <span>路线仅按精准地点绘制，避免在地图上显示错误位置。</span>
          </div>
        ) : null}
        {mapMessage ? (
          <div className="route-map-error">
            <AlertTriangle size={16} />
            <span>{mapMessage}</span>
          </div>
        ) : null}
      </div>

      <aside className="route-list" aria-label="进行中工单路线列表">
        <div className="route-list-head">
          <div>
            <strong>{routeSummary.totalInProgress} 条进行中路线</strong>
            <span>路线仅表示计划运输区间</span>
          </div>
          {routeSummary.hiddenRouteCount > 0 ? <em>仅展示最近 50 条</em> : null}
        </div>

        {routeSummary.drawableRoutes.map((route) => (
          <div className={route.id === selectedRoute?.id ? "route-list-item selected" : "route-list-item"} key={route.id}>
            <button className="route-select-button" type="button" onClick={() => setSelectedTripId(route.id)}>
              <span className="route-list-icon">
                <Navigation size={15} />
              </span>
              <span className="route-list-body">
                <strong>{route.plateNumber}</strong>
                <small>{route.driverName} · {route.customerName}</small>
                <span>{route.load.label} → {route.unload.label}</span>
                <em>{formatRouteCreatedAt(route.createdAt)} · {route.coordinateStatus}</em>
              </span>
            </button>
            <Link className="route-detail-link" href={route.detailHref}>
              <ExternalLink size={14} />
            </Link>
          </div>
        ))}

        {routeSummary.missingCoordinateTrips.length > 0 ? (
          <div className="route-missing-list">
            <strong>待补地点</strong>
            {routeSummary.missingCoordinateTrips.map((trip) => (
              <div className="route-missing-item" key={trip.id}>
                <span>
                  <b>{trip.plateNumber}</b>
                  <small>{trip.loadLocation} → {trip.unloadLocation}</small>
                  <em>{trip.coordinateStatus}</em>
                </span>
                <Link href={trip.editHref}>
                  <PencilLine size={14} />
                  编辑
                </Link>
              </div>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Run admin build and capture component compile issues**

Run:

```bash
npm --workspace @haulhub/admin-web build
```

Expected: build may fail because the component is not imported yet but TypeScript still checks it. Fix compile errors only in `workbench-trip-route-map.tsx` or `amap-loader.ts`.

- [ ] **Step 3: Commit route map component**

Run:

```bash
git add apps/admin-web/src/components/admin/workbench-trip-route-map.tsx apps/admin-web/src/lib/amap-loader.ts
git commit -m "Add workbench active route map component"
```

Expected: commit succeeds and includes the route map component and any type adjustments needed by it.

## Task 4: Workbench Page Integration and Styles

**Files:**
- Modify: `apps/admin-web/src/app/page.tsx`
- Modify: `apps/admin-web/src/app/globals.css`

- [ ] **Step 1: Replace placeholder imports and actions in the workbench page**

In `apps/admin-web/src/app/page.tsx`, remove unused placeholder imports and server action:

```ts
import {
  ClipboardCheck,
  ExternalLink,
  ReceiptText,
  Route,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { WorkbenchTripRouteMap } from "@/components/admin/workbench-trip-route-map";
```

Delete `Bell`, `Fullscreen`, `MapPinned`, `redirectWithActionError`, `compactDate()`, `readablePlace()`, and `unavailableAction()`.

- [ ] **Step 2: Update the metric badge and monitor module JSX**

Change the in-progress metric badge from `"实时"` to `"路线"`:

```tsx
{
  label: "进行中趟次",
  value: String(inProgressTrips.length),
  badge: "路线",
  icon: Route,
}
```

Replace the whole old `<section className="workbench-panel monitor-panel">...</section>` body with:

```tsx
<section className="workbench-panel monitor-panel">
  <div className="workbench-panel-head monitor-head">
    <div>
      <h2>进行中工单路线</h2>
      <p>按工单装卸货地点生成路线，当前未接入车辆实时定位。</p>
    </div>
    <div className="monitor-actions">
      <Link className="primary-button" href="/trips?status=in_progress">
        <ReceiptText size={16} />
        查看列表模式
      </Link>
    </div>
  </div>
  <WorkbenchTripRouteMap trips={inProgressTrips} />
</section>
```

- [ ] **Step 3: Add route monitor CSS**

In `apps/admin-web/src/app/globals.css`, keep `.monitor-panel`, `.monitor-head`, and `.monitor-actions`, then replace old `.monitor-map`, `.map-grid`, `.map-pin`, and `.monitor-truck-card` styles with:

```css
.route-monitor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  min-height: 420px;
}

.route-map-shell {
  position: relative;
  min-height: 420px;
  overflow: hidden;
  background: var(--surface-high);
}

.route-map-canvas {
  width: 100%;
  height: 100%;
  min-height: 420px;
}

.route-map-error {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--warning-100);
  border-radius: 8px;
  background: #fff8ea;
  color: var(--warning-700);
  font-size: 13px;
  font-weight: 800;
}

.route-list {
  display: grid;
  align-content: start;
  max-height: 420px;
  overflow: auto;
  border-left: 1px solid var(--border);
  background: #fff;
}

.route-list-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}

.route-list-head div {
  display: grid;
  gap: 3px;
}

.route-list-head strong {
  color: var(--brand-900);
  font-size: 15px;
  line-height: 20px;
}

.route-list-head span,
.route-list-head em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
}

.route-list-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
}

.route-list-item:hover,
.route-list-item.selected {
  background: var(--brand-50);
}

.route-list-item.selected {
  box-shadow: inset 3px 0 0 var(--accent-500);
}

.route-select-button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.route-list-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #edf3ff;
  color: var(--brand-700);
}

.route-list-body {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.route-list-body strong,
.route-list-body span,
.route-list-body small,
.route-list-body em {
  min-width: 0;
  overflow-wrap: anywhere;
}

.route-list-body strong {
  color: var(--brand-900);
  font-size: 14px;
  line-height: 19px;
}

.route-list-body small,
.route-list-body em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
}

.route-list-body span {
  color: var(--text-primary);
  font-size: 13px;
  line-height: 19px;
}

.route-detail-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  color: var(--brand-800);
  text-decoration: none;
}

.route-missing-list {
  display: grid;
  gap: 10px;
  padding: 16px;
  background: #fff8ea;
}

.route-missing-list > strong {
  color: var(--warning-700);
  font-size: 13px;
  line-height: 18px;
}

.route-missing-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--warning-100);
  border-radius: 8px;
  background: #fff;
}

.route-missing-item span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.route-missing-item b,
.route-missing-item small,
.route-missing-item em {
  min-width: 0;
  overflow-wrap: anywhere;
}

.route-missing-item b {
  color: var(--brand-900);
  font-size: 13px;
  line-height: 18px;
}

.route-missing-item small,
.route-missing-item em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
  line-height: 17px;
}

.route-missing-item a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--brand-800);
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}

.route-monitor-empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  min-height: 360px;
  padding: 28px;
  color: var(--text-muted);
  text-align: center;
}

.route-monitor-empty strong {
  color: var(--brand-900);
  font-size: 17px;
  line-height: 24px;
}

.route-monitor-empty span {
  max-width: 360px;
  font-size: 13px;
  line-height: 20px;
}

.route-monitor-empty.compact {
  min-height: 420px;
}

.route-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 2px solid #fff;
  border-radius: 999px;
  box-shadow: 0 6px 16px rgba(16, 39, 74, 0.22);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
}

.route-marker-load {
  background: var(--success-600);
}

.route-marker-unload {
  background: var(--accent-500);
}

.route-info-window {
  display: grid;
  gap: 4px;
  min-width: 210px;
  color: var(--text-primary);
}

.route-info-window strong {
  color: var(--brand-900);
  font-size: 15px;
  line-height: 20px;
}

.route-info-window span,
.route-info-window small {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 18px;
}

.route-info-window a {
  color: var(--brand-800);
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}
```

Inside the existing mobile media query where `.workbench-metrics` and `.workbench-main-grid` collapse, add:

```css
.route-monitor {
  grid-template-columns: 1fr;
}

.route-list {
  max-height: none;
  border-top: 1px solid var(--border);
  border-left: 0;
}

.route-map-shell,
.route-map-canvas,
.route-monitor-empty.compact {
  min-height: 340px;
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm --workspace @haulhub/admin-web build
```

Expected: build succeeds.

- [ ] **Step 5: Commit workbench integration**

Run:

```bash
git add apps/admin-web/src/app/page.tsx apps/admin-web/src/app/globals.css
git commit -m "Show active trip routes on workbench"
```

Expected: commit succeeds and includes only the workbench page and CSS.

## Task 5: Verification and Polish

**Files:**
- Modify only files from Tasks 1-4 if verification reveals a real issue.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm --workspace @haulhub/admin-web test -- workbench-trip-routes-model.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run admin build**

Run:

```bash
npm --workspace @haulhub/admin-web build
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm --workspace @haulhub/admin-web lint
```

Expected: PASS. If unrelated pre-existing lint failures appear, record the exact files and messages before deciding whether they are in scope.

- [ ] **Step 4: Start the local app for visual verification**

Run the API and admin web app using the repo’s existing development commands or the active project startup convention. If no server is already running, use:

```bash
npm --workspace @haulhub/api run dev
npm --workspace @haulhub/admin-web run dev
```

Expected: API listens on its configured local port and admin web listens on the Next.js dev port. Keep both sessions running until visual verification is done.

- [ ] **Step 5: Verify workbench behavior in the browser**

Open the admin workbench in the in-app browser:

```text
http://localhost:3000
```

Expected checks:

- The module title is “进行中工单路线”.
- The subtitle says “按工单装卸货地点生成路线，当前未接入车辆实时定位。”.
- No visible workbench text says “实时位置”, “车辆监控”, “当前车辆所在地”, or “轨迹追踪”.
- With no AMap key, the map area shows a clear key/config error and the route list or empty state remains visible.
- With an AMap key, the map canvas is nonblank and shows load/unload endpoints plus route lines for trips with complete coordinates.
- Clicking a route list item changes the selected row styling and route line weight/color.
- Missing-coordinate trips appear under “待补地点” with an edit link.
- Mobile width does not overlap text, buttons, map, or route list.

- [ ] **Step 6: Commit verification fixes if any were needed**

If verification required code or CSS fixes, run:

```bash
git add apps/admin-web/src
git commit -m "Polish workbench route map verification issues"
```

Expected: commit succeeds only if fixes were made. If no fixes were made, do not create an empty commit.
