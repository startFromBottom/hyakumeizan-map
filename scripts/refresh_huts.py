"""
산장 데이터 갱신 (OSM Overpass API).

- 100개 산 주변 5km 반경에서 mountain_hut 추출
- 기존 huts.geojson과 머지 — OSM 태그(전화/홈피/용량/요금)만 갱신
- 큐레이션 필드(route_associations, nearest_mountain_no, wikipedia_ko 등)는 보존
- 결과: web/public/data/huts.geojson 업데이트
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

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def fetch_huts_for_mountain(no, lat, lon, radius_m=5000):
    q = f"""
    [out:json][timeout:60];
    (
      node["tourism"="alpine_hut"](around:{radius_m},{lat},{lon});
      way["tourism"="alpine_hut"](around:{radius_m},{lat},{lon});
      node["tourism"="wilderness_hut"](around:{radius_m},{lat},{lon});
      way["tourism"="wilderness_hut"](around:{radius_m},{lat},{lon});
    );
    out center tags;
    """
    try:
        d = overpass_query(q)
        return d.get('elements', [])
    except Exception as e:
        print(f"  [!] mountain {no}: {e}", file=sys.stderr)
        return []

def normalize_hut(el, mountain_no):
    """OSM element → hut feature 형식으로 변환 (OSM 태그 부분만)"""
    tags = el.get('tags', {})
    if 'center' in el:
        lat, lon = el['center']['lat'], el['center']['lon']
    else:
        lat, lon = el.get('lat'), el.get('lon')
    if lat is None:
        return None
    osm_id = f"{el['type']}/{el['id']}"
    return {
        'osm_id': osm_id,
        'lat': lat,
        'lon': lon,
        # OSM이 제공하는 동적 필드들만 — 사람이 손본 필드는 머지 시 보존
        'osm_tags': {
            'name': tags.get('name'),
            'name_en': tags.get('name:en'),
            'name_ja_hira': tags.get('name:ja-Hira') or tags.get('name:ja_kana'),
            'kind': tags.get('tourism'),
            'ele': float(tags['ele']) if tags.get('ele', '').replace('.','').replace('-','').isdigit() else None,
            'phone': tags.get('phone') or tags.get('contact:phone'),
            'email': tags.get('email') or tags.get('contact:email'),
            'website': tags.get('website') or tags.get('contact:website') or tags.get('url'),
            'capacity': tags.get('capacity') or tags.get('beds'),
            'reservation': tags.get('reservation'),
            'opening_hours': tags.get('opening_hours'),
            'fee': tags.get('fee'),
            'operator': tags.get('operator'),
            'address': tags.get('addr:full') or tags.get('addr:city'),
            'internet_access': tags.get('internet_access'),
            'fireplace': tags.get('fireplace'),
            'shower': tags.get('shower'),
            'wikipedia': tags.get('wikipedia'),
            'wikidata': tags.get('wikidata'),
        }
    }

def main():
    mountains = json.load(open(os.path.join(ROOT, 'web/public/data/hyakumeizan_full.json')))
    huts_path = os.path.join(ROOT, 'web/public/data/huts.geojson')
    huts = json.load(open(huts_path))

    # OSM ID → 기존 feature 매핑
    by_osm = {f['properties']['osm_id']: f for f in huts['features']}

    new_count = 0
    updated_count = 0
    seen_osm_ids = set()

    for m in mountains:
        no = m['no']
        lat = m['coordinates']['lat']
        lon = m['coordinates']['lon']
        elements = fetch_huts_for_mountain(no, lat, lon)
        for el in elements:
            n = normalize_hut(el, no)
            if not n:
                continue
            seen_osm_ids.add(n['osm_id'])
            tags = n['osm_tags']
            if n['osm_id'] in by_osm:
                # 머지: OSM 태그만 갱신, 나머지(route_associations, wikipedia_ko 등) 보존
                f = by_osm[n['osm_id']]
                for k, v in tags.items():
                    if v is not None:
                        f['properties'][k] = v
                # 좌표도 업데이트 (OSM에서 위치 보정될 수 있음)
                f['geometry']['coordinates'] = [n['lon'], n['lat']]
                updated_count += 1
            else:
                # 신규 산장 — 최소 필드로 추가
                feat = {
                    'type': 'Feature',
                    'geometry': {'type': 'Point', 'coordinates': [n['lon'], n['lat']]},
                    'properties': {
                        'id': f"hut_{n['osm_id'].replace('/','_')}",
                        'osm_id': n['osm_id'],
                        'route_associations': [],
                        'nearest_mountain_no': no,
                        **{k: v for k, v in tags.items() if v is not None},
                    },
                }
                huts['features'].append(feat)
                by_osm[n['osm_id']] = feat
                new_count += 1
        print(f"  [{no:3d}/100] {m['name_ja']}: {len(elements)} OSM elements", flush=True)
        time.sleep(1.0)  # Overpass 예의

    # 결과 저장
    json.dump(huts, open(huts_path, 'w'), ensure_ascii=False, indent=2)
    print(f"\n✓ Updated: {updated_count}, New: {new_count}, Total: {len(huts['features'])}")
    print(f"  Saved: {huts_path}")

if __name__ == '__main__':
    main()
