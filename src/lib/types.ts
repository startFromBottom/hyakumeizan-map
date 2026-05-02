// 공통 타입 — 웹/앱 모두에서 재사용 가능하도록 분리

export type Region = '홋카이도' | '도호쿠' | '간토' | '주부' | '간사이' | '주고쿠' | '시코쿠' | '규슈';

export interface Route {
  route_id: string;        // m{no:03d}-r{idx} 형태, GeoJSON Feature.properties.route_id 와 일치
  name_ja: string;
  is_primary: boolean;
  distance_km: number;
  ascent_m: number;
  source: string;
  difficulty_stars?: number | null;
}

export interface YamapLink {
  url: string;
  id: number;
  name_ja?: string;
  difficulty_label?: string | null;
  classification?: string | null;
  description?: string | null;
}

export interface Mountain {
  no: number;
  name_ko: string;
  name_ja: string;
  name_ja_kanji?: string;
  yomi: string;
  name_en?: string | null;
  elevation_m: number;
  range_ja: string;
  range_ko: string;
  prefectures_ja: string;
  prefectures_ko: string;
  note_ja: string;
  coordinates: { lat: number; lon: number };
  wikidata_qid?: string;
  wikipedia: { ja?: string; ko?: string | null; en?: string | null };
  summary_ko: string;
  region: Region | null;
  regions: Region[];
  routes: Route[];
  external_links?: { yamap?: YamapLink };
  hut_ids?: string[];
  base_towns?: BaseTown[];
  stations?: Station[];
  transit_notes?: TransitNote[];
  wiki_ko_summary?: string | null;   // 위키피디아 한국어판 첫 단락 (있을 때만)
  image?: { filename?: string; thumb?: string; large?: string; commons?: string; url?: string } | null;
}

export interface TransitNote {
  title: string;
  description: string;
  season?: string | null;
  official_url?: string | null;
}

export interface HutAssociation {
  mountain_no: number;
  route_id: string;
  dist_m: number;
}

export interface HutFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    name_en?: string | null;
    name_ja_hira?: string | null;
    kind: string;
    ele?: number | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    wikipedia_url?: string | null;
    wikidata_qid?: string | null;
    capacity?: number | string | null;
    reservation?: string | null;
    opening_hours?: string | null;
    fee?: string | null;
    operator?: string | null;
    address?: string | null;
    internet_access?: string | null;
    fireplace?: string | null;
    shower?: string | null;
    image?: { filename?: string; thumb?: string; large?: string; commons?: string; url?: string } | null;
    description?: string | null;       // 일본어 설명 (Wikidata에서)
    wikipedia_ko?: string | null;
    wikipedia_en?: string | null;
    fee_yen?: string | null;
    route_associations: HutAssociation[];
    nearest_mountain_no: number;
    osm_id: string;
  };
}

export interface HutsGeoJSON {
  type: 'FeatureCollection';
  features: HutFeature[];
}

export interface BaseTown {
  osm_id: string;
  name: string;
  name_en?: string | null;
  name_hira?: string | null;
  lat: number;
  lon: number;
  place: 'city' | 'town' | string;
  population?: string | null;
  wikidata?: string | null;
  wikipedia?: string | null;
  dist_km: number;
  score: number;
}

export interface LodgingFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    name_en?: string | null;
    kind: string;            // hotel / guest_house / hostel / ryokan / ...
    stars?: string | null;
    rooms?: string | null;
    phone?: string | null;
    website?: string | null;
    operator?: string | null;
    address?: string | null;
    near_town: string;       // 어느 베이스타운 근방
    near_town_name: string;
    osm_id: string;
  };
}

export interface LodgingsGeoJSON {
  type: 'FeatureCollection';
  features: LodgingFeature[];
}

export interface Station {
  osm_id: string;
  name: string;
  name_en?: string | null;
  name_hira?: string | null;
  kind: 'station' | 'halt' | 'tram_stop' | 'bus_station' | string;
  operator?: string | null;
  network?: string | null;
  lat: number;
  lon: number;
  near_town: string;
  near_town_name: string;
  dist_to_summit_km: number;
  wikipedia?: string | null;
  // 트레일헤드 연결
  trailhead_route_id?: string | null;
  trailhead_lat?: number | null;
  trailhead_lon?: number | null;
  trailhead_dist_km?: number | null;
  trailhead_walk_min?: number | null;
  trailhead_drive_min?: number | null;
  osrm_dist_km?: number | null;
  osrm_dur_min?: number | null;
}

export interface StationFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    name_en?: string | null;
    kind: string;
    operator?: string | null;
    network?: string | null;
    near_town: string;
    near_town_name: string;
    wikipedia?: string | null;
    osm_id: string;
  };
}

export interface StationsGeoJSON {
  type: 'FeatureCollection';
  features: StationFeature[];
}

export interface ParkingFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    kind: string;
    capacity?: string | null;
    fee?: string | null;
    access?: string | null;
    operator?: string | null;
    near_route: string;
    mountain_no: number;
    dist_to_trailhead_m: number;
    osm_id: string;
  };
}

export interface ParkingGeoJSON {
  type: 'FeatureCollection';
  features: ParkingFeature[];
}

export interface RouteProfile {
  distance_m: number[];
  elevation_m: number[];
}
