# 로드맵 — 사용자 기능·앱·GPS 자동 기록

> **목적**: 정적 정보 사이트(현재) → 사용자 기능 → 모바일 앱 → GPS 자동 산행 기록까지의 진화 경로 박제.
> 시작 시점에 다시 와서 한 시간이라도 절약하기 위한 문서.
>
> 작성: 2026-05 (스티치 + Cowork)

---

## 큰 그림 — 4단계

```
[현재] 정적 정보 사이트  (Next.js + JSON, Vercel)
  ↓ 1. 즐겨찾기·체크인 (DB 도입)
[Phase A] 가벼운 사용자 기능
  ↓ 2. 후기·평점·사진 업로드
[Phase B] 커뮤니티 (yamap-lite)
  ↓ 3. GPS 자동 기록 (앱 출시)
[Phase C] 산행 기록 자동화 (strava-lite)
  ↓ 4. 분석·소셜·랭킹
[Phase D] 풀 플랫폼
```

각 단계가 다음 단계의 기반이 되도록 설계해야 함. **특히 GPS 자동 기록을 미리 가정하고 DB 스키마를 짜둬야 나중에 마이그레이션이 안 생긴다.**

---

## 기술 스택 — 미리 정해둠

### 백엔드/DB: **Supabase**

- Postgres + Auth + Realtime + Storage(사진) + **PostGIS** 한 방
- 무료 티어: 500MB DB, 1GB 사진, 50K MAU — 한참 충분
- React/React Native에서 동일한 SDK
- **PostGIS가 핵심**: GPS 트랙(LineString)을 PostgreSQL 안에서 직접 다룰 수 있고, "어느 산 영역 안에 들어왔나"를 SQL `ST_Contains`/`ST_DWithin`으로 즉시 판정. yamap급 기능에 필수.

### 모바일 앱: **React Native + Expo**

- 이미 웹이 React → 데이터 모델·로직 95% 재사용
- Expo로 백그라운드 GPS, 푸시 알림, 사진 업로드 다 해결
- iOS/Android 동시 출시
- 1인 개발 친화 (Xcode 깊이 안 들어가도 됨)

### 산행 기록 저장 형식: **GPX + DB**

- 산행 끝나면 raw GPS는 GPX 파일로 Supabase Storage
- 메타(거리·소요시간·고도·산 매칭)는 DB에 인덱스
- yamap·strava import/export 호환 → 졸업 사용자 끌어오는 무기

---

## Phase A — 즐겨찾기·체크인 (1~2주)

### DB 스키마 (이때 미래까지 다 깔아둠)

```sql
-- 사용자 (Supabase Auth가 자동 생성하는 auth.users 참조)
profiles (
  id uuid pk references auth.users(id),
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- 100명산 정적 데이터는 DB로 옮기지 않고 mountain_no(int)만 외래키로 사용
-- (정적 JSON에 이미 있는 데이터 중복 저장 안 함)

-- 즐겨찾기
favorites (
  user_id uuid references profiles(id) on delete cascade,
  mountain_no int,
  created_at timestamptz default now(),
  primary key (user_id, mountain_no)
);

-- 체크인 ("이 산 다녀왔어요")
checkins (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  mountain_no int not null,
  visited_at date not null,        -- 정확한 시각 모를 수 있음
  note text,
  source text not null,            -- 'manual' | 'gps' | 'import'
  hike_id bigint,                  -- ← Phase C에서 채워질 자리, 지금은 nullable
  created_at timestamptz default now()
);

create index checkins_user_visited on checkins(user_id, visited_at desc);
create index checkins_mountain on checkins(mountain_no);
```

### 핵심 포인트

- **`source` + `hike_id`를 지금부터 넣어둔다.** Phase C에서 GPS 자동 체크인이 생기면 같은 테이블 그대로 사용.
- Row Level Security (RLS) 정책: 본인 즐겨찾기·체크인만 read/write, 공개 카운트는 anon으로도 조회 가능.

### 클라이언트 작업

- Supabase Auth UI (이메일·소셜 로그인)
- 산 상세 패널에 ⭐ 즐겨찾기 토글, ✓ 체크인 버튼
- 헤더에 "n/100 정복" 카운터

---

## Phase B — 후기·평점·사진 (2~4주)

### DB 스키마

```sql
-- 후기 (산·산장·코스·숙소 공통)
reviews (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('mountain','hut','route','lodging')),
  target_id text not null,         -- mountain_no 문자열, hut osm_id 등
  rating smallint check (rating between 1 and 5),
  body text,
  hike_id bigint,                  -- 어느 산행 후기인지 (nullable)
  created_at timestamptz default now()
);

create index reviews_target on reviews(target_type, target_id);

-- 사진 업로드
photos (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  storage_path text not null,      -- Supabase Storage 경로
  target_type text,
  target_id text,
  taken_at timestamptz,
  geom geography(Point, 4326),     -- ← EXIF GPS 있으면 자동 추출 (PostGIS)
  hike_id bigint,
  created_at timestamptz default now()
);

create index photos_target on photos(target_type, target_id);
create index photos_geom_gix on photos using gist(geom);
```

