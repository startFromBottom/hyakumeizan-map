'use client';

import { useMemo, useState } from 'react';
import type { Mountain, RouteProfile, HutsGeoJSON, HutFeature, LodgingsGeoJSON, LodgingFeature, ParkingGeoJSON, ParkingFeature } from '@/lib/types';
import type { RouteResult } from '@/lib/routing';
import ElevationProfile from './ElevationProfile';
import RoutePlanner from './RoutePlanner';

function PhotoGallery({ mountain }: { mountain: Mountain }) {
  // images 배열이 있으면 사용, 없으면 image 단일 사진을 1장짜리 배열로 변환
  const list = useMemo(() => {
    if (mountain.images && mountain.images.length > 0) return mountain.images;
    if (mountain.image?.thumb) return [{
      filename: mountain.image.filename,
      thumb: mountain.image.thumb,
      large: mountain.image.large,
      commons: mountain.image.commons,
    }];
    return [];
  }, [mountain]);
  const [active, setActive] = useState(0);
  if (list.length === 0) return null;
  const cur = list[Math.min(active, list.length - 1)];
  return (
    <div className="mt-3">
      {/* 메인 사진 */}
      <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
        <a href={cur.large || cur.commons || cur.thumb} target="_blank" rel="noopener noreferrer">
          <img
            src={cur.thumb}
            alt={mountain.name_ko}
            loading="lazy"
            className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.02]"
            style={{ maxHeight: 280, objectFit: 'cover' }}
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[10px] px-2 py-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition">
            <span>📷 {mountain.name_ja} ({active + 1}/{list.length})</span>
            <span>원본 보기 →</span>
          </div>
        </a>
        {cur.commons && (
          <a href={cur.commons} target="_blank" rel="noopener noreferrer"
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/50 text-white text-[9px] hover:bg-black/70">
            Wikimedia
          </a>
        )}
        {/* 좌우 화살표 (2장 이상일 때) */}
        {list.length > 1 && (
          <>
            <button
              onClick={(e) => { e.preventDefault(); setActive((active - 1 + list.length) % list.length); }}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white text-sm hover:bg-black/60 transition opacity-0 group-hover:opacity-100"
              aria-label="이전 사진">‹</button>
            <button
              onClick={(e) => { e.preventDefault(); setActive((active + 1) % list.length); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white text-sm hover:bg-black/60 transition opacity-0 group-hover:opacity-100"
              aria-label="다음 사진">›</button>
          </>
        )}
      </div>
      {/* 썸네일 스트립 (2장 이상일 때만) */}
      {list.length > 1 && (
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {list.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`relative rounded overflow-hidden border-2 transition ${
                i === active ? 'border-brand' : 'border-transparent hover:border-gray-300 opacity-70 hover:opacity-100'
              }`}
              aria-label={`사진 ${i + 1}`}>
              <img src={img.thumb} alt="" loading="lazy"
                className="w-full block"
                style={{ height: 56, objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  mountain: Mountain | null;
  profilesById: Record<string, RouteProfile>;
  huts: HutsGeoJSON | null;
  lodgings: LodgingsGeoJSON | null;
  parking: ParkingGeoJSON | null;
  selectedRouteId: string | null;
  selectedHutId: string | null;
  onSelectRoute: (routeId: string | null) => void;
  onSelectHut: (hutId: string | null) => void;
  onFocus?: (kind: 'station'|'hut'|'lodging'|'parking'|'town', id: string) => void;
  onPlannedRoute?: (rt: RouteResult | null, fromLabel: string) => void;
  onClose: () => void;
  inline?: boolean;
}

function Stars({ n }: { n?: number | null }) {
  if (!n) return null;
  return (
    <span className="text-amber-500 text-xs">
      {'★'.repeat(n)}<span className="text-gray-300">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export default function DetailPanel({ mountain, profilesById, huts, lodgings, parking, selectedRouteId, selectedHutId, onSelectRoute, onSelectHut, onFocus, onPlannedRoute, onClose, inline = false }: Props) {
  const mountainHuts = useMemo<HutFeature[]>(() => {
    if (!mountain || !huts) return [];
    const hutIds = new Set(mountain.hut_ids ?? []);
    return huts.features.filter(f => hutIds.has(f.properties.id));
  }, [mountain, huts]);

  const mountainLodgings = useMemo<LodgingFeature[]>(() => {
    if (!mountain || !lodgings) return [];
    const townIds = new Set((mountain.base_towns ?? []).map(t => t.osm_id));
    if (townIds.size === 0) return [];
    return lodgings.features.filter(f => townIds.has(f.properties.near_town));
  }, [mountain, lodgings]);

  const mountainParking = useMemo<ParkingFeature[]>(() => {
    if (!mountain || !parking) return [];
    return parking.features.filter(f => f.properties.mountain_no === mountain.no);
  }, [mountain, parking]);

  if (!mountain) return null;
  const yamap = mountain.external_links?.yamap;
  const routes = mountain.routes ?? [];

  // 표시할 코스: 선택된 게 있으면 그것, 없으면 primary 또는 첫 번째
  const activeRoute = selectedRouteId
    ? routes.find(r => r.route_id === selectedRouteId)
    : routes.find(r => r.is_primary) ?? routes[0];
  const activeProfile = activeRoute ? profilesById[activeRoute.route_id] : undefined;

  const wrapper = inline
    ? 'w-full h-full bg-white flex flex-col overflow-hidden'
    : 'absolute right-4 top-4 bottom-4 w-[400px] max-w-[calc(100vw-32px)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-[1000]';

  return (
    <div className={wrapper}>
      <header
        className="relative px-5 pt-4 pb-3 border-b border-gray-200 bg-gradient-to-br from-brand to-brand-dark text-white overflow-hidden"
        style={mountain.image?.thumb ? {
          backgroundImage: `linear-gradient(135deg, rgba(31,111,67,0.78) 0%, rgba(22,77,46,0.85) 100%), url(${mountain.image.thumb})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-xs opacity-80 mb-1">#{mountain.no} · {mountain.region}</div>
            <h2 className="text-2xl font-bold leading-tight drop-shadow">{mountain.name_ko}</h2>
            <div className="text-sm opacity-95 mt-0.5">
              {mountain.name_ja} <span className="text-xs opacity-75">({mountain.yomi})</span>
            </div>
          </div>
          <button onClick={onClose} className="text-white/90 hover:text-white text-2xl leading-none p-1" aria-label="닫기">
            ×
          </button>
        </div>
        <div className="relative flex gap-3 text-sm mt-3 opacity-95">
          <span className="font-mono font-semibold">{mountain.elevation_m.toLocaleString()}m</span>
          <span>·</span>
          <span>{mountain.prefectures_ko}</span>
        </div>
        {mountain.image?.commons && (
          <a href={mountain.image.commons} target="_blank" rel="noopener noreferrer"
            className="absolute bottom-1 right-2 text-[9px] opacity-60 hover:opacity-100">
            📷 Wikimedia Commons
          </a>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <section className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm text-gray-700 leading-relaxed">{mountain.summary_ko}</p>

          {/* 대표 사진 갤러리 (최대 3장) */}
          <PhotoGallery mountain={mountain} />


          {mountain.wiki_ko_summary && (
            <details className="mt-2 group">
              <summary className="text-xs text-brand cursor-pointer hover:text-brand-dark font-medium select-none">
                📖 위키피디아 한국어 요약 펼치기
              </summary>
              <div className="mt-2 p-3 rounded bg-blue-50/50 border border-blue-100 text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                {mountain.wiki_ko_summary}
                {mountain.wikipedia.ko && (
                  <a href={mountain.wikipedia.ko} target="_blank" rel="noopener noreferrer"
                    className="block mt-2 text-brand hover:underline">
                    위키피디아 한국어판에서 더 보기 →
                  </a>
                )}
              </div>
            </details>
          )}
        </section>

        {/* 코스 리스트 */}
        {routes.length > 0 ? (
          <section className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900">등산 코스 ({routes.length}개)</h3>
              {selectedRouteId && (
                <button onClick={() => onSelectRoute(null)} className="text-[11px] text-gray-500 hover:text-brand">
                  선택 해제
                </button>
              )}
            </div>
            <ul className="space-y-1.5 mb-3">
              {routes.map(r => {
                const isSelected = activeRoute?.route_id === r.route_id;
                return (
                  <li key={r.route_id}>
                    <button
                      onClick={() => onSelectRoute(r.route_id)}
                      className={`w-full text-left px-3 py-2 rounded border transition ${
                        isSelected
                          ? 'border-red-500 bg-red-50'
                          : r.is_primary
                            ? 'border-brand bg-brand-light hover:border-brand-dark'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {r.is_primary && <span className="text-[10px] text-brand-dark font-bold mr-1">★대표</span>}
                            {r.name_ko || r.name_ja}
                          </div>
                          {r.name_ko && r.name_ja && r.name_ko !== r.name_ja && (
                            <div className="text-[11px] text-gray-500 truncate mt-0.5">{r.name_ja}</div>
                          )}
                        </div>
                        <Stars n={r.difficulty_stars} />
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {r.distance_km}km · 상승 {r.ascent_m}m
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* 활성 코스의 표고 프로필 */}
            {activeRoute && (
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  {activeRoute.name_ko || activeRoute.name_ja} 표고 프로필
                </div>
                <ElevationProfile profile={activeProfile} />
              </div>
            )}
          </section>
        ) : (
          <section className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-1">등산 코스</h3>
            <p className="text-xs text-gray-500 italic">OSM에 등산로 데이터가 부족해 코스 라인이 없습니다.</p>
          </section>
        )}

        {/* 산장 */}
        {mountainHuts.length > 0 && (
          <section className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-2">
              산장·대피소 <span className="text-xs text-gray-500 font-normal">({mountainHuts.length}곳)</span>
            </h3>
            <ul className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
              {mountainHuts.map(f => {
                const p = f.properties;
                const isSel = selectedHutId === p.id;
                const kindLabel =
                  p.kind === 'alpine_hut' ? '산장' :
                  p.kind === 'wilderness_hut' ? '대피소' :
                  p.kind === 'basic_hut' ? '간이 대피소' :
                  p.kind;
                const reservationLabel =
                  p.reservation === 'required' ? '예약 필수' :
                  p.reservation === 'recommended' ? '예약 권장' :
                  p.reservation === 'no' ? '예약 불요' :
                  p.reservation;
                const feeLabel = p.fee === 'yes' ? '유료' : p.fee === 'no' ? '무료' : p.fee;
                // 풍부한 정보가 있으면 강조 표시
                const hasRichInfo = !!(p.capacity || p.phone || p.website || p.opening_hours || p.fee);

                return (
                  <li key={p.id}>
                    <button
                      onClick={() => { onSelectHut(isSel ? null : p.id); onFocus?.('hut', p.id); }}
                      className={`w-full text-left px-3 py-2 rounded border transition flex gap-2 ${
                        isSel ? 'border-amber-500 bg-amber-50' :
                        hasRichInfo ? 'border-amber-200 bg-amber-50/40 hover:border-amber-400' :
                        'border-gray-200 bg-gray-50 hover:border-gray-400'
                      }`}
                    >
                      {p.image?.thumb && (
                        <img src={p.image.thumb} alt={p.name}
                          className="w-14 h-14 rounded object-cover flex-shrink-0 bg-gray-200"
                          loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          ⛺ {p.name}
                        </div>
                        {p.ele && <div className="text-xs text-gray-500 font-mono flex-shrink-0">{Math.round(p.ele)}m</div>}
                      </div>

                      {/* 기본 메타 */}
                      <div className="text-[11px] text-gray-600 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        <span>{kindLabel}</span>
                        {p.capacity && <span>· 수용 <b className="text-gray-900">{p.capacity}{typeof p.capacity === 'number' ? '명' : ''}</b></span>}
                        {feeLabel && <span>· {feeLabel}</span>}
                        {reservationLabel && <span>· {reservationLabel}</span>}
                      </div>

                      {/* 영업기간/시간 */}
                      {p.opening_hours && (
                        <div className="text-[11px] text-gray-600 mt-0.5">📅 {p.opening_hours}</div>
                      )}

                      {/* 운영자 */}
                      {p.operator && (
                        <div className="text-[11px] text-gray-500 mt-0.5">운영: {p.operator}</div>
                      )}

                      {/* 부대시설 아이콘 */}
                      {(p.fireplace === 'yes' || p.shower === 'yes' || p.internet_access === 'yes' || p.internet_access === 'wifi') && (
                        <div className="text-[11px] text-gray-500 mt-0.5 flex gap-2">
                          {p.fireplace === 'yes' && <span title="벽난로">🔥 벽난로</span>}
                          {p.shower === 'yes' && <span title="샤워">🚿 샤워</span>}
                          {(p.internet_access === 'yes' || p.internet_access === 'wifi') && <span title="와이파이">📶 wifi</span>}
                        </div>
                      )}

                      {/* 연락처 + 링크 */}
                      {(p.phone || p.website || p.wikipedia_url || p.email) && (
                        <div className="text-[11px] mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                          {p.phone && (
                            <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()}
                               className="text-brand hover:underline">📞 {p.phone}</a>
                          )}
                          {p.email && (
                            <a href={`mailto:${p.email}`} onClick={e => e.stopPropagation()}
                               className="text-brand hover:underline">✉ 이메일</a>
                          )}
                          {p.website && (
                            <a href={p.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                               className="text-brand hover:underline font-semibold">🌐 공식 홈페이지 →</a>
                          )}
                          {p.wikipedia_url && (
                            <a href={p.wikipedia_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                               className="text-brand hover:underline">📖 위키(日)</a>
                          )}
                          {p.wikipedia_ko && (
                            <a href={p.wikipedia_ko} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                               className="text-brand hover:underline">📖 위키(韓)</a>
                          )}
                          {p.wikipedia_en && (
                            <a href={p.wikipedia_en} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                               className="text-brand hover:underline">📖 Wiki(EN)</a>
                          )}
                        </div>
                      )}
                      {/* Wikidata에서 가져온 일본어 설명문 */}
                      {p.description && (
                        <div className="mt-1 text-[10px] text-gray-500 line-clamp-2 italic">
                          {p.description}
                        </div>
                      )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* 자동차 경로 — 사용자 입력 출발지에서 산까지 */}
        <RoutePlanner
          destLat={mountain.coordinates.lat}
          destLon={mountain.coordinates.lon}
          destName={mountain.name_ko}
          onRouteResult={onPlannedRoute}
        />

        {/* 시즌 등산버스·산악 교통 (큐레이션) */}
        {mountain.transit_notes && mountain.transit_notes.length > 0 && (
          <section className="px-5 py-4 border-b border-gray-100 bg-amber-50/40">
            <h3 className="text-sm font-bold text-amber-900 mb-2">
              ⛰ 시즌 등산버스·산악 교통
            </h3>
            <ul className="space-y-1.5">
              {mountain.transit_notes.map((n, i) => (
                <li key={i} className="px-3 py-2 rounded border border-amber-300 bg-white">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <div className="text-sm font-semibold text-amber-900">{n.title}</div>
                    {n.season && <span className="text-[10px] text-amber-700 font-mono flex-shrink-0">📅 {n.season}</span>}
                  </div>
                  <div className="text-xs text-gray-700 leading-relaxed">{n.description}</div>
                  {n.official_url && (
                    <a href={n.official_url} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-brand hover:underline mt-1 inline-block font-medium">공식 사이트 →</a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 베이스타운 + 숙소 */}
        {mountain.base_towns && mountain.base_towns.length > 0 && (
          <section className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-2">
              베이스타운 <span className="text-xs text-gray-500 font-normal">(등산 거점 도시)</span>
            </h3>
            <ul className="space-y-1.5 mb-3">
              {mountain.base_towns.map(t => {
                const lodgingsCount = mountainLodgings.filter(l => l.properties.near_town === t.osm_id).length;
                return (
                  <li key={t.osm_id}
                    onClick={() => onFocus?.('town', t.osm_id)}
                    className="px-3 py-2 rounded border border-gray-200 bg-gray-50 cursor-pointer hover:border-brand hover:bg-brand-light transition">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                        {t.name_en && <span className="text-[11px] text-gray-500 ml-1.5">({t.name_en})</span>}
                      </div>
                      <span className="text-[11px] text-gray-500 font-mono">{t.dist_km}km</span>
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 flex flex-wrap gap-x-2">
                      <span>{t.place === 'city' ? '시(市)' : '町'}</span>
                      {t.population && <span>· 인구 {Number(t.population).toLocaleString()}</span>}
                      {lodgingsCount > 0 && <span className="text-brand">· 숙소 {lodgingsCount}곳</span>}
                    </div>
                  </li>
                );
              })}
            </ul>

            {mountainLodgings.length > 0 && (
              <details className="border-t border-gray-100 pt-2">
                <summary className="text-xs font-semibold text-gray-700 cursor-pointer hover:text-brand">
                  주변 숙소 {mountainLodgings.length}곳 보기
                </summary>
                <ul className="mt-2 space-y-1 max-h-[260px] overflow-y-auto scrollbar-thin pr-1">
                  {mountainLodgings.slice(0, 50).map(l => {
                    const p = l.properties;
                    const kindLabel =
                      p.kind === 'hotel' ? '호텔' :
                      p.kind === 'ryokan' ? '료칸' :
                      p.kind === 'guest_house' ? '게스트하우스' :
                      p.kind === 'hostel' ? '호스텔' :
                      p.kind === 'apartment' ? '아파트' :
                      p.kind;
                    return (
                      <li key={p.id}
                        onClick={() => onFocus?.('lodging', p.id)}
                        className="px-2.5 py-1.5 rounded bg-white border border-gray-100 cursor-pointer hover:border-brand hover:bg-brand-light transition">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-[12px] font-medium text-gray-900 truncate">{p.name || '(이름 없음)'}</div>
                          <span className="text-[10px] text-gray-500 flex-shrink-0">{kindLabel}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{p.near_town_name}</div>
                        {(p.phone || p.website) && (
                          <div className="text-[10px] mt-0.5 flex gap-2 flex-wrap">
                            {p.phone && <a href={`tel:${p.phone}`} className="text-brand hover:underline">📞 {p.phone}</a>}
                            {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-semibold">🌐 공식</a>}
                          </div>
                        )}
                        {/* 숙소 이름으로 글로벌 사이트 검색 */}
                        {p.name && p.name !== '(이름 없음)' && (() => {
                          const kw = encodeURIComponent(p.name);
                          return (
                            <div className="text-[10px] mt-0.5 flex gap-1.5 flex-wrap text-gray-500">
                              검색:
                              <a href={`https://www.booking.com/searchresults.html?ss=${kw}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Booking</a>
                              <a href={`https://www.trip.com/hotels/list?keyword=${kw}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Trip</a>
                              <a href={`https://www.google.com/maps/search/${kw}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Maps</a>
                            </div>
                          );
                        })()}
                      </li>
                    );
                  })}
                </ul>
                {/* 외부 예약 검색 링크 — 글로벌 + 일본 로컬 */}
                {mountain.base_towns[0] && (
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <div className="text-[11px] font-semibold text-gray-700 mb-1.5">
                      🌐 외부 예약 검색 — <span className="font-normal text-gray-500">{mountain.base_towns[0].name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      {(() => {
                        const kw = encodeURIComponent(mountain.base_towns[0].name);
                        const links: Array<{label: string; url: string; flag: string}> = [
                          { label: 'Booking.com',  url: `https://www.booking.com/searchresults.html?ss=${kw}`, flag: '🌍' },
                          { label: 'Hotels.com',   url: `https://hotels.com/search.do?q-destination=${kw}`, flag: '🌍' },
                          { label: 'Trip.com',     url: `https://www.trip.com/hotels/list?keyword=${kw}`, flag: '🌍' },
                          { label: 'Agoda',        url: `https://www.agoda.com/search?q=${kw}`, flag: '🌍' },
                          { label: 'Expedia',      url: `https://www.expedia.com/Hotel-Search?destination=${kw}`, flag: '🌍' },
                          { label: 'Airbnb',       url: `https://www.airbnb.com/s/${kw}/homes`, flag: '🌍' },
                          { label: 'Jalan',        url: `https://www.jalan.net/uw/uwp1100/uww1101.do?stayCount=1&adultNum=1&yadoAreaSrchKbn=keyword&keyword=${kw}`, flag: '🇯🇵' },
                          { label: '라쿠텐 트래블', url: `https://travel.rakuten.co.jp/dsearch/search?keyword=${kw}`, flag: '🇯🇵' },
                        ];
                        return links.map(l => (
                          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                            className="px-2 py-1 rounded border border-gray-200 hover:border-brand hover:bg-brand-light text-gray-700 hover:text-brand-dark transition flex items-center gap-1">
                            <span className="text-[10px]">{l.flag}</span>
                            <span className="truncate">{l.label}</span>
                          </a>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </details>
            )}
          </section>
        )}

        {/* 교통 — 가장 가까운 역 + 환승 검색 */}
        {mountain.stations && mountain.stations.length > 0 && (
          <section className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-2">
              🚉 교통 <span className="text-xs text-gray-500 font-normal">(가까운 역·터미널)</span>
            </h3>
            <ul className="space-y-1.5 mb-3">
              {mountain.stations.slice(0, 5).map(s => {
                const kindLabel = s.kind === 'station' ? '역' :
                  s.kind === 'bus_station' ? '버스 터미널' :
                  s.kind === 'tram_stop' ? '트램' :
                  s.kind === 'halt' ? '정거장' : s.kind;
                const kw = encodeURIComponent(s.name);
                return (
                  <li key={s.osm_id}
                    onClick={() => onFocus?.('station', s.osm_id)}
                    className="px-3 py-2 rounded border border-gray-200 bg-gray-50 cursor-pointer hover:border-brand hover:bg-brand-light transition">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {s.kind === 'bus_station' ? '🚌' : '🚉'} {s.name}
                        </span>
                        {s.name_en && <span className="text-[11px] text-gray-500 ml-1.5">({s.name_en})</span>}
                      </div>
                      <span className="text-[11px] text-gray-500 font-mono flex-shrink-0">{s.dist_to_summit_km}km</span>
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 flex flex-wrap gap-x-2">
                      <span>{kindLabel}</span>
                      {s.operator && <span>· {s.operator}</span>}
                      <span>· {s.near_town_name}</span>
                    </div>
                    {/* 역 → 트레일헤드 거리·시간 */}
                    {(s.osrm_dist_km || s.trailhead_dist_km) && (
                      <div className="mt-1 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-[11px]">
                        <span className="text-gray-700">→ 등산로 입구까지: </span>
                        {s.osrm_dist_km != null && s.osrm_dur_min != null ? (
                          <span className="font-mono font-semibold text-amber-900">
                            🚗 {s.osrm_dist_km}km / {s.osrm_dur_min}분
                          </span>
                        ) : (
                          <span className="font-mono text-amber-900">
                            직선 {s.trailhead_dist_km}km
                          </span>
                        )}
                        {s.trailhead_walk_min && s.trailhead_dist_km && s.trailhead_dist_km < 5 && (
                          <span className="text-gray-600 ml-1.5">· 🚶 도보 {s.trailhead_walk_min}분</span>
                        )}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      <a href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`}
                        target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">🗺 위치 보기</a>
                      <a href={`https://transit.yahoo.co.jp/search/result?to=${kw}`}
                        target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Yahoo!환승</a>
                      <a href={`https://www.jorudan.co.jp/norikae/cgi/nori.cgi?eki2=${kw}`}
                        target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Jorudan</a>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* 트레일헤드 주변 주차장 */}
            {mountainParking.length > 0 && (
              <div className="border-t border-gray-100 pt-2 mb-2">
                <div className="text-[11px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                  🅿 등산구 주변 주차장 <span className="text-gray-500 font-normal">({mountainParking.length}곳)</span>
                </div>
                <ul className="space-y-1 max-h-[180px] overflow-y-auto scrollbar-thin pr-1">
                  {mountainParking.slice(0, 20).map(f => {
                    const p = f.properties;
                    const [lon, lat] = f.geometry.coordinates;
                    return (
                      <li key={p.id}
                        onClick={() => onFocus?.('parking', p.id)}
                        className="px-2 py-1 rounded bg-gray-50 border border-gray-200 cursor-pointer hover:border-brand hover:bg-brand-light transition">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-[12px] font-medium text-gray-900 truncate">🅿 {p.name}</div>
                          <span className="text-[10px] text-gray-500 flex-shrink-0 font-mono">등산로까지 {p.dist_to_trailhead_m}m</span>
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5 flex flex-wrap gap-x-2">
                          {p.capacity && <span>수용 {p.capacity}대</span>}
                          {p.fee === 'yes' && <span>· 유료</span>}
                          {p.fee === 'no' && <span>· 무료</span>}
                          <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-brand hover:underline ml-auto">🗺 위치 보기</a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 메이저 도시 발 검색 — 도쿄·오사카·나고야 → 가장 가까운 역 */}
            {mountain.stations[0] && (() => {
              const dest = encodeURIComponent(mountain.stations[0].name);
              const cities = [
                { from: '東京', label: '도쿄' },
                { from: '新宿', label: '신주쿠' },
                { from: '大阪', label: '오사카' },
                { from: '名古屋', label: '나고야' },
              ];
              return (
                <div className="border-t border-gray-100 pt-2">
                  <div className="text-[11px] font-semibold text-gray-700 mb-1">
                    주요 도시에서 {mountain.stations[0].name}까지
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    {cities.map(c => (
                      <a key={c.from}
                        href={`https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(c.from)}&to=${dest}`}
                        target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 rounded border border-gray-200 hover:border-brand hover:bg-brand-light text-gray-700 hover:text-brand-dark transition">
                        🚆 {c.label} 발
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* YAMAP */}
        {yamap && (
          <section className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-gray-900">YAMAP</h3>
              {yamap.difficulty_label && (
                <span className="px-2 py-0.5 text-[11px] rounded bg-orange-100 text-orange-800 font-semibold">
                  {yamap.difficulty_label}
                </span>
              )}
            </div>
            {yamap.description && (
              <div className="mb-2">
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{yamap.description}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                  <a
                    href={`https://translate.google.com/?sl=ja&tl=ko&text=${encodeURIComponent(yamap.description)}&op=translate`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-brand hover:underline">
                    🌐 Google 번역
                  </a>
                  <a
                    href={`https://www.deepl.com/translator#ja/ko/${encodeURIComponent(yamap.description)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-brand hover:underline">
                    DeepL
                  </a>
                  <a
                    href={`https://papago.naver.com/?sk=ja&tk=ko&st=${encodeURIComponent(yamap.description)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-brand hover:underline">
                    Papago
                  </a>
                </div>
              </div>
            )}
            {yamap.classification && (
              <p className="text-[11px] text-gray-500 mb-2">분류: {yamap.classification}</p>
            )}
            <a href={yamap.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-dark">
              YAMAP에서 더 보기 →
            </a>
          </section>
        )}

        <section className="px-5 py-4">
          <h3 className="text-sm font-bold text-gray-900 mb-2">외부 자료</h3>
          <div className="flex flex-col gap-1.5">
            {mountain.wikipedia.ko && (
              <a href={mountain.wikipedia.ko} target="_blank" rel="noopener noreferrer"
                className="text-sm text-brand hover:text-brand-dark">위키피디아 한국어 →</a>
            )}
            {mountain.wikipedia.ja && (
              <a href={mountain.wikipedia.ja} target="_blank" rel="noopener noreferrer"
                className="text-sm text-brand hover:text-brand-dark">위키피디아 일본어 →</a>
            )}
            {mountain.wikipedia.en && (
              <a href={mountain.wikipedia.en} target="_blank" rel="noopener noreferrer"
                className="text-sm text-brand hover:text-brand-dark">Wikipedia (English) →</a>
            )}
            <a href={`https://www.openstreetmap.org/?mlat=${mountain.coordinates.lat}&mlon=${mountain.coordinates.lon}#map=12/${mountain.coordinates.lat}/${mountain.coordinates.lon}`}
              target="_blank" rel="noopener noreferrer"
              className="text-sm text-brand hover:text-brand-dark">OpenStreetMap에서 보기 →</a>
          </div>
          <div className="text-[11px] text-gray-400 mt-3">
            좌표: {mountain.coordinates.lat.toFixed(4)}, {mountain.coordinates.lon.toFixed(4)}
          </div>
        </section>
      </div>
    </div>
  );
}
