'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase } from './supabase';
import { useAuth } from './AuthContext';
import type { ReviewTargetType } from './useReviews';

export interface PhotoRow {
  id: number;
  user_id: string;
  storage_path: string;
  target_type: ReviewTargetType;
  target_id: string;
  review_id: number | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  mime_type: string | null;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
  author_name?: string | null;
  author_avatar?: string | null;
  // 클라이언트 편의
  public_url: string;
}

const BUCKET = 'review-photos';

export interface UploadParams {
  file: Blob;                     // 압축된 이미지
  ext: string;                    // 'jpg' | 'png' | 'webp'
  width: number;
  height: number;
  mimeType: string;
  taken_at?: string | null;
  geo?: { lat: number; lon: number } | null;
  caption?: string;
  reviewId?: number | null;
}

/**
 * target에 붙은 사진 목록 + 업로드/삭제.
 */
export function usePhotos(targetType: ReviewTargetType, targetId: string | null) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const versionRef = useRef(0);

  const buildPublicUrl = useCallback((path: string) => {
    const sb = getSupabase();
    if (!sb) return '';
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const refetch = useCallback(async () => {
    const ver = ++versionRef.current;
    if (!targetId) { setLoaded(true); return; }
    const sb = getSupabase();
    if (!sb) { setLoaded(true); return; }
    setLoaded(false);
    const { data, error } = await sb
      .from('photos_with_author')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
      .limit(60);
    if (versionRef.current !== ver) return;
    if (error) {
      console.warn('[photos] fetch failed:', error);
      setPhotos([]);
    } else {
      const list = (data ?? []).map((r: any) => ({
        ...r,
        public_url: buildPublicUrl(r.storage_path),
      })) as PhotoRow[];
      setPhotos(list);
    }
    setLoaded(true);
  }, [targetType, targetId, buildPublicUrl]);

  useEffect(() => { refetch(); }, [refetch]);

  // 업로드 — 압축은 호출자에서 (PhotoUpload 컴포넌트)
  const upload = useCallback(async (
    params: UploadParams
  ): Promise<{ ok: boolean; needLogin?: boolean; photo?: PhotoRow; error?: string }> => {
    if (!user) return { ok: false, needLogin: true };
    if (!targetId) return { ok: false, error: 'target 없음' };
    const sb = getSupabase();
    if (!sb) return { ok: false };

    // path: {user_id}/{target_type}-{target_id_safe}/{ts}-{rand}.{ext}
    const safeId = targetId.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60);
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${user.id}/${targetType}-${safeId}/${ts}-${rand}.${params.ext}`;

    try {
      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(path, params.file, {
          contentType: params.mimeType,
          upsert: false,
          cacheControl: '31536000',
        });
      if (upErr) throw upErr;

      // DB row 생성
      const { data: row, error: dbErr } = await sb.from('photos').insert({
        user_id: user.id,
        storage_path: path,
        target_type: targetType,
        target_id: targetId,
        review_id: params.reviewId ?? null,
        width: params.width,
        height: params.height,
        size_bytes: (params.file as any).size ?? null,
        mime_type: params.mimeType,
        caption: params.caption?.trim() || null,
        taken_at: params.taken_at ?? null,
        // PostGIS Point — WKT 문자열 ('POINT(lon lat)')
        // Supabase는 geography 컬럼에 WKT 또는 GeoJSON 입력 가능
      }).select().single();

      if (dbErr) {
        // DB 실패 시 Storage 정리
        await sb.storage.from(BUCKET).remove([path]).catch(() => {});
        throw dbErr;
      }

      // geo가 있으면 별도 update — RPC photos_set_geom
      if (params.geo) {
        try {
          await sb.rpc('photos_set_geom', {
            photo_id: row.id,
            lon: params.geo.lon,
            lat: params.geo.lat,
          });
        } catch (e) {
          console.warn('[photos] geo set failed (무시):', e);
        }
      }

      const newPhoto: PhotoRow = {
        ...(row as any),
        public_url: buildPublicUrl(path),
      };
      setPhotos(prev => [newPhoto, ...prev]);
      return { ok: true, photo: newPhoto };
    } catch (e: any) {
      console.warn('[photos] upload failed:', e);
      return { ok: false, error: e?.message ?? '업로드 실패' };
    }
  }, [user, targetType, targetId, buildPublicUrl]);

  const remove = useCallback(async (photoId: number): Promise<{ ok: boolean }> => {
    if (!user) return { ok: false };
    const sb = getSupabase();
    if (!sb) return { ok: false };
    const target = photos.find(p => p.id === photoId);
    if (!target) return { ok: false };
    // optimistic
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    try {
      // Storage 먼저
      await sb.storage.from(BUCKET).remove([target.storage_path]);
      const { error } = await sb.from('photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', user.id);
      if (error) throw error;
      return { ok: true };
    } catch (e) {
      // 롤백
      setPhotos(prev => [target, ...prev]);
      console.warn('[photos] remove failed:', e);
      return { ok: false };
    }
  }, [user, photos]);

  return { photos, loaded, upload, remove, refetch };
}
