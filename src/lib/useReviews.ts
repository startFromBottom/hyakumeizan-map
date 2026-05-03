'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase } from './supabase';
import { useAuth } from './AuthContext';

export type ReviewTargetType = 'mountain' | 'route' | 'hut' | 'lodging';

export interface ReviewRow {
  id: number;
  user_id: string;
  target_type: ReviewTargetType;
  target_id: string;
  rating: number;
  body: string | null;
  hike_id: number | null;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
  author_avatar?: string | null;
}

/**
 * 한 target에 대한 후기 read·write 훅.
 * - 다른 사용자의 후기 리스트
 * - 본인 후기 (있으면 1개, unique 제약)
 * - 통계 (avg_rating, review_count)
 */
export function useReviews(targetType: ReviewTargetType, targetId: string | null) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [stats, setStats] = useState<{ avg: number | null; count: number }>({ avg: null, count: 0 });
  const [myReview, setMyReview] = useState<ReviewRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const versionRef = useRef(0);

  const refetch = useCallback(async () => {
    const ver = ++versionRef.current;
    if (!targetId) { setLoaded(true); return; }
    const sb = getSupabase();
    if (!sb) { setLoaded(true); return; }
    setLoaded(false);

    // 후기 + 작성자 (최대 50개, 최신순)
    const { data: rows, error } = await sb
      .from('reviews_with_author')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (versionRef.current !== ver) return;
    if (error) {
      console.warn('[reviews] fetch failed:', error);
      setReviews([]);
      setMyReview(null);
      setStats({ avg: null, count: 0 });
      setLoaded(true);
      return;
    }
    const list = (rows ?? []) as ReviewRow[];
    setReviews(list);
    setMyReview(user ? list.find(r => r.user_id === user.id) ?? null : null);

    // 통계 (view에서 한 row)
    const { data: statRow } = await sb
      .from('reviews_stats')
      .select('avg_rating, review_count')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .maybeSingle();
    if (versionRef.current !== ver) return;
    if (statRow) {
      setStats({ avg: statRow.avg_rating, count: statRow.review_count });
    } else {
      setStats({ avg: null, count: 0 });
    }
    setLoaded(true);
  }, [targetType, targetId, user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // 후기 추가 또는 수정 (upsert) — unique 제약 덕분에 같은 사용자가 두 번 못 씀
  const submit = useCallback(async (
    rating: number,
    body: string,
  ): Promise<{ ok: boolean; needLogin?: boolean }> => {
    if (!user) return { ok: false, needLogin: true };
    if (!targetId) return { ok: false };
    const sb = getSupabase();
    if (!sb) return { ok: false };
    try {
      const { error } = await sb.from('reviews').upsert({
        user_id: user.id,
        target_type: targetType,
        target_id: targetId,
        rating,
        body: body.trim() || null,
      }, { onConflict: 'user_id,target_type,target_id' });
      if (error) throw error;
      await refetch();
      return { ok: true };
    } catch (e) {
      console.warn('[reviews] submit failed:', e);
      return { ok: false };
    }
  }, [user, targetType, targetId, refetch]);

  const remove = useCallback(async (): Promise<{ ok: boolean }> => {
    if (!user || !myReview) return { ok: false };
    const sb = getSupabase();
    if (!sb) return { ok: false };
    try {
      const { error } = await sb.from('reviews')
        .delete()
        .eq('id', myReview.id)
        .eq('user_id', user.id);
      if (error) throw error;
      await refetch();
      return { ok: true };
    } catch (e) {
      console.warn('[reviews] remove failed:', e);
      return { ok: false };
    }
  }, [user, myReview, refetch]);

  return {
    reviews,         // 모든 사람 후기
    myReview,        // 본인 후기 (있으면)
    stats,           // { avg, count }
    loaded,
    submit,          // (rating, body) => upsert
    remove,          // 본인 후기 삭제
    refetch,
  };
}

/**
 * 여러 target의 통계를 한 번에 fetch — Sidebar처럼 100개 산 평점을
 * 한꺼번에 보여줄 때 사용.
 */
export function useReviewStatsBulk(targetType: ReviewTargetType, targetIds: string[]) {
  const [statsMap, setStatsMap] = useState<Record<string, { avg: number | null; count: number }>>({});
  const [loaded, setLoaded] = useState(false);
  const versionRef = useRef(0);
  const idsKey = targetIds.join(',');

  useEffect(() => {
    const ver = ++versionRef.current;
    if (targetIds.length === 0) { setStatsMap({}); setLoaded(true); return; }
    const sb = getSupabase();
    if (!sb) { setLoaded(true); return; }
    setLoaded(false);
    (async () => {
      const { data, error } = await sb
        .from('reviews_stats')
        .select('target_id, avg_rating, review_count')
        .eq('target_type', targetType)
        .in('target_id', targetIds);
      if (versionRef.current !== ver) return;
      if (error) {
        console.warn('[reviews_stats bulk] fetch failed:', error);
        setStatsMap({});
      } else {
        const m: Record<string, { avg: number | null; count: number }> = {};
        for (const r of (data ?? [])) {
          m[r.target_id] = { avg: r.avg_rating, count: r.review_count };
        }
        setStatsMap(m);
      }
      setLoaded(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, idsKey]);

  return { statsMap, loaded };
}
