'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase } from './supabase';
import { useAuth } from './AuthContext';

export interface CheckinRow {
  id: number;
  mountain_no: number;
  visited_at: string;   // 'YYYY-MM-DD'
  note: string | null;
  source: 'manual' | 'gps' | 'import';
  created_at: string;
}

/**
 * 체크인 훅 — 본인이 다녀온 산 기록 read/write.
 * 한 산에 여러 번 다녀올 수 있어 row가 여러 개일 수 있음 (다른 visited_at).
 * UI 단순화 위해 mountain_no 단위로 "다녀왔는가"를 Set으로도 노출.
 */
export function useCheckins() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [climbedSet, setClimbedSet] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const versionRef = useRef(0);

  useEffect(() => {
    const ver = ++versionRef.current;
    if (!user) {
      setRows([]);
      setClimbedSet(new Set());
      setLoaded(true);
      return;
    }
    const sb = getSupabase();
    if (!sb) { setLoaded(true); return; }
    setLoaded(false);
    (async () => {
      const { data, error } = await sb
        .from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .order('visited_at', { ascending: false });
      if (versionRef.current !== ver) return;
      if (error) {
        console.warn('[checkins] fetch failed:', error);
        setRows([]);
        setClimbedSet(new Set());
      } else {
        const list = (data ?? []) as CheckinRow[];
        setRows(list);
        setClimbedSet(new Set(list.map(r => r.mountain_no)));
      }
      setLoaded(true);
    })();
  }, [user]);

  const isClimbed = useCallback((no: number) => climbedSet.has(no), [climbedSet]);

  const checkinsFor = useCallback((no: number) =>
    rows.filter(r => r.mountain_no === no), [rows]);

  const add = useCallback(async (
    mountain_no: number,
    visited_at: string,
    note?: string,
  ): Promise<{ ok: boolean; needLogin?: boolean }> => {
    if (!user) return { ok: false, needLogin: true };
    const sb = getSupabase();
    if (!sb) return { ok: false };
    try {
      const { data, error } = await sb.from('checkins')
        .insert({
          user_id: user.id,
          mountain_no,
          visited_at,
          note: note?.trim() || null,
          source: 'manual',
        })
        .select()
        .single();
      if (error) throw error;
      const newRow = data as CheckinRow;
      setRows(prev => [newRow, ...prev]);
      setClimbedSet(prev => new Set(prev).add(mountain_no));
      return { ok: true };
    } catch (e) {
      console.warn('[checkins] add failed:', e);
      return { ok: false };
    }
  }, [user]);

  const remove = useCallback(async (id: number): Promise<{ ok: boolean }> => {
    if (!user) return { ok: false };
    const sb = getSupabase();
    if (!sb) return { ok: false };
    const target = rows.find(r => r.id === id);
    if (!target) return { ok: false };
    // optimistic
    setRows(prev => prev.filter(r => r.id !== id));
    try {
      const { error } = await sb.from('checkins')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      // mountain_no가 다른 row에도 있는지 확인 후 climbedSet 갱신
      const stillClimbed = rows.some(r => r.id !== id && r.mountain_no === target.mountain_no);
      if (!stillClimbed) {
        setClimbedSet(prev => {
          const next = new Set(prev);
          next.delete(target.mountain_no);
          return next;
        });
      }
      return { ok: true };
    } catch (e) {
      // 롤백
      setRows(prev => [target, ...prev]);
      console.warn('[checkins] remove failed:', e);
      return { ok: false };
    }
  }, [user, rows]);

  return {
    rows,
    isClimbed,
    checkinsFor,
    add,
    remove,
    loaded,
    climbedCount: climbedSet.size,
  };
}
