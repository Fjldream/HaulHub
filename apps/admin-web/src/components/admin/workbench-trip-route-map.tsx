"use client";

import Link from "next/link";
import { Expand, MapPin, Navigation, Pencil, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  loadAmap,
  type AMapInfoWindow,
  type AMapLngLat,
  type AMapMap,
  type AMapMarker,
  type AMapPolyline,
  type AMapPolylineOptions,
} from "@/lib/amap-loader";
import type { ApiTrip } from "@/lib/api-client";
import {
  deriveWorkbenchTripRoutes,
  type WorkbenchDrawableRoute,
} from "./workbench-trip-routes-model";

interface WorkbenchTripRouteMapProps {
  trips: ApiTrip[];
}

const DEFAULT_CENTER: AMapLngLat = [121.473667, 31.230525];
const ACTIVE_ROUTE_OPTIONS: AMapPolylineOptions = {
  strokeColor: "#2563eb",
  strokeOpacity: 0.95,
  strokeWeight: 3,
  strokeStyle: "solid",
  zIndex: 20,
};
const INACTIVE_ROUTE_OPTIONS: AMapPolylineOptions = {
  strokeColor: "#64748b",
  strokeOpacity: 0.45,
  strokeWeight: 1.5,
  strokeStyle: "solid",
  zIndex: 10,
};

