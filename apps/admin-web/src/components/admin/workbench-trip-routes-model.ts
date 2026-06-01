import type { ApiTrip } from "@/lib/api-client";

export type LngLat = [number, number];
export type CoordinateStatus = "坐标完整" | "待补地点" | "坐标异常";

export interface WorkbenchRouteEndpoint {
  place: string;
  address: string | null;
  lngLat: LngLat | null;
}

export interface WorkbenchDrawableRoute {
  id: string;
  tripNo: string;
  customerName: string;
  vehiclePlateNumber: string;
  driverName: string;
  createdAtLabel: string;
  detailHref: string;
  editHref: string;
  coordinateStatus: "坐标完整";
  origin: WorkbenchRouteEndpoint & { lngLat: LngLat };
  destination: WorkbenchRouteEndpoint & { lngLat: LngLat };
}

export interface WorkbenchMissingCoordinateTrip {
  id: string;
  tripNo: string;
  customerName: string;
  vehiclePlateNumber: string;
  driverName: string;
  createdAtLabel: string;
  detailHref: string;
  editHref: string;
  coordinateStatus: Exclude<CoordinateStatus, "坐标完整">;
  origin: WorkbenchRouteEndpoint;
  destination: WorkbenchRouteEndpoint;
}

export interface WorkbenchTripRoutesResult {
  drawableRoutes: WorkbenchDrawableRoute[];
  missingCoordinateTrips: WorkbenchMissingCoordinateTrip[];
  hiddenRouteCount: number;
}

type DrawableRouteEndpoint = WorkbenchRouteEndpoint & { lngLat: LngLat };

const MAX_DRAWABLE_ROUTES = 50;

export function readableRoutePlace(value: string | null | undefined): string {
  if (!value || value.includes("?")) {
    return "地点待补";
  }

  return value;
}

export function formatRouteCreatedAt(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  return month && day && hour && minute ? `${month}月${day}日 ${hour}:${minute}` : "-";
}

export function deriveWorkbenchTripRoutes(trips: ApiTrip[]): WorkbenchTripRoutesResult {
  const drawableRoutes: WorkbenchDrawableRoute[] = [];
  const missingCoordinateTrips: WorkbenchMissingCoordinateTrip[] = [];
  let drawableRouteCount = 0;

  for (const trip of trips) {
    if (trip.status !== "in_progress") {
      continue;
    }

    const base = routeBase(trip);
    const origin = endpoint(trip.loadLocation, trip.loadAddress, trip.loadLongitude, trip.loadLatitude);
    const destination = endpoint(
      trip.unloadLocation,
      trip.unloadAddress,
      trip.unloadLongitude,
      trip.unloadLatitude,
    );

    const missingCoordinateStatus = routeMissingCoordinateStatus(origin, destination);
    if (missingCoordinateStatus) {
      missingCoordinateTrips.push({
        ...base,
        coordinateStatus: missingCoordinateStatus,
        origin,
        destination,
      });
      continue;
    }

    drawableRouteCount += 1;
    const drawableEndpoints = getDrawableRouteEndpoints(origin, destination);
    if (!drawableEndpoints) {
      continue;
    }

    if (drawableRoutes.length < MAX_DRAWABLE_ROUTES) {
      drawableRoutes.push({
        ...base,
        coordinateStatus: "坐标完整",
        origin: drawableEndpoints.origin,
        destination: drawableEndpoints.destination,
      });
    }
  }

  return {
    drawableRoutes,
    missingCoordinateTrips,
    hiddenRouteCount: Math.max(0, drawableRouteCount - MAX_DRAWABLE_ROUTES),
  };
}

function routeBase(trip: ApiTrip) {
  return {
    id: trip.id,
    tripNo: trip.tripNo,
    customerName: trip.customerName,
    vehiclePlateNumber: trip.vehicle.plateNumber,
    driverName: trip.driver.name,
    createdAtLabel: formatRouteCreatedAt(trip.createdAt),
    detailHref: `/trips/${trip.id}`,
    editHref: `/trips/${trip.id}/edit`,
  };
}

function endpoint(
  place: string,
  address: string | null,
  longitude: number | null,
  latitude: number | null,
): WorkbenchRouteEndpoint {
  return {
    place: readableRoutePlace(place),
    address,
    lngLat: longitude == null || latitude == null ? null : [longitude, latitude],
  };
}

function routeMissingCoordinateStatus(
  origin: WorkbenchRouteEndpoint,
  destination: WorkbenchRouteEndpoint,
): Exclude<CoordinateStatus, "坐标完整"> | null {
  if (!origin.lngLat || !destination.lngLat) {
    return "待补地点";
  }

  if (!isValidLngLat(origin.lngLat) || !isValidLngLat(destination.lngLat)) {
    return "坐标异常";
  }

  return null;
}

function getDrawableRouteEndpoints(
  origin: WorkbenchRouteEndpoint,
  destination: WorkbenchRouteEndpoint,
): { origin: DrawableRouteEndpoint; destination: DrawableRouteEndpoint } | null {
  if (!origin.lngLat || !destination.lngLat) {
    return null;
  }

  if (!isValidLngLat(origin.lngLat) || !isValidLngLat(destination.lngLat)) {
    return null;
  }

  return {
    origin: { ...origin, lngLat: origin.lngLat },
    destination: { ...destination, lngLat: destination.lngLat },
  };
}

function isValidLngLat([longitude, latitude]: LngLat): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}
