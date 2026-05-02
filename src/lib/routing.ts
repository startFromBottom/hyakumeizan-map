// 라우팅 헬퍼 — Nominatim 지오코딩 + OSRM 라우팅
// 둘 다 무료, 외부 API. 사용자 입력 단계에서만 호출.

export interface GeocodeResult {
  display_name: string;
  lat: number;
  lon: number;
}

export interface RouteResult {
  distance_m: number;
  duration_s: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';

// 지오코딩: 텍스트 → 좌표
export async function geocode(query: string, lang = 'ko'): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    'accept-language': lang,
    countrycodes: 'jp',
  });
  const r = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!r.ok) throw new Error(`Geocode failed: ${r.status}`);
  const arr = await r.json();
  return arr.map((x: any) => ({
    display_name: x.display_name,
    lat: parseFloat(x.lat),
    lon: parseFloat(x.lon),
  }));
}

// 라우팅: 좌표 두 점 → 거리·시간·경로
export async function route(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  profile: 'driving' | 'foot' = 'driving'
): Promise<RouteResult | null> {
  const url = `${OSRM_BASE}/route/v1/${profile}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Route failed: ${r.status}`);
  const d = await r.json();
  if (!d.routes || d.routes.length === 0) return null;
  const rt = d.routes[0];
  return {
    distance_m: rt.distance,
    duration_s: rt.duration,
    geometry: rt.geometry,
  };
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}
