-- ============================================================
-- Phase B-2: 사진 업로드 (photos 테이블 + Storage 버킷)
-- ============================================================
--
-- 적용: Supabase Dashboard → SQL Editor → New query → 전체 복붙 → Run
-- 한 번만 실행. 재실행해도 idempotent.

-- 1) photos 테이블
create table if not exists photos (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,

  -- Storage 경로 (버킷 안 path)
  storage_path text not null,

  -- 어디에 붙은 사진인지 (review_id로 연결하지 않고 target 직접 참조)
  target_type text not null
    check (target_type in ('mountain','route','hut','lodging')),
  target_id text not null,

  -- 관계 후기 (있으면)
  review_id bigint references reviews(id) on delete set null,

  -- 메타데이터
  width int,
  height int,
  size_bytes int,
  mime_type text,
  caption text,                                  -- 사진 짧은 설명 (선택)

  -- EXIF에서 추출 (있을 때)
  taken_at timestamptz,
  geom geography(Point, 4326),                   -- ← Phase C 산행 트랙과 매칭에 사용

  -- Phase C 대비
  hike_id bigint,

  -- 모더레이션 (Phase B-3에서 활용)
  flagged_at timestamptz,
  deleted_at timestamptz,

  created_at timestamptz default now()
);

create index if not exists photos_target on photos(target_type, target_id) where deleted_at is null;
create index if not exists photos_user on photos(user_id, created_at desc);
create index if not exists photos_review on photos(review_id);
create index if not exists photos_geom_gix on photos using gist(geom);

-- 2) RLS — 본인만 write, 모두 read (deleted_at 필터링)
alter table photos enable row level security;

drop policy if exists "photos public read" on photos;
create policy "photos public read" on photos
  for select using (deleted_at is null);

drop policy if exists "photos own write" on photos;
create policy "photos own write" on photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) target별 카운트 view
create or replace view photos_count as
  select target_type, target_id, count(*)::int as photo_count
  from photos
  where deleted_at is null
  group by target_type, target_id;

grant select on photos_count to anon, authenticated;

-- 4) 사진 + 작성자 join view
create or replace view photos_with_author as
  select
    ph.id,
    ph.user_id,
    ph.storage_path,
    ph.target_type,
    ph.target_id,
    ph.review_id,
    ph.width, ph.height, ph.size_bytes, ph.mime_type,
    ph.caption,
    ph.taken_at,
    ph.created_at,
    p.display_name as author_name,
    p.avatar_url as author_avatar
  from photos ph
  left join profiles p on p.id = ph.user_id
  where ph.deleted_at is null;

grant select on photos_with_author to anon, authenticated;

-- 5) RPC: 본인 사진의 geom을 lat/lon으로 설정
create or replace function photos_set_geom(photo_id bigint, lon float, lat float)
returns void as $$
begin
  update photos
  set geom = st_setsrid(st_makepoint(lon, lat), 4326)::geography
  where id = photo_id and user_id = auth.uid();
end;
$$ language plpgsql security invoker;

grant execute on function photos_set_geom(bigint, float, float) to authenticated;

-- ============================================================
-- 끝.
-- 다음 단계: Storage 버킷 생성 + 정책 (별도 - photos_storage_setup.md 참고)
-- ============================================================
