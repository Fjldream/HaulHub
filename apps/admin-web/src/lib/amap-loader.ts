const amapJsKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY ?? "";
const amapSecurityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE ?? "";

export type AMapLngLat = [number, number];

export interface AMapClickEvent {
  lnglat: {
    getLng(): number;
    getLat(): number;
  };
}

export interface AMapMap {
  add(overlay: AMapMarker | AMapPolyline): void;
  destroy(): void;
  on(eventName: "click", callback: (event: AMapClickEvent) => void): void;
  remove(overlay: AMapMarker | AMapPolyline): void;
  setCenter(position: AMapLngLat): void;
  setFitView(
    overlays?: Array<AMapMarker | AMapPolyline>,
    immediately?: boolean,
    avoid?: [number, number, number, number],
    maxZoom?: number,
  ): void;
  setZoom(zoom: number): void;
}

export interface AMapMarker {
  on(eventName: "dragend", callback: (event: AMapClickEvent) => void): void;
  setPosition(position: AMapLngLat): void;
}

export interface AMapPolyline {
  on(eventName: string, callback: (event: unknown) => void): void;
  setOptions(options: AMapPolylineOptions): void;
}

export interface AMapInfoWindow {
  close(): void;
  open(map: AMapMap, position?: AMapLngLat): void;
  setContent(content: string | HTMLElement): void;
}

export interface AMapGeocoder {
  getAddress(
    position: AMapLngLat,
    callback: (
      status: string,
      result?: { regeocode?: { formattedAddress?: string } },
    ) => void,
  ): void;
}

export interface AMapPolylineOptions {
  path?: AMapLngLat[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  strokeStyle?: "solid" | "dashed";
  zIndex?: number;
}

export interface AMapInfoWindowOptions {
  anchor?: string;
  content?: string | HTMLElement;
  offset?: AMapPixel;
}

export interface AMapPixel {
  x: number;
  y: number;
}

export interface AMapGlobal {
  Map: new (
    container: string,
    options: { center: AMapLngLat; resizeEnable: boolean; zoom: number },
  ) => AMapMap;
  Marker: new (options: {
    cursor: string;
    draggable: boolean;
    position: AMapLngLat;
  }) => AMapMarker;
  Polyline: new (options: AMapPolylineOptions & { path: AMapLngLat[] }) => AMapPolyline;
  InfoWindow: new (options?: AMapInfoWindowOptions) => AMapInfoWindow;
  Pixel: new (x: number, y: number) => AMapPixel;
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
