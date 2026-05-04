'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { loadMountains, loadRoutesGeoJSON, loadProfiles, loadHuts, loadLodgings, loadStations, loadParking } from '@/lib/data';
import type { Mountain, RouteProfile, HutsGeoJSON, LodgingsGeoJSON, StationsGeoJSON, ParkingGeoJSON } from '@/lib/types';
import { DEFAULT_FILTER, FilterState, matches } from '@/lib/filter';
import Sidebar, { SortKey } from '@/components/Sidebar';
import DetailPanel from '@/components/DetailPanel';
import AuthHeader from '@/components/AuthHeader';
import LoadingScreen from '@/components/LoadingScreen';
import { useUrlSync } from '@/lib/useUrlSync';
import ShareButton from '@/components/ShareButton';

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
  const [selectedLodgingId, setSelectedLodgingId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  // 모바일 시트 상태 (page에서 관리 — 지도 클릭 시 minimize 가능하도록)
  const [mobileSheet, setMobileSheet] = useState<'min'|'mid'|'max'>('mid');

  // 데이터 로딩 상태 (첫 진입 시 LoadingScreen용)
  const [loadFlags, setLoadFlags] = useState({
    mountains: false, geojson: false, profiles: false,
    huts: false, lodgings: false, stations: false, parking: false,
  });

  useEffect(() => {
    loadMountains().then(d => { setMountains(d); setLoadFlags(f => ({ ...f, mountains: true })); });
    loadRoutesGeoJSON().then(d => { setGeojson(d); setLoadFlags(f => ({ ...f, geojson: true })); });
    loadProfiles().then(d => { setProfiles(d); setLoadFlags(f => ({ ...f, profiles: true })); });
    loadHuts().then(d => { setHuts(d); setLoadFlags(f => ({ ...f, huts: true })); });
    loadLodgings().then(d => { setLodgings(d); setLoadFlags(f => ({ ...f, lodgings: true })); });
    loadStations().then(d => { setStations(d); setLoadFlags(f => ({ ...f, stations: true })); });
    loadParking().then(d => { setParking(d); setLoadFlags(f => ({ ...f, parking: true })); });
  }, []);

  // 로딩 진행률 — mountains는 필수, 나머지는 부분 가중치
  const loadProgress = useMemo(() => {
    const flags = loadFlags;
    const all = Object.values(flags);
    const done = all.filter(Boolean).length;
    return done / all.length;
  }, [loadFlags]);

  const isInitialLoading = !loadFlags.mountains;

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

  // 산 변경 시 — 다른 산의 잔여 상태 리셋
  const handleSelectMountain = (no: number) => {
    if (no !== selectedNo) {
      setSelectedRouteId(null);
      setSelectedHutId(null);
      setSelectedLodgingId(null);
      setPlannedRoute(null);   // 이전 산의 자동차 경로 폴리라인 제거
    }
    setSelectedNo(no);
  };

  // URL ?m=&r= 동기화 — 진입 시 자동 선택, 변경 시 URL 갱신
  useUrlSync({
    selectedNo, selectedRouteId,
    onInit: (no, rid) => {
      if (no != null) setSelectedNo(no);
      if (rid) setSelectedRouteId(rid);
    },
  });

  // 모바일 분기
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 첫 진입 시 — mountains 데이터 도착 전까지 로딩 화면
  if (isInitialLoading) {
    return (
      <LoadingScreen
        progress={loadProgress}
        steps={[
          { label: '100명산 메타데이터', done: loadFlags.mountains },
          { label: '등산로 폴리라인', done: loadFlags.geojson },
          { label: '표고 프로필', done: loadFlags.profiles },
          { label: '산장 · 대피소', done: loadFlags.huts },
          { label: '베이스타운 · 숙소', done: loadFlags.lodgings },
          { label: '역 · 터미널', done: loadFlags.stations },
          { label: '트레일헤드 주차장', done: loadFlags.parking },
        ]}
      />
    );
  }

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

        <ShareButton selectedNo={selectedNo} selectedRouteId={selectedRouteId} />
        <AuthHeader />

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
            onMapClick={() => { if (isMobile) setMobileSheet('min'); }}
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
            selectedLodgingId={selectedLodgingId}
            onSelectRoute={setSelectedRouteId}
            onSelectHut={setSelectedHutId}
            onSelectLodging={setSelectedLodgingId}
            onFocus={focus}
            onPlannedRoute={(rt, label) => setPlannedRoute(rt ? { geometry: rt.geometry, label } : null)}
            onClose={() => { setSelectedNo(null); setSelectedRouteId(null); setSelectedHutId(null); setSelectedLodgingId(null); setPlannedRoute(null); }}
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
            selectedLodgingId={selectedLodgingId}
            onSelectRoute={setSelectedRouteId}
            onSelectHut={setSelectedHutId}
            onSelectLodging={setSelectedLodgingId}
            onFocus={focus}
            onPlannedRoute={(rt: any, label: string) => setPlannedRoute(rt ? { geometry: rt.geometry, label } : null)}
            mountains={sorted}
            filter={filter}
            setFilter={setFilter}
            sortKey={sortKey}
            setSortKey={setSortKey}
            onSelect={handleSelectMountain}
            onCloseDetail={() => { setSelectedNo(null); setSelectedRouteId(null); setSelectedHutId(null); setSelectedLodgingId(null); }}
            totalCount={mountains.length}
            sheetState={mobileSheet}
            setSheetState={setMobileSheet}
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

type SheetState = 'min' | 'mid' | 'max';

function MobileSheet({ selected, profilesById, huts, lodgings, parking, selectedRouteId, selectedHutId, selectedLodgingId, onSelectRoute, onSelectHut, onSelectLodging, onFocus, onPlannedRoute, mountains, filter, setFilter, sortKey, setSortKey, onSelect, onCloseDetail, totalCount, sheetState, setSheetState }: any) {
  // 시트 3단계: page.tsx에서 lift up — 지도 클릭 시 외부에서 'min'으로 변경 가능
  const state: SheetState = sheetState ?? 'mid';
  const setState = setSheetState ?? (() => {});
  const sheetRef = useRef<HTMLDivElement>(null);

  // 산 변경 시 시트 mid + 맨 위로 스크롤
  useEffect(() => {
    if (selected) {
      setState('mid');
      if (sheetRef.current) sheetRef.current.scrollTop = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.no]);

  const jumpTo = (id: string) => {
    if (!sheetRef.current) return;
    const el = sheetRef.current.querySelector(`#${id}`) as HTMLElement | null;
    if (el) {
      const parentTop = sheetRef.current.getBoundingClientRect().top;
      const elTop = el.getBoundingClientRect().top;
      sheetRef.current.scrollTop += (elTop - parentTop - 8);
      setState('max');
    }
  };

  // 핸들 클릭: 순환 min → mid → max → mid → ...
  const onHandleClick = () => {
    const next: SheetState = state === 'min' ? 'mid' : state === 'mid' ? 'max' : 'mid';
    setState(next);
  };

  // 시트 높이 클래스
  const heightClass =
    state === 'max' ? 'max-h-[92%]' :
    state === 'mid' ? 'max-h-[60%]' :
    'max-h-[44px]';   // 핸들 + 약간의 그립만 보이도록

  if (selected) {
    const tabs: { id: string; label: string; show: boolean }[] = [
      { id: 'sec-summary',  label: '🏔 요약',  show: true },
      { id: 'sec-routes',   label: '⛰ 코스',   show: (selected.routes?.length ?? 0) > 0 },
      { id: 'sec-huts',     label: '🏠 산장',   show: huts && huts.features.some((f: any) => f.properties.route_associations?.some((a: any) => a.mountain_no === selected.no) || f.properties.nearest_mountain_no === selected.no) },
      { id: 'sec-lodgings', label: '🛏 숙소',   show: !!selected.base_towns?.length },
      { id: 'sec-transit',  label: '🚉 교통',   show: !!selected.stations?.length },
      { id: 'sec-reviews',  label: '💬 후기',   show: true },
    ];
    const visibleTabs = tabs.filter(t => t.show);

    return (
      <div className={`absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 z-[1000] overflow-hidden flex flex-col transition-[max-height] duration-300 ${heightClass}`}>
        {/* 핸들 — 클릭 영역 크게 (44px) */}
        <div className="relative flex items-center justify-center h-11 cursor-pointer select-none flex-shrink-0"
             onClick={onHandleClick}>
          <div className="w-12 h-1.5 bg-gray-400 rounded-full" />
          {/* 미니 라벨 (min 상태에서 산 이름 보이도록) */}
          {state === 'min' && (
            <span className="absolute left-1/2 top-1/2 mt-2 -translate-x-1/2 -translate-y-1/2 text-[11px] text-gray-600 whitespace-nowrap" style={{ marginTop: 6 }}>
              {selected.name_ko} ▲ 펼치기
            </span>
          )}
          <button onClick={(e) => { e.stopPropagation(); onCloseDetail(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 text-xl"
            aria-label="닫기">×</button>
        </div>

        {/* 탭바 — min 상태일 땐 숨김 */}
        {state !== 'min' && (
          <nav className="flex-shrink-0 border-b border-gray-200 overflow-x-auto scrollbar-thin">
            <div className="flex gap-1 px-2 py-1.5 min-w-min">
              {visibleTabs.map(t => (
                <button key={t.id} onClick={() => jumpTo(t.id)}
                  className="px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap bg-gray-100 text-gray-700 hover:bg-brand hover:text-white transition flex-shrink-0">
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* 본문 — min 상태일 땐 숨김 */}
        {state !== 'min' && (
          <div ref={sheetRef} className="flex-1 overflow-y-auto overscroll-contain">
            <DetailPanel mountain={selected} profilesById={profilesById} huts={huts} lodgings={lodgings} parking={parking}
              selectedRouteId={selectedRouteId} selectedHutId={selectedHutId} selectedLodgingId={selectedLodgingId}
              onSelectRoute={onSelectRoute} onSelectHut={onSelectHut} onSelectLodging={onSelectLodging}
              onFocus={onFocus}
              onPlannedRoute={onPlannedRoute}
              onClose={onCloseDetail} inline />
          </div>
        )}
      </div>
    );
  }

  // 산 미선택 시 — 산 리스트 시트
  return (
    <div className={`absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 z-[1000] overflow-hidden flex flex-col transition-[max-height] duration-300 ${heightClass}`}>
      <div className="relative flex items-center justify-center h-11 cursor-pointer select-none flex-shrink-0"
           onClick={onHandleClick}>
        <div className="w-12 h-1.5 bg-gray-400 rounded-full" />
        {state === 'min' && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 text-[11px] text-gray-600 whitespace-nowrap" style={{ marginTop: 6 }}>
            ▲ 산 리스트 펼치기
          </span>
        )}
      </div>
      {state !== 'min' && (
        <Sidebar mountains={mountains} filter={filter} setFilter={setFilter}
          sortKey={sortKey} setSortKey={setSortKey}
          selectedNo={null} onSelect={onSelect} totalCount={totalCount} />
      )}
    </div>
  );
}
