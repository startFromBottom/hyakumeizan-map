'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// 싱글턴 — 한 번만 만들고 재사용
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;  // SSR 안전
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // env 미설정 시 — 로컬 dev에서 .env.local 잊은 경우 대비
  if (!url || !anon) {
    if (typeof console !== 'undefined') {
      console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 없습니다. 로그인 기능 비활성.');
    }
    return null;
  }

  _client = createBrowserClient(url, anon);
  return _client;
}

// 환경변수가 셋업되었는지 — UI에서 로그인 버튼 표시 여부 결정에 사용
export function isSupabaseConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
