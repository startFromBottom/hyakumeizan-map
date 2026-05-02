# 日本百名山 — 일본 100대 명산 지도

일본 100대 명산(日本百名山)의 위치, 등산 코스, 표고 프로필을 한 화면에서 탐색할 수 있는 웹 앱.

## 기술 스택

- **Next.js 14** (App Router) + **TypeScript**
- **React 18**
- **Leaflet** + OpenStreetMap 타일
- **Tailwind CSS**

## 데이터 소스

- 산 메타데이터: 위키피디아 일본어판 + Wikidata
- 등산로 폴리라인: OpenStreetMap (Overpass API)
- 표고 프로필: SRTM30m (opentopodata.org)
- 외부 링크: YAMAP (산별 페이지 ID 매칭)

## 로컬 실행

```bash
npm install
npm run dev   # http://localhost:3001
```

## 빌드

```bash
npm run build
npm run start
```

## 구조

```
web/
├── public/data/             # 정적 JSON·GeoJSON 데이터
│   ├── hyakumeizan_full.json   # 100개 산 메타+코스 요약
│   ├── routes_all.geojson      # 89개 등산로 폴리라인
│   └── routes_profiles.json    # 코스별 (거리,표고) 배열
└── src/
    ├── lib/
    │   ├── types.ts          # 공통 타입 (앱 이식 시 그대로 재사용)
    │   ├── data.ts           # 데이터 로더 (앱에서는 fetch만 교체)
    │   └── filter.ts         # 필터·검색 순수 함수 (재사용)
    ├── components/
    │   ├── MapView.tsx       # Leaflet 지도 + 마커 + 라우트
    │   ├── Sidebar.tsx       # 검색·필터 + 산 리스트
    │   ├── DetailPanel.tsx   # 선택된 산의 상세 패널
    │   └── ElevationProfile.tsx # SVG 표고 프로필
    └── app/
        ├── layout.tsx
        ├── page.tsx          # 메인 (반응형: 데스크톱 사이드바 / 모바일 바텀시트)
        └── globals.css
```

## 모바일 앱 확장 시 재사용 가능한 코드

- `src/lib/types.ts` — 데이터 모델 (그대로 사용)
- `src/lib/filter.ts` — 검색·필터 로직 (그대로 사용)
- `src/lib/data.ts` — fetch 부분만 네이티브 자산 로더로 교체

UI(`components/`, `app/`)만 React Native·Flutter 등으로 다시 짜면 됨.

## 데이터 갱신

루트 디렉터리(`mountain_infos/`)에 있는 원본 데이터 파일들이 갱신되면, `public/data/`로 다시 복사하면 됩니다.

## 배포 (Vercel)

이 프로젝트는 100% 정적 데이터(JSON·GeoJSON)만 쓰며 서버 API 라우트가 없어서 Vercel에 그대로 올리면 즉시 배포됩니다.

1. GitHub에 이 저장소를 푸시
2. [vercel.com/new](https://vercel.com/new) → repo import
3. **Root Directory**: `web` (monorepo로 올린 경우)
4. Framework: **Next.js** (자동 감지)
5. Build Command·Output Directory: 기본값 그대로
6. Deploy → 약 1~2분 후 `*.vercel.app` 도메인 발급

## 외부 데이터·API 출처

- 지형 타일: © OpenStreetMap contributors / CARTO Voyager
- 등산로 데이터: OpenStreetMap (ODbL)
- 산 메타·사진: Wikipedia / Wikimedia Commons / Wikidata (CC BY-SA)
- 표고: opentopodata.org SRTM30m
- 라우팅: OSRM (router.project-osrm.org)
- 지오코딩: Nominatim (OpenStreetMap)
- YAMAP: 외부 링크만 사용

런타임 외부 API(OSRM, Nominatim)는 사용자 인터랙션 시점에만 호출됩니다.
