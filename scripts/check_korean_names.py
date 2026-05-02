"""
한국어 표기가 누락된 산/코스 검출 스크립트.
GitHub Actions에서 PR 가드 또는 데이터 갱신 후 점검용.

종료 코드:
  0 — 모두 한국어 표기 있음
  1 — 누락된 항목 있음 (목록 출력)
"""
import json, sys, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAS_HANGUL = re.compile(r'[가-힯]')

def has_korean(s):
    return bool(s and HAS_HANGUL.search(s))

def main():
    path = os.path.join(ROOT, 'public/data/hyakumeizan_full.json')
    data = json.load(open(path))
    missing_mts = []
    missing_routes = []
    for m in data:
        if not has_korean(m.get('name_ko', '')):
            missing_mts.append((m['no'], m['name_ja'], m.get('yomi')))
        for r in (m.get('routes') or []):
            n_ja = r.get('name_ja','')
            n_ko = r.get('name_ko','')
            # name_ja 자체에 한국어가 있으면 OK, 아니면 name_ko 필요
            if not has_korean(n_ja) and not has_korean(n_ko):
                missing_routes.append((m['no'], m['name_ko'], r['route_id'], n_ja))

    if missing_mts:
        print(f'⚠ 한국어 표기 누락 산 {len(missing_mts)}개:')
        for no, ja, yomi in missing_mts:
            print(f'  #{no:3d}  {ja}  ({yomi})')
    if missing_routes:
        print(f'⚠ 한국어 표기 누락 코스 {len(missing_routes)}개:')
        for no, mko, rid, n in missing_routes:
            print(f'  {rid}  [{mko}]  {n}')
    if not missing_mts and not missing_routes:
        print('✓ 모든 산·코스에 한국어 표기 있음')
        return 0
    return 1

if __name__ == '__main__':
    sys.exit(main())
