"""
fallback "대표 등산로"를 트레일헤드 위치 기반으로 자동 명명.

전략:
1. 코스 시작점 좌표 추출 (정상 반대쪽 끝점)
2. 시작점 1.5km 내 산장(name 있음) → "X산장 코스"
3. 없으면 시작점 1km 내 주차장(name 있음) → "X주차장 코스"
4. 없으면 정상 기준 방위 8방위 + 거리 → "동쪽 코스 (7.0km)"
5. 같은 방위가 둘 이상이면 거리로 구분
"""
import json, os, math, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DIRS = ['북쪽','북동쪽','동쪽','남동쪽','남쪽','남서쪽','서쪽','북서쪽']

def hav(la1, lo1, la2, lo2):
    R = 6371000
    p1, p2 = math.radians(la1), math.radians(la2)
    dp = math.radians(la2-la1); dl = math.radians(lo2-lo1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))

def bearing_to_cardinal(lat1, lon1, lat2, lon2):
    """lat1,lon1 → lat2,lon2 방위. 결과는 한국어 8방위 string."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1)*math.sin(p2) - math.sin(p1)*math.cos(p2)*math.cos(dl)
    bearing = (math.degrees(math.atan2(y, x)) + 360) % 360
    idx = int((bearing + 22.5) // 45) % 8
    return DIRS[idx]

def has_meaningful_name(name):
    """name이 의미있는지 판단 — 빈 문자열, 'parking', 'unnamed', 한글 'fallback'은 제외"""
    if not name: return False
    n = name.strip()
    if not n: return False
    if n in ('주차장','parking','산장','대피소','rest','登山口'): return False
    return True

def korean_facility(name):
    """OSM이 일본어로 준 이름 그대로 반환 (한국어로는 못 바꾸니 한자/일본어 그대로)"""
    return name.strip()

def main():
    mts = json.load(open(os.path.join(ROOT, 'public/data/hyakumeizan_full.json')))
    geo = json.load(open(os.path.join(ROOT, 'public/data/routes_all.geojson')))
    huts = json.load(open(os.path.join(ROOT, 'public/data/huts.geojson')))
    parking = json.load(open(os.path.join(ROOT, 'public/data/parking.geojson')))

    # route_id → start coord (정상 반대쪽 끝)
    summit_by_no = {m['no']: (m['coordinates']['lat'], m['coordinates']['lon']) for m in mts}
    starts = {}
    for f in geo['features']:
        rid = f['properties']['route_id']
        coords = f['geometry']['coordinates']
        if not coords: continue
        no = int(rid[1:4])  # m003-r0 → 3
        slat, slon = summit_by_no.get(no, (None, None))
        if slat is None: continue
        # 첫점/끝점 중 정상에서 더 먼 쪽이 트레일헤드
        d_start = hav(slat, slon, coords[0][1], coords[0][0])
        d_end = hav(slat, slon, coords[-1][1], coords[-1][0])
        if d_start >= d_end:
            th = (coords[0][1], coords[0][0])
        else:
            th = (coords[-1][1], coords[-1][0])
        starts[rid] = th

    updated = 0
    skipped_already_named = 0
    method_counts = {'hut': 0, 'parking': 0, 'cardinal': 0}

    for m in mts:
        no = m['no']
        slat, slon = m['coordinates']['lat'], m['coordinates']['lon']
        routes = m.get('routes') or []
        if not routes: continue

        # 후보 라벨 생성 (한 산 안에서 dedupe 위해 1차로 다 만들고 나중에 중복 처리)
        labels = []
        for r in routes:
            rid = r['route_id']
            existing_ko = r.get('name_ko', '')
            existing_ja = r.get('name_ja', '')
            # 자동 생성된 라벨 패턴은 idempotent하게 재처리 — 수기/원본 이름만 보존
            AUTO_PATTERNS = re.compile(r'(코스 \(\d|북쪽 코스|남쪽 코스|동쪽 코스|서쪽 코스|북동쪽 코스|북서쪽 코스|남동쪽 코스|남서쪽 코스| 코스 #\d)')
            is_auto_generated = bool(existing_ko and AUTO_PATTERNS.search(existing_ko))
            # 진짜 이름(fallback이 아니고 자동 생성도 아님) 있으면 skip
            if existing_ja and existing_ja != '대표 등산로':
                labels.append(None)
                skipped_already_named += 1
                continue
            if existing_ko and existing_ko != '대표 등산로' and not is_auto_generated:
                labels.append(None)
                skipped_already_named += 1
                continue
            th = starts.get(rid)
            if not th:
                labels.append(None); continue
            tlat, tlon = th
            # 1) 1.5km 내 산장
            best_hut = None
            for h in huts['features']:
                hc = h['geometry']['coordinates']
                d = hav(tlat, tlon, hc[1], hc[0])
                if d > 1500: continue
                hname = h['properties'].get('name')
                if not has_meaningful_name(hname): continue
                if best_hut is None or d < best_hut[0]:
                    best_hut = (d, hname)
            # 2) 1km 내 주차장
            best_pk = None
            for p in parking['features']:
                pc = p['geometry']['coordinates']
                d = hav(tlat, tlon, pc[1], pc[0])
                if d > 1000: continue
                pname = p['properties'].get('name')
                if not has_meaningful_name(pname): continue
                if best_pk is None or d < best_pk[0]:
                    best_pk = (d, pname)
            # 라벨 결정
            dist_km = r.get('distance_km', 0)
            if best_hut:
                lbl = f"{korean_facility(best_hut[1])} 코스"
                method_counts['hut'] += 1
            elif best_pk:
                lbl = f"{korean_facility(best_pk[1])} 코스"
                method_counts['parking'] += 1
            else:
                card = bearing_to_cardinal(slat, slon, tlat, tlon)
                lbl = f"{card} 코스 ({dist_km}km)"
                method_counts['cardinal'] += 1
            labels.append(lbl)

        # 같은 산 내 중복 라벨 처리 — 1단계: 거리 표기 추가, 2단계: 인덱스 부여
        from collections import Counter
        counts = Counter([x for x in labels if x])
        # 1단계: 거리 표기 없는 중복 라벨에 거리 추가
        for i, r in enumerate(routes):
            lbl = labels[i]
            if not lbl: continue
            if counts[lbl] > 1 and '코스 (' not in lbl:
                labels[i] = f"{lbl} ({r.get('distance_km',0)}km)"
        # 2단계: 그래도 중복이면 #1, #2 인덱스 추가
        counts2 = Counter([x for x in labels if x])
        seen_idx = {}
        for i, r in enumerate(routes):
            lbl = labels[i]
            if not lbl: continue
            if counts2[lbl] > 1:
                seen_idx[lbl] = seen_idx.get(lbl, 0) + 1
                labels[i] = f"{lbl} #{seen_idx[lbl]}"
        # 적용
        for i, r in enumerate(routes):
            if labels[i]:
                r['name_ko'] = labels[i]
                updated += 1

    json.dump(mts, open(os.path.join(ROOT, 'public/data/hyakumeizan_full.json'), 'w'),
              ensure_ascii=False, indent=2)
    print(f"✓ Updated: {updated} routes")
    print(f"  Already named (skipped): {skipped_already_named}")
    print(f"  Method: hut={method_counts['hut']}, parking={method_counts['parking']}, cardinal={method_counts['cardinal']}")

    # 샘플 출력
    print('\n샘플 (샤리다케):')
    s = next(m for m in mts if m['no']==3)
    for r in s['routes']:
        print(f"  {r['route_id']}  {r.get('name_ko')}")
    print('\n샘플 (다이세쓰산 #5):')
    s = next(m for m in mts if m['no']==5)
    for r in s['routes']:
        print(f"  {r['route_id']}  {r.get('name_ko')}")
    print('\n샘플 (후지산 #72) — 이미 명명된 거 보존되어야 함:')
    s = next(m for m in mts if m['no']==72)
    for r in s['routes']:
        print(f"  {r['route_id']}  name_ko={r.get('name_ko')}  name_ja={r.get('name_ja')}")

if __name__ == '__main__':
    main()
