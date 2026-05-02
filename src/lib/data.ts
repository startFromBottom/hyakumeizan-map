// 데이터 로더 — public/data 의 JSON을 fetch
// 앱으로 이식할 때는 이 파일만 fetch → 로컬 번들/원격 API로 바꾸면 됨

import type { Mountain, RouteProfile, HutsGeoJSON, LodgingsGeoJSON, StationsGeoJSON, ParkingGeoJSON } from './types';

let _mountains: Mountain[] | null = null;
let _geojson: any | null = null;
let _profiles: Record<string, RouteProfile> | null = null;
let _huts: HutsGeoJSON | null = null;
let _lodgings: LodgingsGeoJSON | null = null;
let _stations: StationsGeoJSON | null = null;
let _parking: ParkingGeoJSON | null = null;

export async function loadMountains(): Promise<Mountain[]> {
  if (_mountains) return _mountains;
  const r = await fetch('/data/hyakumeizan_full.json');
  _mountains = await r.json();
  return _mountains!;
}

export async function loadRoutesGeoJSON(): Promise<any> {
  if (_geojson) return _geojson;
  const r = await fetch('/data/routes_all.geojson');
  _geojson = await r.json();
  return _geojson;
}

export async function loadProfiles(): Promise<Record<string, RouteProfile>> {
  if (_profiles) return _profiles;
  const r = await fetch('/data/routes_profiles.json');
  _profiles = await r.json();
  return _profiles!;
}

export async function loadHuts(): Promise<HutsGeoJSON> {
  if (_huts) return _huts;
  const r = await fetch('/data/huts.geojson');
  _huts = await r.json();
  return _huts!;
}

export async function loadLodgings(): Promise<LodgingsGeoJSON> {
  if (_lodgings) return _lodgings;
  try {
    const r = await fetch('/data/lodgings.geojson');
    if (!r.ok) {
      _lodgings = { type: 'FeatureCollection', features: [] };
      return _lodgings;
    }
    _lodgings = await r.json();
  } catch {
    _lodgings = { type: 'FeatureCollection', features: [] };
  }
  return _lodgings!;
}

export async function loadStations(): Promise<StationsGeoJSON> {
  if (_stations) return _stations;
  try {
    const r = await fetch('/data/stations.geojson');
    if (!r.ok) {
      _stations = { type: 'FeatureCollection', features: [] };
      return _stations;
    }
    _stations = await r.json();
  } catch {
    _stations = { type: 'FeatureCollection', features: [] };
  }
  return _stations!;
}

export async function loadParking(): Promise<ParkingGeoJSON> {
  if (_parking) return _parking;
  try {
    const r = await fetch('/data/parking.geojson');
    if (!r.ok) {
      _parking = { type: 'FeatureCollection', features: [] };
      return _parking;
    }
    _parking = await r.json();
  } catch {
    _parking = { type: 'FeatureCollection', features: [] };
  }
  return _parking!;
}
