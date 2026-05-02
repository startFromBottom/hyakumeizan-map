'use client';

import { useState } from 'react';
import { geocode, route, formatDistance, formatDuration } from '@/lib/routing';
import type { GeocodeResult, RouteResult } from '@/lib/routing';

// 메이저 출발지 프리셋
const PRESETS: Array<{ label: string; emoji: string; lat: number; lon: number; }> = [
  { label: '도쿄역',     emoji: '🚉', lat: 35.6812, lon: 139.7671 },
  { label: '신주쿠역',   emoji: '🚉', lat: 35.6896, lon: 139.7006 },
  { label: '하네다 공항', emoji: '✈️', lat: 35.5494, lon: 139.7798 },
  { label: '나리타 공항', emoji: '✈️', lat: 35.7647, lon: 140.3863 },
  { label: '오사카역',   emoji: '🚉', lat: 34.7024, lon: 135.4959 },
  { label: '교토역',     emoji: '🚉', lat: 34.9858, lon: 135.7588 },
  { label: '나고야역',   emoji: '🚉', lat: 35.1709, lon: 136.8815 },
  { label: '간사이공항', emoji: '✈️', lat: 34.4347, lon: 135.2440 },
];

interface Props {
  destLat: number;
  destLon: number;
  destName: string;
  onRouteResult?: (rt: RouteResult | null, fromLabel: string) => void;
}

export default function RoutePlanner({ destLat, destLon, destName, onRouteResult }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loadingGc, setLoadingGc] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [selectedFrom, setSelectedFrom] = useState<{ label: string; lat: number; lon: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoadingGc(true);
    setError(null);
    try {
      const gc = await geocode(query.trim());
      setResults(gc);
      if (gc.length === 0) setError('검색 결과가 없어요.');
    } catch (e: any) {
      setError('검색 실패: ' + e.message);
    } finally {
      setLoadingGc(false);
    }
  };

  const calc = async (from: { label: string; lat: number; lon: number }) => {
    setLoadingRoute(true);
    setError(null);
    setSelectedFrom(from);
    try {
      const rt = await route(from.lat, from.lon, destLat, destLon, 'driving');
      setRouteResult(rt);
      onRouteResult?.(rt, from.label);
    } catch (e: any) {
      setError('경로 계산 실패: ' + e.message);
    } finally {
      setLoadingRoute(false);
    }
  };

  const clear = () => {
    setRouteResult(null);
    setSelectedFrom(null);
    onRouteResult?.(null, '');
  };

  return (
    <section className="px-5 py-4 border-b border-gray-100 bg-blue-50/30">
      <h3 className="text-sm font-bold text-gray-900 mb-2">
        🚗 자동차 경로 — {destName}까지
      </h3>

      {/* 프리셋 */}
      <div className="mb-3">
        <div className="text-[11px] text-gray-600 mb-1">자주 쓰는 출발지:</div>
        <div className="grid grid-cols-2 gap-1">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => calc(p)}
              disabled={loadingRoute}
              className={`px-2 py-1 text-[11px] rounded border transition text-left ${
                selectedFrom?.label === p.label
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-200 bg-white hover:border-brand text-gray-700'
              } disabled:opacity-50`}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 자유 검색 */}
      <div className="mb-2">
        <div className="text-[11px] text-gray-600 mb-1">또는 다른 출발지 검색:</div>
        <div className="flex gap-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="예: 가나자와역, 후쿠오카 공항"
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button onClick={search} disabled={loadingGc}
            className="px-3 py-1 text-xs bg-brand text-white rounded hover:bg-brand-dark disabled:opacity-50">
            {loadingGc ? '...' : '검색'}
          </button>
        </div>
        {results.length > 0 && (
          <ul className="mt-1 max-h-[140px] overflow-y-auto border border-gray-200 rounded bg-white">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => { calc({ label: r.display_name.split(',')[0].trim(), lat: r.lat, lon: r.lon }); setResults([]); }}
                  className="w-full text-left px-2 py-1 text-[11px] hover:bg-brand-light">
                  📍 {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 결과 */}
      {loadingRoute && (
        <div className="text-xs text-gray-500 italic mt-2">경로 계산 중...</div>
      )}

      {routeResult && selectedFrom && (
        <div className="mt-2 p-3 rounded border border-blue-300 bg-white">
          <div className="text-[11px] text-gray-600 mb-1">
            <span className="font-semibold">{selectedFrom.label}</span> → {destName}
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-[10px] text-gray-500">소요 시간</div>
              <div className="text-lg font-bold text-blue-700 font-mono">
                {formatDuration(routeResult.duration_s)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">거리</div>
              <div className="text-lg font-bold text-blue-700 font-mono">
                {formatDistance(routeResult.distance_m)}
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <a
              href={`https://www.google.com/maps/dir/${selectedFrom.lat},${selectedFrom.lon}/${destLat},${destLon}`}
              target="_blank" rel="noopener noreferrer"
              className="text-brand hover:underline font-medium">
              🗺 Google Maps에서 정밀 안내 →
            </a>
            <button onClick={clear} className="text-gray-500 hover:text-gray-700">초기화</button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-600">⚠ {error}</div>
      )}

      <div className="mt-2 text-[10px] text-gray-500">
        ※ OSRM 라우팅은 OSM 데이터 기반 추정치예요. 실제 출발 직전엔 Google Maps 길찾기를 확인해주세요.
      </div>
    </section>
  );
}