### 핵심 포인트

- **`geom` 컬럼을 미리 둠.** Phase C의 GPS 트랙과 사진을 시간순으로 매칭하는 기반 (yamap의 "이 사진은 트랙의 이 지점에서 찍힘" 기능).
- 사진 업로드: Supabase Storage 정책으로 본인 업로드만 쓰기, 공개 읽기.
- 외부 신고·삭제 처리 위한 `flagged_at`, `deleted_at` 같은 모더레이션 필드도 이때 같이 추가.

---

## Phase C — GPS 산행 기록 자동화 (앱 단계, 1~2개월)

### 핵심 파이프라인

```
앱 켜기 → "산행 시작" 버튼
   ↓
백그라운드 5~10초마다 GPS 점 기록 (Expo TaskManager + expo-location)
   ↓
로컬 SQLite에 누적 (네트워크 없어도 OK)
   ↓
산행 끝 → "종료" 버튼 → 통계 계산
   ↓
서버 업로드: GPX → Storage, 메타 → DB
   ↓
어느 산을 갔는지 자동 판정 → checkins 자동 생성
```

### DB 스키마

```sql
hikes (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,

  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec int,
  distance_m float,
  ascent_m float,                  -- 누적 상승 (필터링·스무딩 후)
  descent_m float,
  max_ele_m float,
  min_ele_m float,
  avg_pace_sec_per_km int,         -- 페이스 (초/km)

  -- PostGIS: 트랙 자체
  track geography(LineString, 4326),  -- 단순화된 (Douglas-Peucker eps=5m) 폴리라인
  bbox geography(Polygon),            -- 인덱스용 바운딩박스

  -- 자동 매칭
  mountain_nos int[],              -- 다녀온 100명산 번호 (여러개 가능)
  route_ids text[],                -- 매칭된 등산로 ID

  gpx_path text,                   -- Storage의 raw GPX 위치
  device_info jsonb,               -- 기기·앱 버전 등

  privacy text default 'private' check (privacy in ('private','followers','public')),
  created_at timestamptz default now()
);

create index hikes_track_gix on hikes using gist(track);
create index hikes_user_started on hikes(user_id, started_at desc);
create index hikes_mountain_nos on hikes using gin(mountain_nos);
```

### 자동 산 매칭 (PostGIS로 한 줄)

```sql
-- 트랙이 100명산 정상 1km 안을 지나갔으면 그 산을 다녀온 것으로 판정
update hikes
set mountain_nos = (
  select array_agg(m.no)
  from mountains_static m
  where st_dwithin(hikes.track, m.summit_geom, 1000)
)
where id = $hike_id;

-- 그 결과로 checkins 자동 생성
insert into checkins (user_id, mountain_no, visited_at, source, hike_id)
select user_id, unnest(mountain_nos), started_at::date, 'gps', id
from hikes where id = $hike_id
on conflict do nothing;
```

이게 yamap의 핵심 마법. **사용자가 "이 산 다녀왔어요"를 직접 입력 안 해도, GPS만 켜고 다니면 자동으로 100명산 카운트가 올라감.**

### 클라이언트 코어 (React Native + Expo)

```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SQLite from 'expo-sqlite';

const TASK = 'background-hike-tracker';

TaskManager.defineTask(TASK, ({ data, error }) => {
  if (error) return;
  const { locations } = data as any;
  // 로컬 SQLite에 append (오프라인 안전)
  for (const loc of locations) {
    db.runSync(
      `insert into points(hike_id, ts, lat, lon, ele, accuracy)
       values (?, ?, ?, ?, ?, ?)`,
      [currentHikeId, loc.timestamp, loc.coords.latitude,
       loc.coords.longitude, loc.coords.altitude, loc.coords.accuracy]
    );
  }
});

async function startHike() {
  await Location.requestBackgroundPermissionsAsync();
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,            // 10m마다 (배터리 절약)
    deferredUpdatesInterval: 30000,  // 30초마다 batch
    foregroundService: {              // Android 알림
      notificationTitle: '산행 기록 중',
      notificationBody: '안전한 산행 되세요',
    },
  });
}
```

### 배터리·정확도 트레이드오프 (참고)

- `distanceInterval: 10m` + `Accuracy.High` → 8~10시간 산행에 배터리 ~30% 소비 (iPhone 기준 추정)
- 산속 신호 약함 가정 — accuracy 50m 이상 점은 후처리 필터링
- 트랙 단순화: raw 5000점 → DP eps=5m로 ~500점 (90% 감소, 시각상 동일)

---

## Phase D — 분석·소셜·랭킹 (지속)

이 단계엔 데이터 자체가 자산:

