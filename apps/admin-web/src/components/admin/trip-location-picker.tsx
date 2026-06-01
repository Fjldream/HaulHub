"use client";

import { Map, MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const amapJsKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY ?? "";
const amapSecurityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE ?? "";

type LngLat = [number, number];

interface AMapClickEvent {
  lnglat: {
    getLng(): number;
    getLat(): number;
  };
}

interface AMapMap {
  add(overlay: AMapMarker): void;
  destroy(): void;
  on(eventName: "click", callback: (event: AMapClickEvent) => void): void;
  setCenter(position: LngLat): void;
  setZoom(zoom: number): void;
}

interface AMapMarker {
  on(eventName: "dragend", callback: (event: AMapClickEvent) => void): void;
  setPosition(position: LngLat): void;
}

interface AMapGeocoder {
  getAddress(
    position: LngLat,
    callback: (
      status: string,
      result?: { regeocode?: { formattedAddress?: string } },
    ) => void,
  ): void;
}

interface AMapGlobal {
  Map: new (
    container: string,
    options: { center: LngLat; resizeEnable: boolean; zoom: number },
  ) => AMapMap;
  Marker: new (options: {
    cursor: string;
    draggable: boolean;
    position: LngLat;
  }) => AMapMarker;
  Geocoder: new (options: { radius: number }) => AMapGeocoder;
}

declare global {
  interface Window {
    AMap?: AMapGlobal;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

let amapPromise: Promise<AMapGlobal> | null = null;
const amapScriptId = "haulhub-amap-js-sdk";

function loadAmap() {
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

export interface TripLocationValue {
  location: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  poiId?: string | null;
  provider?: string | null;
}

interface MapPlace {
  id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  provider: string;
}

interface TripLocationPickerProps {
  label: string;
  fieldPrefix: "load" | "unload";
  placeholder: string;
  initialValue?: TripLocationValue;
}

export function TripLocationPicker({
  label,
  fieldPrefix,
  placeholder,
  initialValue,
}: TripLocationPickerProps) {
  const rawId = useId();
  const mapId = `amap-${fieldPrefix}-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [query, setQuery] = useState(initialValue?.location ?? "");
  const [selected, setSelected] = useState<TripLocationValue>({
    location: initialValue?.location ?? "",
    address: initialValue?.address ?? "",
    latitude: initialValue?.latitude ?? null,
    longitude: initialValue?.longitude ?? null,
    poiId: initialValue?.poiId ?? "",
    provider: initialValue?.provider ?? "",
  });
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [mapPlaces, setMapPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mapMessage, setMapMessage] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapKeyword, setMapKeyword] = useState(initialValue?.location ?? "");
  const mapRef = useRef<AMapMap | null>(null);
  const markerRef = useRef<AMapMarker | null>(null);
  const geocoderRef = useRef<AMapGeocoder | null>(null);
  const queryRef = useRef(query);

  const coordinateReady = selected.latitude != null && selected.longitude != null;

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const updateFromMapPoint = useCallback(
    async (longitude: number, latitude: number, shouldReverse: boolean) => {
      markerRef.current?.setPosition([longitude, latitude]);
      mapRef.current?.setCenter([longitude, latitude]);
      if (!shouldReverse || !geocoderRef.current) {
        setSelected({
          location: queryRef.current || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          address: queryRef.current,
          latitude,
          longitude,
          poiId: "",
          provider: "amap",
        });
        return;
      }

      setMapMessage("正在识别当前位置...");
      geocoderRef.current.getAddress([longitude, latitude], (status, result) => {
        const address =
          status === "complete" && result?.regeocode?.formattedAddress
            ? result.regeocode.formattedAddress
            : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setSelected({
          location: address,
          address,
          latitude,
          longitude,
          poiId: "",
          provider: "amap",
        });
        setQuery(address);
        setMapKeyword(address);
        setMapMessage("已更新选点，可继续拖动微调");
      });
    },
    [],
  );

  useEffect(() => {
    if (!mapOpen) return;
    let cancelled = false;
    const center: LngLat =
      selected.longitude != null && selected.latitude != null
        ? [selected.longitude, selected.latitude]
        : [121.473667, 31.230525];

    loadAmap()
      .then((AMap) => {
        if (cancelled) return;
        mapRef.current?.destroy();
        const map = new AMap.Map(mapId, {
          center,
          resizeEnable: true,
          zoom: coordinateReady ? 16 : 11,
        });
        const marker = new AMap.Marker({
          cursor: "move",
          draggable: true,
          position: center,
        });
        const geocoder = new AMap.Geocoder({ radius: 1000 });
        map.add(marker);
        map.on("click", (event) => {
          void updateFromMapPoint(event.lnglat.getLng(), event.lnglat.getLat(), true);
        });
        marker.on("dragend", (event) => {
          void updateFromMapPoint(event.lnglat.getLng(), event.lnglat.getLat(), true);
        });
        mapRef.current = map;
        markerRef.current = marker;
        geocoderRef.current = geocoder;
        setMapMessage(coordinateReady ? "可拖动标记微调位置" : "搜索地点或点击地图选点");
      })
      .catch((error) => {
        setMapMessage(error instanceof Error ? error.message : "地图加载失败");
      });

    return () => {
      cancelled = true;
    };
  }, [coordinateReady, mapId, mapOpen, selected.latitude, selected.longitude, updateFromMapPoint]);

  useEffect(() => {
    if (!mapOpen) {
      mapRef.current?.destroy();
      mapRef.current = null;
      markerRef.current = null;
      geocoderRef.current = null;
    }
  }, [mapOpen]);

  async function fetchPlaces(keyword: string) {
    const response = await fetch(`/api/map-places/search?q=${encodeURIComponent(keyword)}`);
    const data = (await response.json()) as { places?: MapPlace[]; message?: string };
    if (!response.ok) {
      throw new Error(data.message ?? "地图搜索失败");
    }
    return data.places ?? [];
  }

  async function searchPlaces() {
    const keyword = query.trim();
    if (!keyword) {
      setMessage("请输入地点关键词");
      setPlaces([]);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const nextPlaces = await fetchPlaces(keyword);
      setPlaces(nextPlaces);
      if (nextPlaces.length === 0) {
        setMessage("没有找到匹配地点，可以继续手动填写地址");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "地图搜索失败，请稍后重试");
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }

  async function searchMapPlaces() {
    const keyword = mapKeyword.trim();
    if (!keyword) {
      setMapMessage("请输入地点关键词");
      setMapPlaces([]);
      return;
    }
    setMapLoading(true);
    setMapMessage("");
    try {
      const nextPlaces = await fetchPlaces(keyword);
      setMapPlaces(nextPlaces);
      if (nextPlaces.length === 0) {
        setMapMessage("没有找到匹配地点，可以拖动地图手动选点");
      }
    } catch (error) {
      setMapMessage(error instanceof Error ? error.message : "地图搜索失败，请稍后重试");
      setMapPlaces([]);
    } finally {
      setMapLoading(false);
    }
  }

  function applyPlace(place: MapPlace) {
    const value = {
      location: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      poiId: place.id,
      provider: place.provider,
    };
    setSelected(value);
    setQuery(place.name);
    setMapKeyword(place.name);
    setMessage("已选择精准地点");
  }

  function selectPlace(place: MapPlace) {
    applyPlace(place);
    setPlaces([]);
  }

  function selectMapPlace(place: MapPlace) {
    applyPlace(place);
    setMapPlaces([]);
    mapRef.current?.setCenter([place.longitude, place.latitude]);
    mapRef.current?.setZoom(17);
    markerRef.current?.setPosition([place.longitude, place.latitude]);
    setMapMessage("已定位到搜索结果，可拖动标记微调");
  }

  function updateManualValue(value: string) {
    setQuery(value);
    setSelected({
      location: value,
      address: "",
      latitude: null,
      longitude: null,
      poiId: "",
      provider: "",
    });
    setMessage("");
  }

  function openMapPicker() {
    setMapKeyword(query);
    setMapPlaces([]);
    setMapMessage("");
    setMapOpen(true);
  }

  return (
    <div className="location-picker">
      <div className="location-picker-head">
        <span className="location-label">{label}</span>
        <span className={coordinateReady ? "location-status precise" : "location-status"}>
          {coordinateReady ? "已选精准坐标" : "可手动填写或搜索选点"}
        </span>
      </div>
      <div className="location-input-row">
        <input
          aria-label={label}
          name={`${fieldPrefix}Location`}
          required
          value={query}
          placeholder={placeholder}
          onChange={(event) => updateManualValue(event.target.value)}
        />
        <button type="button" className="location-search-button" onClick={searchPlaces} disabled={loading}>
          <Search size={16} />
          <span>{loading ? "搜索中" : "搜索"}</span>
        </button>
        <button type="button" className="location-map-button" onClick={openMapPicker} aria-label={`${label}地图选点`}>
          <Map size={17} />
        </button>
      </div>
      <input type="hidden" name={`${fieldPrefix}Address`} value={selected.address ?? ""} />
      <input type="hidden" name={`${fieldPrefix}Latitude`} value={selected.latitude ?? ""} />
      <input type="hidden" name={`${fieldPrefix}Longitude`} value={selected.longitude ?? ""} />
      <input type="hidden" name={`${fieldPrefix}PoiId`} value={selected.poiId ?? ""} />
      <input type="hidden" name={`${fieldPrefix}Provider`} value={selected.provider ?? ""} />

      {places.length > 0 ? (
        <div className="location-results">
          {places.map((place) => (
            <button key={place.id || `${place.name}-${place.longitude}`} type="button" onClick={() => selectPlace(place)}>
              <MapPin size={16} />
              <span>
                <strong>{place.name}</strong>
                <small>{[place.city, place.district, place.address].filter(Boolean).join(" · ")}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {message ? <p className="location-message">{message}</p> : null}

      {mapOpen ? (
        <div className="map-picker-mask" role="dialog" aria-modal="true" aria-label={`${label}地图选点`}>
          <div className="map-picker-dialog">
            <div className="map-picker-head">
              <div>
                <strong>{label}地图选点</strong>
                <span>搜索后选中地点，也可以拖动标记精确到门口或月台。</span>
              </div>
              <button type="button" className="map-picker-close" onClick={() => setMapOpen(false)} aria-label="关闭地图">
                <X size={18} />
              </button>
            </div>

            <div className="map-picker-search">
              <input
                value={mapKeyword}
                placeholder="搜索地点、园区、仓库或门牌"
                onChange={(event) => setMapKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchMapPlaces();
                  }
                }}
              />
              <button type="button" className="primary-button" onClick={searchMapPlaces} disabled={mapLoading}>
                <Search size={16} />
                {mapLoading ? "搜索中" : "搜索"}
              </button>
            </div>

            <div className="map-picker-body">
              <div className="map-picker-canvas" id={mapId} />
              {mapPlaces.length > 0 ? (
                <div className="map-picker-results">
                  {mapPlaces.map((place) => (
                    <button
                      key={place.id || `${place.name}-${place.longitude}`}
                      type="button"
                      onClick={() => selectMapPlace(place)}
                    >
                      <MapPin size={15} />
                      <span>
                        <strong>{place.name}</strong>
                        <small>{[place.city, place.district, place.address].filter(Boolean).join(" · ")}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="map-picker-footer">
              <p>{mapMessage || (coordinateReady ? selected.address || selected.location : "尚未选择精准坐标")}</p>
              <div className="button-row">
                <button type="button" className="secondary-button" onClick={() => setMapOpen(false)}>
                  取消
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setPlaces([]);
                    setMessage("已选择精准地点");
                    setMapOpen(false);
                  }}
                  disabled={!coordinateReady}
                >
                  确认位置
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
