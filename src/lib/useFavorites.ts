'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase } from './supabase';
import { useAuth } from './AuthContext';

/**
 * 즐겨찾기 훅 — 본인의 favorites를 메모리에 캐시하고 토글 함수 제공.
 * - user 없으면 빈 Set
 * - toggle: optimistic update + 실패 시 롤백
 */
export function useFavorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const versionRef = useRef(0);   // 동시 요청 충돌 방지

  // 로그인 상태 변경 시 fetch
  useEffect(() => {
    const ver = ++versionRef.current;
    if (!user) {
      setIds(new Set());
      setLoaded(true);
      return;
    }
    const sb = getSupabase();
    if (!sb) { setLoaded(true); return; }
    setLoaded(false);
    (async () => {
      const { data, error } = await sb
        .from('favorites')
        .select('mountain_no')
        .eq('user_id', user.id);
      if (versionRef.current !== ver) return;  // stale
      if (error) {
        console.warn('[favorites] fetch failed:', error);
        setIds(new Set());
      } else {
        setIds(new Set((data ?? []).map((r: any) => r.mountain_no)));
      }
      setLoaded(true);
    })();
  }, [user]);

  const isFav = useCallback((no: number) => ids.has(no), [ids]);

  const toggle = useCallback(async (no: number): Promise<{ ok: boolean; needLogin?: boolean }> => {
    if (!user) return { ok: false, needLogin: true };
    const sb = getSupabase();
    if (!sb) return { ok: false };

    const wasFav = ids.has(no);
    // optimistic
    setIds(prev => {
      const next = new Set(prev);
      if (wasFav) next.delete(no); else next.add(no);
      return next;
    });

    try {
      if (wasFav) {
        const { error } = await sb.from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('mountain_no', no);
        if (error) throw error;
      } else {
        const { error } = await sb.from('favorites')
          .insert({ user_id: user.id, mountain_no: no });
        if (error) throw error;
      }
      return { ok: true };
    } catch (e) {
      // 롤백
      setIds(prev => {
        const next = new Set(prev);
        if (wasFav) next.add(no); else next.delete(no);
        return next;
      });
      console.warn('[favorites] toggle failed:', e);
      return { ok: false };
    }
  }, [user, ids]);

  return { ids, isFav, toggle, loaded, count: ids.size };
}