- 산별 평균 소요시간·고도·페이스 (집계 뷰)
- "당신이 다녀온 100명산 32/100" 진행률 + 미정복 리스트
- "이번 달 가장 많이 오른 산" / "이번 주 인기 코스"
- 친구 팔로우 → 활동 피드 (Supabase Realtime으로 라이브)
- 동일 코스 내 페이스 랭킹 (strava 세그먼트 모방)

이건 다 **Phase A~C의 데이터를 SQL로 집계**하는 거라 추가 인프라 불필요.

```sql
-- 예: 사용자별 100명산 정복 카운트
create view user_progress as
select user_id, count(distinct mountain_no) as climbed
from checkins
group by user_id;

-- 예: 산별 평균 소요시간
create view mountain_stats as
select
  unnest(mountain_nos) as mountain_no,
  avg(duration_sec) as avg_duration_sec,
  count(*) as total_hikes
from hikes
where ended_at is not null
group by 1;
```

---

## 핵심 설계 원칙 — 지금부터 지키기

1. **`hike_id`를 먼저 모든 곳에 뿌리기**
   후기·체크인·사진이 다 산행에 묶일 수 있도록. nullable로 두고 GPS 시대에 채움.

2. **`source` 컬럼 모든 활동 기록에 추가**
   `manual` / `gps` / `import` 구분. 데이터 신뢰도 분석·디버깅·중복 제거에 다 쓰임.

3. **PostGIS 일찍 활성화**
   Supabase에서 `create extension postgis` 한 줄. 미리 켜둬야 좌표 쿼리가 자연스러워짐.

4. **로컬-퍼스트 모바일**
   GPS 추적은 인터넷 끊겨도 작동해야 함. 산속 신호 없을 때 잃어버리면 안 됨.
   → SQLite 로컬 캐싱 → 나중에 sync.

5. **GPX 표준 준수**
   다른 앱에서 import/export 가능하도록. yamap·strava 졸업 사용자 끌어오는 강력한 무기.

6. **RLS (Row Level Security) 첫날부터**
   Supabase는 RLS off가 기본. 켜놓고 정책 작성. 안 그러면 사용자 데이터 노출 사고.

7. **이벤트 로그 별도 테이블**
   `events(user_id, event_type, payload jsonb, created_at)` 형태로. 나중에 분석할 때 절대 후회 안 함.

---

## 시작 신호 — 언제 Phase A 들어갈까

지금 당장은 시작하지 말 것. 이유:

- 사용자 0명일 때 DB 만들어봤자 자기 자신만 씀
- Supabase 무료 티어도 6개월 미사용 시 자동 일시중지
- "어떤 데이터가 진짜 필요한지"는 실제 사용자 행동 보고 결정해야 정확

### 트리거 조건 (이 중 하나라도 충족되면 시작)

- DAU 50명 이상 (Vercel Analytics에서 확인)
- 사용자가 "내가 다녀온 산 표시 기능 있냐"고 3명 이상 문의
- 본인이 직접 산행 기록을 시작하고 싶어짐
- 다른 산악 커뮤니티에서 협업 제안

### 그 사이 할 일

- Vercel Analytics로 사용자 행동 데이터 수집 (어떤 산이 가장 클릭되나)
- 친구·가족 5~10명에게 공유해서 첫 피드백
- 분기 자동 데이터 갱신 워크플로우(이미 셋업됨) 결과 모니터링
- 시즌 등산 버스 큐레이션 분기마다 갱신 (수기)

---

## 이 문서를 다시 보는 시점에 할 첫 행동

1. 이 문서 처음부터 끝까지 다시 읽기 (10분)
2. Supabase 프로젝트 생성 + PostGIS 활성화
3. Phase A의 SQL 스키마 그대로 복사·실행 (5분)
4. `web/src/lib/supabase.ts` 클라이언트 셋업
5. Auth UI 붙이고 `favorites` 토글 만들기 — 1일 안에 첫 사용자 데이터가 들어가야 함

이 순서를 지키면 1주일 안에 Phase A 출시 가능.

---

## 참고 — 비슷한 서비스의 데이터 모델 인사이트

- **YAMAP**: 산별 페이지에 "n명 다녀옴" 카운트 + 후기 + 활동(=hike) 리스트가 핵심 화면. 우리도 동일 구조로 가면 익숙함 확보.
- **Strava**: hike → segment 매칭이 강력. 우리는 hike → mountain_no 매칭으로 시작 후 점진적으로 segment(=구간) 도입.
- **AllTrails**: trail(=route)별 사용자 후기·사진 갤러리가 캐치. 우리도 `target_type='route'`로 같은 구조 가능.

세 곳 다 핵심은 **"GPS 트랙 → 자동 매칭 → 누적 통계"** 파이프라인. 이걸 PostGIS + Supabase로 일찍 깔아두면 따라잡을 수 있음.
