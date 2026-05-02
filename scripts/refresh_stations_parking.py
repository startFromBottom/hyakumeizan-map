"""
역·주차장 데이터 갱신 (OSM Overpass).

- stations.geojson: 베이스타운 5km 반경 역
- parking.geojson: 트레일헤드 주변 주차장
- 위치 변동성 매우 낮음 → 새 시설 추가/폐쇄 반영 목적
- 기존 큐레이션 (trailhead routing 결과 등)은 보존
"""
import json, urllib.request, urllib.parse, time, sys, os, math

OVERPASS = "https://overpass-api.de/api/interpreter"
UA = "hyakumeizan-map-bot/1.0 (+https://github.com/startFromBottom/hyakumeizan-map)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def overpass_query(query, timeout=120):
    data = urllib.parse.urlencode({'data': query}).encode()
    req = urllib.request.Request(OVERPASS, data=data, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def fetch_stations(lat, lon, r=5000):
    q = f"""
    [out:json][timeout:60];
    (
      node["railway"="station"](around:{r},{lat},{lon});
      node["railway"="halt"](around:{r},{lat},{lon});
      node["railway"="tram_stop"](around:{r},{lat},{lon});
      node["amenity"="bus_station"](around:{r},{lat},{lon});
    );
    out tags;
    """
    return overpass_query(q).get('elements', [])

def fetch_parking(lat, lon, r=2000):
    q = f"""
    [out:json][timeout:60];
    (
      node["amenity"="parking"](around:{r},{lat},{lon});
      way["amenity"="parking"](around:{r},{lat},{lon});
    );
    out center tags;
    """
    return overpass_query(q).get('elements', [])

def normalize_station(el):
    t = el.get('tags', {})
    return {
        'osm_id': f"node/{el['id']}",
        'lat': el.get('lat'),
        'lon': el.get('lon'),
        'name': t.get('name'),
        'name_en': t.get('name:en'),
        'kind': t.get('railway') or t.get('amenity'),
        'operator': t.get('operator'),
        'network': t.get('network'),
        'wikipedia': t.get('wikipedia'),
    }

def normalize_parking(el, mountain_no):
    t = el.get('tags', {})
    if 'center' in el:
        lat, lon = el['center']['lat'], el['center']['lon']
    else:
        lat, lon = el.get('lat'), el.get('lon')
    if lat is None:
        return None
    return {
        'osm_id': f"{el['type']}/{el['id']}",
        'lat': lat, 'lon': lon,
        'name': t.get('name') or '주차장',
        'kind': t.get('parking') or 'parking',
        'capacity': t.get('capacity'),
        'fee': t.get('fee'),
        'access': t.get('access'),
        'operator': t.get('operator'),
        'mountain_no': mountain_no,
    }

def main():
    mountains = json.load(open(os.path.join(ROOT, 'web/public/data/hyakumeizan_full.json')))
    st_path = os.path.join(ROOT, 'web/public/data/stations.geojson')
    pk_path = os.path.join(ROOT, 'web/public/data/parking.geojson')
    stations = json.load(open(st_path))
    parking = json.load(open(pk_path))

    st_by_id = {f['properties']['osm_id']: f for f in stations['features']}
    pk_by_id = {f['properties']['osm_id']: f for f in parking['features']}

    st_updated = 0
    pk_updated = 0

    # 베이스타운 좌표 모아서 dedupe
    seen_centers = set()
    base_centers = []
    for m in mountains:
        for bt in (m.get('base_towns') or []):
            key = (round(bt['lat'], 2), round(bt['lon'], 2))
            if key in seen_centers:
                continue
            seen_centers.add(key)
            base_centers.append((bt['lat'], bt['lon']))

    print(f"Stations: {len(base_centers)} unique base-town centers to scan")
    for i, (lat, lon) in enumerate(base_centers, 1):
        try:
            els = fetch_stations(lat, lon)
        except Exception as e:
            print(f"  [{i}] {e}", file=sys.stderr); continue
        for el in els:
            n = normalize_station(el)
            if n['osm_id'] in st_by_id:
                f = st_by_id[n['osm_id']]
                for k in ('name','name_en','kind','operator','network','wikipedia'):
                    if n.get(k):
                        f['properties'][k] = n[k]
                st_updated += 1
        if i % 10 == 0:
            print(f"  [{i}/{len(base_centers)}] stations updated so far: {st_updated}", flush=True)
        time.sleep(1.0)

    # 주차장: 산별 트레일헤드 좌표 사용
    for m in mountains:
        no = m['no']
        # primary route start point as trailhead proxy — coord from coordinates
        lat, lon = m['coordinates']['lat'], m['coordinates']['lon']
        try:
            els = fetch_parking(lat, lon)
        except Exception as e:
            print(f"  parking [{no}] {e}", file=sys.stderr); continue
        for el in els:
            n = normalize_parking(el, no)
            if not n: continue
            if n['osm_id'] in pk_by_id:
                f = pk_by_id[n['osm_id']]
                for k in ('name','kind','capacity','fee','access','operator'):
                    if n.get(k):
                        f['properties'][k] = n[k]
                pk_updated += 1
        time.sleep(1.0)

    json.dump(stations, open(st_path, 'w'), ensure_ascii=False, indent=2)
    json.dump(parking, open(pk_path, 'w'), ensure_ascii=False, indent=2)
    print(f"\n✓ Stations updated: {st_updated} / Parking updated: {pk_updated}")

if __name__ == '__main__':
    main()
