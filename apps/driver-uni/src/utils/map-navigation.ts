export interface NavigableTrip {
  loadLocation: string;
  loadAddress?: string | null;
  loadLatitude?: number | null;
  loadLongitude?: number | null;
  unloadLocation: string;
  unloadAddress?: string | null;
  unloadLatitude?: number | null;
  unloadLongitude?: number | null;
}

export interface LocationTarget {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  precise: boolean;
}

function queryString(params: Record<string, string | number>) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

export function buildAmapNavigationUrl(target: {
  name: string;
  latitude: number;
  longitude: number;
}) {
  const params = queryString({
    sourceApplication: "HaulHub",
    dlat: String(target.latitude),
    dlon: String(target.longitude),
    dname: target.name,
    dev: "0",
    t: "0",
  });
  return `amapuri://route/plan/?${params.toString()}`;
}

export function buildAmapSearchUrl(keyword: string) {
  const params = queryString({
    keyword,
    view: "map",
  });
  return `https://uri.amap.com/search?${params.toString()}`;
}

export function getTripLocationTarget(
  trip: NavigableTrip,
  type: "load" | "unload",
): LocationTarget {
  const isLoad = type === "load";
  const name = isLoad ? trip.loadLocation : trip.unloadLocation;
  const address = (isLoad ? trip.loadAddress : trip.unloadAddress) || name;
  const latitude = isLoad ? trip.loadLatitude ?? null : trip.unloadLatitude ?? null;
  const longitude = isLoad ? trip.loadLongitude ?? null : trip.unloadLongitude ?? null;
  return {
    name,
    address,
    latitude,
    longitude,
    precise: latitude != null && longitude != null,
  };
}
