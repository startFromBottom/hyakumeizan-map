# Phase B-2 — Storage 버킷 셋업

photos_schema.sql을 먼저 실행한 다음, 아래 단계로 Supabase Storage 버킷을 만든다.

## 1) 버킷 생성

Supabase Dashboard → 좌측 **Storage** 탭 → **New bucket**:

- **Name**: `review-photos`
- **Public bucket**: ✅ ON (사진을 누구나 볼 수 있어야 함)
- **File size limit**: `5 MB` (클라이언트에서 압축 후 보통 200KB~1MB)
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

**Save**.

## 2) 버킷 정책 (RLS)

**Storage → review-photos → Policies** 탭. 또는 SQL Editor에서 실행:

```sql
-- 누구나 읽기 (public 버킷이지만 명시)
create policy "review-photos public read"
on storage.objects for select
to public
using (bucket_id = 'review-photos');

-- 본인 폴더에만 업로드 (path 첫 segment가 자기 user_id)
create policy "review-photos own upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'review-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 본인 사진만 삭제
create policy "review-photos own delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'review-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

## 3) 폴더 구조 (관례)

업로드 시 다음 경로로 저장됨:
```
review-photos/
  {user_id}/                   ← RLS 정책 키
    mountain-72/
      1717000000-abc123.jpg
    hut-node-12345/
      1717000100-def456.jpg
    ...
```

`(storage.foldername(name))[1]`이 첫 segment(= user_id)와 일치해야 업로드 허용됨. 다른 사람 폴더에 못 씀.

## 4) 검증

Storage 버킷 생성 후 **Storage → review-photos** 탭에서 **+ Upload file** 직접 시도해보면 `Permission denied` 또는 정상 업로드 둘 중 하나. 정책 적용되면 본인이 직접 업로드는 안 되고 클라이언트 SDK를 통해서만 됨 (의도된 동작).
