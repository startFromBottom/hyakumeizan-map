-- ============================================================
-- Phase A 스키마 — 일본 100명산 사용자 기능
-- ROADMAP.md 의 Phase A 그대로
-- ============================================================
--
-- 적용 방법: Supabase Dashboard → SQL Editor → New query → 전체 복붙 → Run
-- 한 번만 실행하면 됨. 재실행해도 idempotent하게 안전.

-- 1) PostGIS 활성화 (Phase C에서 필요할 거지만 미리)
create extension if not exists postgis;

-- 2) 사용자 프로필
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- 새 가입 시 profiles 자동 생성 트리거
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 3) 즐겨찾기
create table if not exists favorites (
  user_id uuid references profiles(id) on delete cascade,
  mountain_no int not null,
  created_at timestamptz default now(),
  primary key (user_id, mountain_no)
);

create index if not exists favorites_mountain on favorites(mountain_no);

-- 4) 체크인 (다녀온 산)
create table if not exists checkins (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  mountain_no int not null,
  visited_at date not null,
  note text,
  source text not null default 'manual'
    check (source in ('manual','gps','import')),
  hike_id bigint,    -- ← Phase C에서 채워질 자리, 지금은 null
  created_at timestamptz default now()
);

create index if not exists checkins_user_visited on checkins(user_id, visited_at desc);
create index if not exists checkins_mountain on checkins(mountain_no);

-- ============================================================
-- Row Level Security (RLS) 정책 — 첫날부터 켜둠
-- ============================================================

alter table profiles  enable row level security;
alter table favorites enable row level security;
alter table checkins  enable row level security;

-- profiles: 본인은 read/update, 그 외 사람은 read만 (display_name·avatar 공개)
drop policy if exists "profiles read all" on profiles;
create policy "profiles read all" on profiles
  for select using (true);

drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles
  for update using (auth.uid() = id);

-- favorites: 본인 것만 모든 권한 (insert, select, delete)
drop policy if exists "favorites own all" on favorites;
create policy "favorites own all" on favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 산별 즐겨찾기 카운트(공개)는 별도 view로 (개별 row 노출 안 함)
create or replace view favorites_count as
  select mountain_no, count(*)::int as count
  from favorites
  group by mountain_no;

grant select on favorites_count to anon, authenticated;

-- checkins: 본인 것만 read/write (공개 카운트는 view로 별도)
drop policy if exists "checkins own all" on checkins;
create policy "checkins own all" on checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace view checkins_count as
  select mountain_no, count(distinct user_id)::int as people
  from checkins
  group by mountain_no;

grant select on checkins_count to anon, authenticated;

-- ============================================================
-- 검증용 헬퍼 — 본인 진행률 ('n/100')
-- ============================================================
create or replace view my_progress as
  select count(distinct mountain_no)::int as climbed
  from checkins
  where user_id = auth.uid();

grant select on my_progress to authenticated;

-- ============================================================
-- 끝.
-- 다음 단계:
--   1) Authentication → Providers → Google 활성화
--   2) Authentication → URL Configuration:
--      - Site URL: https://hyakumeizan-map.vercel.app
--      - Redirect URLs: https://hyakumeizan-map.vercel.app/auth/callback,
--                       http://localhost:3001/auth/callback
-- ============================================================
