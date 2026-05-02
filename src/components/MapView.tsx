'use client';

import { useEffect, useRef } from 'react';
import type { Mountain, HutsGeoJSON, HutFeature, LodgingsGeoJSON, LodgingFeature, StationsGeoJSON, StationFeature, ParkingGeoJSON, ParkingFeature } from '@/lib/types';

interface Props {
  mountains: Mountain[];
  geojson: any | null;
  huts: HutsGeoJSON | null;
  lodgings: LodgingsGeoJSON | null;
  stations: StationsGeoJSON | null;
  parking: ParkingGeoJSON | null;
  visibleNos: Set<number>;
  selectedNo: number | null;
  selectedRouteId: string | null;
  // 카드 클릭 시 지도 포커스 — kind+id로 마커 찾아 flyTo + 팝업 오픈
  focusItem?: { kind: 'station' | 'hut' | 'lodging' | 'parking' | 'town'; id: string; ts: number } | null;
  // 사용자가 입력한 출발지에서 산까지의 경로
  plannedRoute?: { geometry: any; label: string } | null;
  onSelect: (no: number) => void;
  onSelectHut?: (hutId: string | null) => void;
}

const STYLE_DIM        = { color: '#1f6f43', weight: 1.5, opacity: 0.35 };  // 비선택 산
const STYLE_HIGHLIGHT  = { color: '#2563eb', weight: 3,   opacity: 0.85 };  // 선택 산의 다른 코스
const STYLE_ACTIVE     = { color: '#d32f2f', weight: 4,   opacity: 0.95 };  // 선택된 코스

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default function MapView({ mountains, geojson, huts, lodgings, stations, parking, visibleNos, selectedNo, selectedRouteId, focusItem, plannedRoute, onSelect, onSelectHut }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const LRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const markersLayerRef = useRef<any>(null);
  const linesLayerRef = useRef<any>(null);
  const linesByNoRef = useRef<Map<number, any[]>>(new Map());
  const lineByRouteIdRef = useRef<Map<string, any>>(new Map());
  const prevSelectedNoRef = useRef<number | null>(null);
  const prevSelectedRouteIdRef = useRef<string | null>(null);
  const hutsLayerRef = useRef<any>(null);
  const hutMarkersByMountainRef = useRef<Map<number, any[]>>(new Map());
  const townsLayerRef = useRef<any>(null);
  const townMarkersByMountainRef = useRef<Map<number, any[]>>(new Map());
  const lodgingsLayerRef = useRef<any>(null);
  const lodgingMarkersByMountainRef = useRef<Map<number, any[]>>(new Map());
  const stationsLayerRef = useRef<any>(null);
  const stationMarkersByMountainRef = useRef<Map<number, any[]>>(new Map());
  const parkingLayerRef = useRef<any>(null);
  const parkingMarkersByMountainRef = useRef<Map<number, any[]>>(new Map());
  const trailheadsLayerRef = useRef<any>(null);
  const trailheadMarkersByMountainRef = useRef<Map<number, any[]>>(new Map());
  const plannedRouteLayerRef = useRef<any>(null);
  // 카드 클릭 시 찾기 위한 인덱스
  const stationByOsmIdRef = useRef<Map<string, any>>(new Map());
  const hutByIdRef = useRef<Map<string, any>>(new Map());
  const lodgingByIdRef = useRef<Map<string, any>>(new Map());
  const parkingByIdRef = useRef<Map<string, any>>(new Map());
  const townByOsmIdRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      if (mountains.length === 0) return;

      const L = (await import('leaflet')).default;
      if (cancelled) return;
      LRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        preferCanvas: true,
        zoomAnimation: true,
        markerZoomAnimation: true,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
        keepBuffer: 4,
      } as any).addTo(map);

      const lats = mountains.map(m => m.coordinates.lat);
      const lons = mountains.map(m => m.coordinates.lon);
      map.fitBounds([[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]], { padding: [40, 40] });

      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
      const ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(containerRef.current!);
      (map as any)._resizeObserver = ro;

      // 마커
      const mLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = mLayer;
      mountains.forEach(m => {
        const stars = m.routes?.[0]?.difficulty_stars;
        const cls = stars ? `diff-${stars}` : 'diff-na';
        const icon = L.divIcon({
          className: `mountain-marker ${cls}`,
          html: `<span>${m.no}</span>`,
          iconSize: [26, 26],
        });
        const mk = L.marker([m.coordinates.lat, m.coordinates.lon], { icon, riseOnHover: true });
        mk.bindTooltip(`${m.name_ko} (${m.elevation_m}m)`, { direction: 'top', offset: [0, -8] });
        mk.on('click', () => onSelect(m.no));
        markersRef.current.set(m.no, mk);
        mLayer.addLayer(mk);
      });

      // GeoJSON 라인
      if (geojson) {
        linesLayerRef.current = L.geoJSON(geojson, {
          style: STYLE_DIM,
          interactive: false,
          onEachFeature: (feat, layer) => {
            const no = feat.properties.mountain_no;
            const rid = feat.properties.route_id;
            if (!linesByNoRef.current.has(no)) linesByNoRef.current.set(no, []);
            linesByNoRef.current.get(no)!.push(layer);
            lineByRouteIdRef.current.set(rid, layer);
          },
        }).addTo(map);
      }

      // 산장 layer (마커는 미리 만들어두고, 산 선택 시 add/remove)
      if (huts) {
        const hutsLayer = L.layerGroup();
        hutsLayerRef.current = hutsLayer;
        const hutIcon = L.divIcon({ className: 'hut-marker', html: '', iconSize: [22, 22] });
        // 각 산장이 어느 산에 속하는지 찾아 인덱싱
        huts.features.forEach((feat: HutFeature) => {
          const [lon, lat] = feat.geometry.coordinates;
          const p = feat.properties;
          const mk = L.marker([lat, lon], { icon: hutIcon, riseOnHover: true });
          const eleStr = p.ele ? `${Math.round(p.ele)}m` : '';
          const tooltip = p.name + (eleStr ? ` (${eleStr})` : '');
          mk.bindTooltip(tooltip, { direction: 'top', offset: [0, -8] });

          // 팝업 (마커 클릭) — 풍부한 정보
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

          const lines: string[] = [];
          lines.push(`<div style="font-weight:700;font-size:14px;margin-bottom:4px">⛺ ${escapeHtml(p.name)}</div>`);

          const meta: string[] = [kindLabel];
          if (p.ele) meta.push(`${Math.round(p.ele)}m`);
          if (p.capacity) meta.push(`수용 <b>${escapeHtml(String(p.capacity))}${typeof p.capacity === 'number' ? '명' : ''}</b>`);
          if (feeLabel) meta.push(escapeHtml(String(feeLabel)));
          if (reservationLabel) meta.push(escapeHtml(String(reservationLabel)));
          lines.push(`<div style="font-size:11px;color:#555;margin-bottom:5px">${meta.join(' · ')}</div>`);

          if (p.opening_hours) lines.push(`<div style="font-size:11px;color:#555;margin-bottom:3px">📅 ${escapeHtml(p.opening_hours)}</div>`);
          if (p.operator) lines.push(`<div style="font-size:11px;color:#777;margin-bottom:3px">운영: ${escapeHtml(p.operator)}</div>`);

          // 부대시설
          const amen: string[] = [];
          if (p.fireplace === 'yes') amen.push('🔥 벽난로');
          if (p.shower === 'yes') amen.push('🚿 샤워');
          if (p.internet_access === 'yes' || p.internet_access === 'wifi') amen.push('📶 wifi');
          if (amen.length) lines.push(`<div style="font-size:11px;color:#555;margin-bottom:3px">${amen.join(' · ')}</div>`);

          // 연락
          const linkLines: string[] = [];
          if (p.phone) linkLines.push(`📞 <a href="tel:${escapeHtml(p.phone)}" style="color:#1f6f43">${escapeHtml(p.phone)}</a>`);
          if (p.email) linkLines.push(`✉ <a href="mailto:${escapeHtml(p.email)}" style="color:#1f6f43">이메일</a>`);
          if (p.website) linkLines.push(`🌐 <a href="${escapeHtml(p.website)}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43;font-weight:600">공식 홈페이지 →</a>`);
          if (p.wikipedia_url) linkLines.push(`📖 <a href="${escapeHtml(p.wikipedia_url)}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">위키 →</a>`);
          if (linkLines.length) lines.push(`<div style="font-size:11px;margin-top:4px;display:flex;flex-direction:column;gap:2px">${linkLines.map(l => `<div>${l}</div>`).join('')}</div>`);
          mk.bindPopup(lines.join(''), { maxWidth: 320 });

          mk.on('click', (ev: any) => {
            ev.originalEvent?.stopPropagation?.();
            onSelectHut?.(p.id);
          });
          hutByIdRef.current.set(p.id, mk);
          // 연결된 산들에 이 마커 등록
          const linkedNos = new Set<number>();
          p.route_associations.forEach(ra => linkedNos.add(ra.mountain_no));
          if (linkedNos.size === 0) linkedNos.add(p.nearest_mountain_no);
          linkedNos.forEach(n => {
            if (!hutMarkersByMountainRef.current.has(n)) hutMarkersByMountainRef.current.set(n, []);
            hutMarkersByMountainRef.current.get(n)!.push(mk);
          });
        });
        hutsLayer.addTo(map);
      }

      // 베이스타운 layer
      const townsLayer = L.layerGroup();
      townsLayerRef.current = townsLayer;
      mountains.forEach(m => {
        if (!m.base_towns || m.base_towns.length === 0) return;
        m.base_towns.forEach((t: any) => {
          const cls = `basetown-marker ${t.place === 'city' ? 'city' : 'town'}`;
          const icon = L.divIcon({
            className: cls,
            html: `<span>${escapeHtml(t.name)}</span>`,
            iconSize: undefined as any,
          });
          const mk = L.marker([t.lat, t.lon], { icon, riseOnHover: true });
          const popupHtml = `
            <div style="font-weight:700;font-size:13px;margin-bottom:3px">🏘 ${escapeHtml(t.name)}</div>
            <div style="font-size:11px;color:#555;margin-bottom:2px">${t.place === 'city' ? '시(市)' : '町/村'}${t.population ? ` · 인구 ${Number(t.population).toLocaleString()}` : ''}</div>
            <div style="font-size:11px;color:#555">정상까지 약 ${t.dist_km}km</div>
          `;
          mk.bindPopup(popupHtml, { maxWidth: 240 });
          townByOsmIdRef.current.set(t.osm_id, mk);
          if (!townMarkersByMountainRef.current.has(m.no)) townMarkersByMountainRef.current.set(m.no, []);
          townMarkersByMountainRef.current.get(m.no)!.push(mk);
        });
      });
      townsLayer.addTo(map);

      // 숙소 layer
      if (lodgings) {
        const lodgingsLayer = L.layerGroup();
        lodgingsLayerRef.current = lodgingsLayer;
        // mountain_no -> lodging markers (베이스타운 osm_id 매칭)
        const townToMountains = new Map<string, number[]>();
        mountains.forEach(m => {
          (m.base_towns ?? []).forEach((t: any) => {
            if (!townToMountains.has(t.osm_id)) townToMountains.set(t.osm_id, []);
            townToMountains.get(t.osm_id)!.push(m.no);
          });
        });
        lodgings.features.forEach((feat: LodgingFeature) => {
          const [lon, lat] = feat.geometry.coordinates;
          const p = feat.properties;
          const cls = `lodging-marker ${p.kind}`;
          const icon = L.divIcon({ className: cls, html: '', iconSize: [14, 14] });
          const mk = L.marker([lat, lon], { icon, riseOnHover: true });
          const kindLabel =
            p.kind === 'hotel' ? '호텔' : p.kind === 'ryokan' ? '료칸' :
            p.kind === 'guest_house' ? '게스트하우스' : p.kind === 'hostel' ? '호스텔' :
            p.kind === 'apartment' ? '아파트' : p.kind === 'motel' ? '모텔' : p.kind;
          const lines: string[] = [];
          lines.push(`<div style="font-weight:700;font-size:13px;margin-bottom:3px">🏨 ${escapeHtml(p.name)}</div>`);
          lines.push(`<div style="font-size:11px;color:#666;margin-bottom:3px">${kindLabel} · ${escapeHtml(p.near_town_name)}</div>`);
          if (p.phone) lines.push(`<div style="font-size:11px"><a href="tel:${escapeHtml(p.phone)}" style="color:#1f6f43">📞 ${escapeHtml(p.phone)}</a></div>`);
          if (p.website) lines.push(`<div style="font-size:11px"><a href="${escapeHtml(p.website)}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43;font-weight:600">🌐 공식 사이트 →</a></div>`);
          // 외부 검색
          const searchKw = encodeURIComponent(p.name);
          lines.push(`<div style="font-size:10px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;color:#888">외부 검색:</div>`);
          lines.push(`<div style="font-size:11px;display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">
            <a href="https://www.booking.com/searchresults.html?ss=${searchKw}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">Booking</a>
            <a href="https://hotels.com/search.do?q-destination=${searchKw}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">Hotels.com</a>
            <a href="https://www.trip.com/hotels/list?keyword=${searchKw}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">Trip.com</a>
            <a href="https://www.agoda.com/search?q=${searchKw}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">Agoda</a>
          </div>`);
          mk.bindPopup(lines.join(''), { maxWidth: 280 });
          lodgingByIdRef.current.set(p.id, mk);

          const mNos = townToMountains.get(p.near_town) || [];
          mNos.forEach(n => {
            if (!lodgingMarkersByMountainRef.current.has(n)) lodgingMarkersByMountainRef.current.set(n, []);
            lodgingMarkersByMountainRef.current.get(n)!.push(mk);
          });
        });
        lodgingsLayer.addTo(map);
      }

      // 역 layer
      if (stations) {
        const stationsLayer = L.layerGroup();
        stationsLayerRef.current = stationsLayer;
        // 산별 역 매핑 (산의 stations 필드 활용)
        const stationByOsmId = new Map<string, StationFeature>();
        stations.features.forEach((f: StationFeature) => stationByOsmId.set(f.properties.osm_id, f));
        mountains.forEach(m => {
          (m.stations ?? []).forEach((s: any) => {
            const feat = stationByOsmId.get(s.osm_id);
            if (!feat) return;
            const [lon, lat] = feat.geometry.coordinates;
            const p = feat.properties;
            const cls = `station-marker ${p.kind === 'bus_station' ? 'bus_station' : ''}`;
            const icon = L.divIcon({ className: cls, html: '', iconSize: [22, 22] });
            const mk = L.marker([lat, lon], { icon, riseOnHover: true, zIndexOffset: 500 });
            mk.bindTooltip(p.name, { direction: 'top', offset: [0, -8] });
            const kindLabel = p.kind === 'station' ? '역' : p.kind === 'bus_station' ? '버스 터미널' :
                              p.kind === 'tram_stop' ? '트램 정류장' : p.kind === 'halt' ? '정거장' : p.kind;
            const lines: string[] = [];
            lines.push(`<div style="font-weight:700;font-size:13px;margin-bottom:3px">${p.kind === 'bus_station' ? '🚌' : '🚉'} ${escapeHtml(p.name)}</div>`);
            const meta: string[] = [kindLabel];
            if (p.operator) meta.push(escapeHtml(p.operator));
            lines.push(`<div style="font-size:11px;color:#555;margin-bottom:4px">${meta.join(' · ')}</div>`);
            // 환승 검색 링크
            const kw = encodeURIComponent(p.name);
            lines.push(`<div style="font-size:11px;display:flex;flex-direction:column;gap:2px">
              <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">🗺 Google Maps에서 보기</a>
              <a href="https://transit.yahoo.co.jp/search/result?to=${kw}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">🚆 Yahoo!Japan 환승</a>
              <a href="https://www.jorudan.co.jp/norikae/cgi/nori.cgi?eki2=${kw}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">🚆 Jorudan 환승</a>
            </div>`);
            mk.bindPopup(lines.join(''), { maxWidth: 260 });
            stationByOsmIdRef.current.set(p.osm_id, mk);

            if (!stationMarkersByMountainRef.current.has(m.no)) stationMarkersByMountainRef.current.set(m.no, []);
            stationMarkersByMountainRef.current.get(m.no)!.push(mk);
          });
        });
        stationsLayer.addTo(map);
      }

      // 트레일헤드 layer (코스 시작점)
      const thLayer = L.layerGroup();
      trailheadsLayerRef.current = thLayer;
      if (geojson) {
        geojson.features.forEach((f: any) => {
          const p = f.properties;
          const lat = p.trailhead_lat, lon = p.trailhead_lon;
          if (lat == null || lon == null) return;
          const icon = L.divIcon({ className: 'trailhead-marker', html: '', iconSize: [16, 16] });
          const mk = L.marker([lat, lon], { icon, riseOnHover: true, zIndexOffset: 600 });
          mk.bindTooltip(`등산로 입구 — ${p.route_name_ja || ''}`, { direction: 'top', offset: [0, -8] });
          mk.bindPopup(`
            <div style="font-weight:700;font-size:13px;margin-bottom:3px">🥾 등산로 입구</div>
            <div style="font-size:11px;color:#555;margin-bottom:3px">${escapeHtml(p.route_name_ja || '')}</div>
            <div style="font-size:11px;color:#666">${p.distance_km}km · 누적상승 ${p.ascent_m}m</div>
            <div style="font-size:11px;margin-top:4px">
              <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">🗺 Google Maps에서 보기</a>
            </div>
          `, { maxWidth: 240 });
          if (!trailheadMarkersByMountainRef.current.has(p.mountain_no)) trailheadMarkersByMountainRef.current.set(p.mountain_no, []);
          trailheadMarkersByMountainRef.current.get(p.mountain_no)!.push(mk);
        });
      }
      thLayer.addTo(map);

      // 주차장 layer
      if (parking) {
        const pLayer = L.layerGroup();
        parkingLayerRef.current = pLayer;
        parking.features.forEach((f: ParkingFeature) => {
          const [lon, lat] = f.geometry.coordinates;
          const p = f.properties;
          const icon = L.divIcon({ className: 'parking-marker', html: '', iconSize: [18, 18] });
          const mk = L.marker([lat, lon], { icon, riseOnHover: true, zIndexOffset: 400 });
          mk.bindTooltip(p.name, { direction: 'top', offset: [0, -8] });
          const lines: string[] = [];
          lines.push(`<div style="font-weight:700;font-size:13px;margin-bottom:3px">🅿 ${escapeHtml(p.name)}</div>`);
          const meta: string[] = [];
          if (p.capacity) meta.push(`수용 ${escapeHtml(p.capacity)}대`);
          if (p.fee === 'yes') meta.push('유료');
          else if (p.fee === 'no') meta.push('무료');
          if (p.dist_to_trailhead_m) meta.push(`등산로까지 ${p.dist_to_trailhead_m}m`);
          if (meta.length) lines.push(`<div style="font-size:11px;color:#555;margin-bottom:3px">${meta.join(' · ')}</div>`);
          if (p.operator) lines.push(`<div style="font-size:11px;color:#777;margin-bottom:3px">운영: ${escapeHtml(p.operator)}</div>`);
          lines.push(`<div style="font-size:11px;margin-top:4px"><a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener noreferrer" style="color:#1f6f43">🗺 Google Maps에서 보기</a></div>`);
          mk.bindPopup(lines.join(''), { maxWidth: 260 });
          parkingByIdRef.current.set(p.id, mk);
          if (!parkingMarkersByMountainRef.current.has(p.mountain_no)) parkingMarkersByMountainRef.current.set(p.mountain_no, []);
          parkingMarkersByMountainRef.current.get(p.mountain_no)!.push(mk);
        });
        pLayer.addTo(map);
      }
    })();
    return () => {
      cancelled = true;
      const map = mapRef.current as any;
      if (map?._resizeObserver) {
        map._resizeObserver.disconnect();
        delete map._resizeObserver;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountains.length, !!geojson, !!huts, !!lodgings, !!stations, !!parking]);

  // 가시 마커
  useEffect(() => {
    const mLayer = markersLayerRef.current;
    if (!mLayer) return;
    markersRef.current.forEach((mk, no) => {
      const has = mLayer.hasLayer(mk);
      if (visibleNos.has(no) && !has) mLayer.addLayer(mk);
      else if (!visibleNos.has(no) && has) mLayer.removeLayer(mk);
    });
  }, [visibleNos]);

  // 선택 강조 — 산 + 코스
  useEffect(() => {
    const L = LRef.current;
    if (!L || !mapRef.current) return;

    // 이전 산의 모든 라인을 dim으로 복귀
    const prevNo = prevSelectedNoRef.current;
    if (prevNo !== null && prevNo !== selectedNo) {
      const layers = linesByNoRef.current.get(prevNo) || [];
      layers.forEach(l => { if (l.setStyle) { l.setStyle(STYLE_DIM); l.bringToBack && l.bringToBack(); } });
      const prevMarker = markersRef.current.get(prevNo);
      const el = prevMarker?.getElement?.();
      if (el) el.classList.remove('active');
    }

    // 새 산 강조
    if (selectedNo !== null) {
      const layers = linesByNoRef.current.get(selectedNo) || [];
      layers.forEach(l => {
        if (l.setStyle) { l.setStyle(STYLE_HIGHLIGHT); l.bringToFront && l.bringToFront(); }
      });
      const mk = markersRef.current.get(selectedNo);
      const el = mk?.getElement?.();
      if (el) el.classList.add('active');

      // 등산 코스 + 산 정상만으로 bounds — 멀리 있는 역/베이스타운 때문에
      // 줌아웃되어 등산로가 안 보이는 현상 방지
      let bounds: any = null;
      const extend = (latLng: any) => {
        if (!latLng) return;
        bounds = bounds ? bounds.extend(latLng) : L.latLngBounds(latLng, latLng);
      };
      layers.forEach(l => {
        if (l.getBounds) {
          const b = l.getBounds();
          if (b.isValid && b.isValid()) {
            bounds = bounds ? bounds.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
          }
        }
      });
      const m = mountains.find(x => x.no === selectedNo);
      if (m) extend([m.coordinates.lat, m.coordinates.lon]);

      if (bounds && bounds.isValid()) {
        // 코스 라인이 있으면 그 영역 + 약간 패딩, 너무 줌인 안 되도록 maxZoom 13
        mapRef.current.flyToBounds(bounds.pad(0.25), { duration: 0.5, maxZoom: 13 });
      } else if (m) {
        // 코스 폴리라인이 없는 산 — 정상 좌표 기준 zoom 12로 (등산로 패턴 보일 정도)
        mapRef.current.flyTo([m.coordinates.lat, m.coordinates.lon], 12, { duration: 0.5 });
      }
    }
    // 산장 마커 갱신
    const hutsLayer = hutsLayerRef.current;
    if (hutsLayer) {
      if (prevNo !== null && prevNo !== selectedNo) {
        const prevHuts = hutMarkersByMountainRef.current.get(prevNo) || [];
        prevHuts.forEach(h => hutsLayer.removeLayer(h));
      }
      if (selectedNo !== null) {
        const curHuts = hutMarkersByMountainRef.current.get(selectedNo) || [];
        curHuts.forEach(h => hutsLayer.addLayer(h));
      }
    }

    // 베이스타운 마커 갱신
    const townsLayer = townsLayerRef.current;
    if (townsLayer) {
      if (prevNo !== null && prevNo !== selectedNo) {
        const prevTowns = townMarkersByMountainRef.current.get(prevNo) || [];
        prevTowns.forEach(t => townsLayer.removeLayer(t));
      }
      if (selectedNo !== null) {
        const curTowns = townMarkersByMountainRef.current.get(selectedNo) || [];
        curTowns.forEach(t => townsLayer.addLayer(t));
      }
    }

    // 숙소 마커 갱신
    const lodgingsLayer = lodgingsLayerRef.current;
    if (lodgingsLayer) {
      if (prevNo !== null && prevNo !== selectedNo) {
        const prevL = lodgingMarkersByMountainRef.current.get(prevNo) || [];
        prevL.forEach(l => lodgingsLayer.removeLayer(l));
      }
      if (selectedNo !== null) {
        const curL = lodgingMarkersByMountainRef.current.get(selectedNo) || [];
        curL.forEach(l => lodgingsLayer.addLayer(l));
      }
    }

    // 역 마커 갱신
    const stationsLayer = stationsLayerRef.current;
    if (stationsLayer) {
      if (prevNo !== null && prevNo !== selectedNo) {
        const prevS = stationMarkersByMountainRef.current.get(prevNo) || [];
        prevS.forEach(s => stationsLayer.removeLayer(s));
      }
      if (selectedNo !== null) {
        const curS = stationMarkersByMountainRef.current.get(selectedNo) || [];
        curS.forEach(s => stationsLayer.addLayer(s));
      }
    }

    // 주차장 마커 갱신
    const parkingLayer = parkingLayerRef.current;
    if (parkingLayer) {
      if (prevNo !== null && prevNo !== selectedNo) {
        const prevP = parkingMarkersByMountainRef.current.get(prevNo) || [];
        prevP.forEach(p => parkingLayer.removeLayer(p));
      }
      if (selectedNo !== null) {
        const curP = parkingMarkersByMountainRef.current.get(selectedNo) || [];
        curP.forEach(p => parkingLayer.addLayer(p));
      }
    }

    // 트레일헤드 마커 갱신
    const thLayer = trailheadsLayerRef.current;
    if (thLayer) {
      if (prevNo !== null && prevNo !== selectedNo) {
        const prevT = trailheadMarkersByMountainRef.current.get(prevNo) || [];
        prevT.forEach(t => thLayer.removeLayer(t));
      }
      if (selectedNo !== null) {
        const curT = trailheadMarkersByMountainRef.current.get(selectedNo) || [];
        curT.forEach(t => thLayer.addLayer(t));
      }
    }

    prevSelectedNoRef.current = selectedNo;

    // Canvas 강제 redraw (각 path layer 개별)
    forceRedrawAllLines();
  }, [selectedNo, mountains]);

  // 사용자 경로 폴리라인 표시
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = LRef.current || (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      // 이전 경로 제거
      if (plannedRouteLayerRef.current) {
        mapRef.current.removeLayer(plannedRouteLayerRef.current);
        plannedRouteLayerRef.current = null;
      }
      if (!plannedRoute) return;
      const layer = L.geoJSON(plannedRoute.geometry, {
        style: { color: '#7c3aed', weight: 5, opacity: 0.85, dashArray: '8 4' },
      });
      layer.addTo(mapRef.current);
      plannedRouteLayerRef.current = layer;
      // bounds로 fit
      const b = layer.getBounds();
      if (b.isValid && b.isValid()) {
        mapRef.current.flyToBounds(b.pad(0.15), { duration: 0.7, maxZoom: 11 });
      }
    })();
    return () => { cancelled = true; };
  }, [plannedRoute]);

  // 카드 → 지도 포커스 (역·산장·숙소·주차장·베이스타운)
  useEffect(() => {
    if (!focusItem || !mapRef.current) return;
    let mk: any = null;
    switch (focusItem.kind) {
      case 'station': mk = stationByOsmIdRef.current.get(focusItem.id); break;
      case 'hut':     mk = hutByIdRef.current.get(focusItem.id); break;
      case 'lodging': mk = lodgingByIdRef.current.get(focusItem.id); break;
      case 'parking': mk = parkingByIdRef.current.get(focusItem.id); break;
      case 'town':    mk = townByOsmIdRef.current.get(focusItem.id); break;
    }
    if (!mk) return;
    const ll = mk.getLatLng();
    if (!ll) return;
    // 마커가 layer에 없으면(필터링 등) addLayer
    // → 산 선택 시 자동 추가되므로 보통은 있음
    mapRef.current.flyTo([ll.lat, ll.lng], 14, { duration: 0.5 });
    setTimeout(() => {
      try { mk.openPopup(); } catch {}
    }, 600);
  }, [focusItem]);

  // 코스 선택 강조
  useEffect(() => {
    if (!LRef.current) return;
    const prevRid = prevSelectedRouteIdRef.current;
    if (prevRid && prevRid !== selectedRouteId) {
      const prev = lineByRouteIdRef.current.get(prevRid);
      if (prev?.setStyle) {
        const feat = (prev as any).feature;
        if (feat?.properties?.mountain_no === selectedNo) prev.setStyle(STYLE_HIGHLIGHT);
        else prev.setStyle(STYLE_DIM);
      }
    }
    if (selectedRouteId) {
      const cur = lineByRouteIdRef.current.get(selectedRouteId);
      if (cur?.setStyle) {
        cur.setStyle(STYLE_ACTIVE);
        cur.bringToFront?.();
      }
    }
    prevSelectedRouteIdRef.current = selectedRouteId;

    forceRedrawAllLines();
  }, [selectedRouteId, selectedNo]);

  function forceRedrawAllLines() {
    // Canvas renderer는 path 객체의 setStyle 직후 redraw가 잘 안 될 때가 있음
    // 모든 라인을 한 번 detach 후 다시 redraw 강제
    const lines = linesLayerRef.current;
    if (!lines) return;
    try {
      lines.eachLayer?.((layer: any) => {
        if (layer.redraw) layer.redraw();
        else if (layer._renderer?._update) layer._renderer._update();
      });
      // renderer 직접 refresh
      const map = mapRef.current;
      if (map) {
        const renderer = (map as any)._renderer;
        if (renderer?._update) renderer._update();
      }
    } catch {}
  }

  return <div ref={containerRef} className="absolute inset-0" />;
}
