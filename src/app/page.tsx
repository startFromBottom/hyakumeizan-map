'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { loadMountains, loadRoutesGeoJSON, loadProfiles, loadHuts, loadLodgings, loadStations, loadParking } from '@/lib/data';
import type { Mountain, RouteProfile, HutsGeoJSON, LodgingsGeoJSON, StationsGeoJSON, ParkingGeoJSON } from '@/lib/types';
import { DEFAULT_FILTER, FilterState, matches } from '@/lib/filter';
import Sidebar, { SortKey } from '@/components/Sidebar';
import DetailPanel from '@/components/DetailPanel';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function Page() {
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [geojson, setGeojson] = useState<any | null>(null);
  const [profiles, setProfiles] = useState<Record<string, RouteProfile>>({});
  const [huts, setHuts] = useState<HutsGeoJSON | null>(null);
  const [lodgings, setLodgings] = useState<LodgingsGeoJSON | null>(null);
  const [stations, setStations] = useState<StationsGeoJSON | null>(null);
  const [parking, setParking] = useState<ParkingGeoJSON | null>(null);
  const [focusItem, setFocusItem] = useState<{ kind: 'station'|'hut'|'lodging'|'parking'|'town'; id: string; ts: number } | null>(null);
  const focus = (kind: 'station'|'hut'|'lodging'|'parking'|'town', id: string) =>
    setFocusItem({ kind, id, ts: Date.now() });
  // 경로 계획 결과 (RoutePlanner에서 콜백으로 전달)
  const [plannedRoute, setPlannedRoute] = useState<{ geometry: any; label: string } | null>(null);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [sortKey, setSortKey] = useState<SortKey>('no');
  const [selectedNo, setSelectedNo] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedHutId, setSelectedHutId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    loadMountains().then(setMountains);
    loadRoutesGeoJSON().then(setGeojson);
    loadProfiles().then(setProfiles);
    loadHuts().then(setHuts);
    loadLodgings().then(setLodgings);
    loadStations().then(setStations);
    loadParking().then(setParking);
  }, []);

  const filtered = useMemo(() => mountains.filter(m => matches(m, filter)), [mountains, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const primaryRoute = (m: Mountain) => m.routes?.find(r => r.is_primary) ?? m.routes?.[0];
    switch (sortKey) {
      case 'no':
        arr.sort((a, b) => a.no - b.no); break;
      case 'elev_desc':
        arr.sort((a, b) => b.elevation_m - a.elevation_m); break;
      case 'elev_asc':
        arr.sort((a, b) => a.elevation_m - b.elevation_m); break;
      case 'difficulty_desc':
        arr.sort((a, b) => (primaryRoute(b)?.difficulty_stars ?? 0) - (primaryRoute(a)?.difficulty_stars ?? 0)); break;
      case 'difficulty_asc':
        arr.sort((a, b) => (primaryRoute(a)?.difficulty_stars ?? 99) - (primaryRoute(b)?.difficulty_stars ?? 99)); break;
      case 'distance_desc':
        arr.sort((a, b) => (primaryRoute(b)?.distance_km ?? 0) - (primaryRoute(a)?.distance_km ?? 0)); break;
      case 'distance_asc':
        arr.sort((a, b) => (primaryRoute(a)?.distance_km ?? 999) - (primaryRoute(b)?.distance_km ?? 999)); break;
      case 'name_ko':
        arr.sort((a, b) => a.name_ko.localeCompare(b.name_ko, 'ko')); break;
    }
    return arr;
  }, [filtered, sortKey]);

  const visibleNos = useMemo(() => new Set(filtered.map(m => m.no)), [filtered]);
  const selected = useMemo(() => mountains.find(m => m.no === selectedNo) || null, [mountains, selectedNo]);

  // 산 변경 시 코스 선택 리셋
  const handleSelectMountain = (no: number) => {
    setSelectedNo(no);
    setSelectedRouteId(null);
  };

  // 모바일 분기
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <main className="fixed inset-0 flex overflow-hidden">
      {!isMobile && showSidebar && (
        <Sidebar
          mountains={sorted}
          filter={filter}
          setFilter={setFilter}
          sortKey={sortKey}
          setSortKey={setSortKey}
          selectedNo={selectedNo}
          onSelect={handleSelectMountain}
          totalCount={mountains.length}
        />
      )}

      <div className="relative flex-1 min-w-0 min-h-0">
        {!isMobile && (
          <button onClick={() => setShowSidebar(s => !s)}
            className="absolute top-3 left-3 z-[1100] bg-white shadow-md rounded-md px-3 py-2 text-xs font-semibold border border-gray-200 hover:bg-gray-50">
            {showSidebar ? '◀ 사이드바' : '▶ 사이드바'}
          </button>
        )}

        {mountains.length > 0 && (
          <MapView
            mountains={mountains}
            geojson={geojson}
            huts={huts}
            lodgings={lodgings}
            stations={stations}
            parking={parking}
            visibleNos={visibleNos}
            selectedNo={selectedNo}
            selectedRouteId={selectedRouteId}
            focusItem={focusItem}
            plannedRoute={plannedRoute}
            onSelect={handleSelectMountain}
            onSelectHut={setSelectedHutId}
          />
        )}

        {!isMobile && selected && (
          <DetailPanel
            mountain={selected}
            profilesById={profiles}
            huts={huts}
            lodgings={lodgings}
            parking={parking}
            selectedRouteId={selectedRouteId}
            selectedHutId={selectedHutId}
            onSelectRoute={setSelectedRouteId}
            onSelectHut={setSelectedHutId}
            onFocus={focus}
            onPlannedRoute={(rt, label) => setPlannedRoute(rt ? { geometry: rt.geometry, label } : null)}
            onClose={() => { setSelectedNo(null); setSelectedRouteId(null); setSelectedHutId(null); setPlannedRoute(null); }}
          />
        )}

        {isMobile && (
          <MobileSheet
            selected={selected}
            profilesById={profiles}
            huts={huts}
            lodgings={lodgings}
            parking={parking}
            selectedRouteId={selectedRouteId}
            selectedHutId={selectedHutId}
            onSelectRoute={setSelectedRouteId}
            onSelectHut={setSelectedHutId}
            onFocus={focus}
            onPlannedRoute={(rt: any, label: string) => setPlannedRoute(rt ? { geometry: rt.geometry, label } : null)}
            mountains={sorted}
            filter={filter}
            setFilter={setFilter}
            sortKey={sortKey}
            setSortKey={setSortKey}
            onSelect={handleSelectMountain}
            onCloseDetail={() => { setSelectedNo(null); setSelectedRouteId(null); setSelectedHutId(null); }}
            totalCount={mountains.length}
          />
        )}

        <Legend />
      </div>
    </main>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur shadow rounded-md px-3 py-2 text-[11px] z-[1000] border border-gray-200">
      <div className="font-semibold text-gray-700 mb-1">난이도</div>
      <div className="flex gap-1.5">
        {[1,2,3,4,5].map(s => (
          <span key={s} className={`diff-${s} w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function MobileSheet({ selected, profilesById, huts, lodgings, parking, selectedRouteId, selectedHutId, onSelectRoute, onSelectHut, onFocus, onPlannedRoute, mountains, filter, setFilter, sortKey, setSortKey, onSelect, onCloseDetail, totalCount }: any) {
  if (selected) {
    return (
      <div className="absolute inset-x-0 bottom-0 max-h-[75%] bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 z-[1000] overflow-hidden flex flex-col">
        <div className="flex justify-center py-1.5"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
        <div className="flex-1 overflow-y-auto">
          <DetailPanel mountain={selected} profilesById={profilesById} huts={huts} lodgings={lodgings} parking={parking}
            selectedRouteId={selectedRouteId} selectedHutId={selectedHutId}
            onSelectRoute={onSelectRoute} onSelectHut={onSelectHut}
            onFocus={onFocus}
            onPlannedRoute={onPlannedRoute}
            onClose={onCloseDetail} inline />
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-x-0 bottom-0 max-h-[55%] bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 z-[1000] overflow-hidden flex flex-col">
      <div className="flex justify-center py-1.5"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
      <Sidebar mountains={mountains} filter={filter} setFilter={setFilter}
        sortKey={sortKey} setSortKey={setSortKey}
        selectedNo={null} onSelect={onSelect} totalCount={totalCount} />
    </div>
  );
}