export function WorkbenchTripRouteMap({ trips }: WorkbenchTripRouteMapProps) {
  const rawId = useId();
  const mapId = `workbench-trip-route-map-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { drawableRoutes, missingCoordinateTrips, hiddenRouteCount } = useMemo(
    () => deriveWorkbenchTripRoutes(trips),
    [trips],
  );
  const mapLoadKey = useMemo(
    () => drawableRoutes.map((route) => route.id).join("|"),
    [drawableRoutes],
  );
  const totalInProgress =
    drawableRoutes.length + missingCoordinateTrips.length + hiddenRouteCount;
  const [rawSelectedRouteId, setRawSelectedRouteId] = useState("");
  const selectedRoute = useMemo(
    () =>
      drawableRoutes.find((route) => route.id === rawSelectedRouteId) ??
      drawableRoutes[0] ??
      null,
    [drawableRoutes, rawSelectedRouteId],
  );
  const selectedRouteId = selectedRoute?.id ?? "";
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapZoom, setMapZoom] = useState(8);
  const [mapError, setMapError] = useState<{ key: string; message: string } | null>(null);
  const visibleMapError = mapError?.key === mapLoadKey ? mapError.message : "";
  const zoomedOut = mapZoom <= 7;
  const mapRef = useRef<AMapMap | null>(null);
  const infoWindowRef = useRef<AMapInfoWindow | null>(null);
  const overlayRefs = useRef<Array<AMapMarker | AMapPolyline>>([]);
  const polylineRefs = useRef(new Map<string, AMapPolyline>());
  const routeCenterRefs = useRef(new Map<string, AMapLngLat>());
  const selectedRouteIdRef = useRef(selectedRouteId);

  useEffect(() => {
    selectedRouteIdRef.current = selectedRouteId;
  }, [selectedRouteId]);

  const openRouteInfo = useCallback((route: WorkbenchDrawableRoute, position?: AMapLngLat) => {
    const map = mapRef.current;
    const infoWindow = infoWindowRef.current;
    if (!map || !infoWindow) return;

    const center = position ?? routeCenterRefs.current.get(route.id) ?? route.origin.lngLat;
    infoWindow.setContent(routeInfoHtml(route));
    infoWindow.open(map, center);
  }, []);

  const selectRoute = useCallback(
    (route: WorkbenchDrawableRoute, position?: AMapLngLat) => {
      setRawSelectedRouteId(route.id);
      openRouteInfo(route, position);
    },
    [openRouteInfo],
  );

  useEffect(() => {
    if (drawableRoutes.length === 0) return;

    let cancelled = false;
    const markers: AMapMarker[] = [];
    const polylines: AMapPolyline[] = [];
    const polylineMap = polylineRefs.current;
    const routeCenterMap = routeCenterRefs.current;

    loadAmap()
      .then((AMap) => {
        if (cancelled) return;

        mapRef.current?.destroy();
        polylineMap.clear();
        routeCenterMap.clear();

        const map = new AMap.Map(mapId, {
          center: drawableRoutes[0]?.origin.lngLat ?? DEFAULT_CENTER,
          resizeEnable: true,
          zoom: 8,
        });
        const infoWindow = new AMap.InfoWindow({
          anchor: "bottom-center",
          offset: new AMap.Pixel(0, -18),
        });

        for (const route of drawableRoutes) {
          const center = midpoint(route.origin.lngLat, route.destination.lngLat);
          routeCenterMap.set(route.id, center);

          const loadMarker = new AMap.Marker({
            anchor: "center",
            content: markerHtml("装", route.vehiclePlateNumber, "load"),
            cursor: "pointer",
            draggable: false,
            position: route.origin.lngLat,
          });
          const unloadMarker = new AMap.Marker({
            anchor: "center",
            content: markerHtml("卸", route.vehiclePlateNumber, "unload"),
            cursor: "pointer",
            draggable: false,
            position: route.destination.lngLat,
          });
          const truckMarker = new AMap.Marker({
            anchor: "center",
            content: truckMarkerHtml(route.vehiclePlateNumber),
            cursor: "pointer",
            draggable: false,
            position: center,
          });
          const polyline = new AMap.Polyline({
            path: [route.origin.lngLat, route.destination.lngLat],
            ...routeLineOptions(route.id === selectedRouteIdRef.current),
          });

          loadMarker.on("click", () => selectRoute(route, route.origin.lngLat));
          unloadMarker.on("click", () => selectRoute(route, route.destination.lngLat));
          truckMarker.on("click", () => selectRoute(route, center));
          polyline.on("click", () => selectRoute(route, center));

          map.add(loadMarker);
          map.add(unloadMarker);
          map.add(truckMarker);
          map.add(polyline);
          markers.push(loadMarker, unloadMarker, truckMarker);
          polylines.push(polyline);
          polylineMap.set(route.id, polyline);
        }

        overlayRefs.current = [...markers, ...polylines];
        map.setFitView([...markers, ...polylines], false, [32, 32, 32, 32], 12);
        map.on("zoomend", () => {
          setMapZoom(map.getZoom());
        });
        window.setTimeout(() => {
          if (!cancelled) {
            setMapZoom(map.getZoom());
          }
        }, 80);
        mapRef.current = map;
        infoWindowRef.current = infoWindow;

        const selectedRoute = drawableRoutes.find(
          (route) => route.id === selectedRouteIdRef.current,
        );
        if (selectedRoute) {
          openRouteInfo(selectedRoute);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMapError({
            key: mapLoadKey,
            message: error instanceof Error ? error.message : "地图加载失败",
          });
        }
      });

    return () => {
      cancelled = true;
      infoWindowRef.current?.close();
      mapRef.current?.destroy();
      mapRef.current = null;
      infoWindowRef.current = null;
      overlayRefs.current = [];
      polylineMap.clear();
      routeCenterMap.clear();
    };
  }, [drawableRoutes, mapId, mapLoadKey, openRouteInfo, selectRoute]);

  useEffect(() => {
    for (const [routeId, polyline] of polylineRefs.current) {
      polyline.setOptions(routeLineOptions(routeId === selectedRouteId));
    }
  }, [selectedRouteId]);

  useEffect(() => {
    if (!mapRef.current || overlayRefs.current.length === 0) return;
    window.setTimeout(() => {
      mapRef.current?.setFitView(overlayRefs.current, false, [42, 42, 42, 42], 12);
    }, 80);
  }, [mapExpanded]);

  if (totalInProgress === 0) {
    return (
      <div className="route-empty">
        <strong>暂无进行中工单路线</strong>
        <span>有车辆开始运输后，这里会按工单装卸货地点生成路线。</span>
      </div>
    );
  }

  return (
    <>
      {mapExpanded ? (
        <div
          className="route-map-modal-backdrop"
          aria-hidden="true"
          onClick={() => setMapExpanded(false)}
        />
      ) : null}
      <div
        className={[
          "route-monitor",
          mapExpanded ? "route-monitor-expanded" : "",
          zoomedOut ? "route-map-zoomed-out" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role={mapExpanded ? "dialog" : undefined}
        aria-modal={mapExpanded ? "true" : undefined}
        aria-label={mapExpanded ? "进行中工单路线大地图" : undefined}
      >
      <div className="route-map-shell">
        {drawableRoutes.length > 0 ? (
          <>
            <button
              type="button"
              className="route-map-expand-button"
              onClick={() => setMapExpanded((expanded) => !expanded)}
            >
              {mapExpanded ? <X size={16} /> : <Expand size={16} />}
              {mapExpanded ? "关闭" : "放大查看"}
            </button>
            <div className="route-map-canvas" id={mapId} />
            {visibleMapError ? (
              <div className="route-map-error" role="alert">
                <strong>地图加载失败</strong>
                <span>{visibleMapError}</span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="route-empty compact">
            <strong>这些工单需要补充装卸货坐标后才能上图</strong>
            <span>路线仅按精准地点绘制，避免在地图上显示错误位置。</span>
          </div>
        )}
      </div>

      <div className="route-list">
        <div className="route-list-head">
          <div>
            <strong>进行中路线 {totalInProgress}</strong>
            <span>路线仅表示计划运输区间</span>
          </div>
          {hiddenRouteCount > 0 ? <span>仅展示最近 50 条</span> : null}
        </div>

        {drawableRoutes.length > 0 ? (
          <div className="route-list-section">
            {drawableRoutes.map((route) => (
              <div
                className={route.id === selectedRouteId ? "route-row selected" : "route-row"}
                key={route.id}
              >
                <button
                  type="button"
                  className="route-select-button"
                  aria-label={`选择路线 ${route.tripNo}`}
                  aria-pressed={route.id === selectedRouteId}
                  onClick={() => selectRoute(route)}
                >
                  <Navigation size={16} />
                </button>
                <div className="route-row-main">
                  <div className="route-row-title">
                    <strong>{route.vehiclePlateNumber}</strong>
                    <span>{route.driverName}</span>
                  </div>
                  <span className="route-customer">{route.customerName}</span>
                  <span className="route-path">
                    {route.origin.place} -&gt; {route.destination.place}
                  </span>
                  <div className="route-row-meta">
                    <span>{route.createdAtLabel}</span>
                    <span>{route.coordinateStatus}</span>
                  </div>
                </div>
                <Link className="route-detail-link" href={route.detailHref}>
                  详情
                </Link>
              </div>
            ))}
          </div>
        ) : null}

        {missingCoordinateTrips.length > 0 ? (
          <div className="route-list-section missing">
            <div className="route-section-title">
              <MapPin size={16} />
              <strong>待补地点</strong>
            </div>
            {missingCoordinateTrips.map((trip) => (
              <div className="route-row missing" key={trip.id}>
                <div className="route-row-main">
                  <div className="route-row-title">
                    <strong>{trip.vehiclePlateNumber}</strong>
                    <span>{trip.driverName}</span>
                  </div>
                  <span className="route-customer">{trip.customerName}</span>
                  <span className="route-path">
                    {trip.origin.place} -&gt; {trip.destination.place}
                  </span>
                  <div className="route-row-meta">
                    <span>{trip.createdAtLabel}</span>
                    <span>{trip.coordinateStatus}</span>
                  </div>
                </div>
                <Link className="route-edit-link" href={trip.editHref}>
                  <Pencil size={15} />
                  补地点
                </Link>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      </div>
    </>
  );
}

function routeLineOptions(active: boolean): AMapPolylineOptions {
  return active ? ACTIVE_ROUTE_OPTIONS : INACTIVE_ROUTE_OPTIONS;
}

function midpoint(origin: AMapLngLat, destination: AMapLngLat): AMapLngLat {
  return [(origin[0] + destination[0]) / 2, (origin[1] + destination[1]) / 2];
}

function markerHtml(label: string, _plate: string, type: "load" | "unload") {
  return `<div class="route-marker-point ${type}" aria-label="${escapeAttribute(
    label,
  )}"><span>${escapeHtml(label)}</span></div>`;
}

function truckMarkerHtml(plate: string) {
  return `<div class="route-truck-marker"><strong>🚚</strong><span>${escapeHtml(
    plate,
  )}</span></div>`;
}

function routeInfoHtml(route: WorkbenchDrawableRoute) {
  return `<div class="route-info-window">
    <strong>${escapeHtml(route.vehiclePlateNumber)}</strong>
    <span>${escapeHtml(route.driverName)} / ${escapeHtml(route.customerName)}</span>
    <p>${escapeHtml(route.origin.place)} -&gt; ${escapeHtml(route.destination.place)}</p>
    <a href="${escapeAttribute(route.detailHref)}">查看工单</a>
  </div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
