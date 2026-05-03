-- ============================================================
-- Phase B-1: Reviews (후기·평점)
-- ============================================================
--
-- 적용: Supabase Dashboard → SQL Editor → New query → 전체 복붙 → Run
-- 한 번만 실행. 재실행해도 idempotent.

-- 1) reviews 테이블 — mountain/route/hut/lodging 공통
create table if not exists reviews (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  target_type text not null
    check (target_type in ('mountain','route','hut','lodging')),
  target_id text not null,           -- mountain_no(문자열), route_id, hut osm_id 등
  rating smallint not null
    check (rating between 1 and 5),
  body text,                         -- 짧은 후기. null OK (별점만 남기는 경우)
  hike_id bigint,                    -- ← Phase C에서 채워질 자리, 지금은 null
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- 한 사용자가 같은 대상에 여러 번 후기 남기는 거 방지 (수정만 허용)
  unique (user_id, target_type, target_id)
);

create index if not exists reviews_target on reviews(target_type, target_id);
create index if not exists reviews_user on reviews(user_id, created_at desc);

-- updated_at 자동 갱신 트리거
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists reviews_set_updated_at on reviews;
create trigger reviews_set_updated_at
  before update on reviews
  for each row execute function set_updated_at();

-- 2) RLS — 본인 것만 write, 모두 read (공개 후기)
alter table reviews enable row level security;

drop policy if exists "reviews public read" on reviews;
create policy "reviews public read" on reviews
  for select using (true);

drop policy if exists "reviews own write" on reviews;
create policy "reviews own write" on reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) 통계 view — target별 평균 평점 + 후기 수
create or replace view reviews_stats as
  select
    target_type,
    target_id,
    count(*)::int as review_count,
    round(avg(rating)::numeric, 2)::float as avg_rating
  from reviews
  group by target_type, target_id;

grant select on reviews_stats to anon, authenticated;

-- 4) 후기 + 작성자 프로필 join view (UI에서 한 번 fetch)
create or replace view reviews_with_author as
  select
    r.id,
    r.target_type,
    r.target_id,
    r.rating,
    r.body,
    r.hike_id,
    r.created_at,
    r.updated_at,
    r.user_id,
    p.display_name as author_name,
    p.avatar_url as author_avatar
  from reviews r
  left join profiles p on p.id = r.user_id;

grant select on reviews_with_author to anon, authenticated;

-- ============================================================
-- 끝.
-- ============================================================
