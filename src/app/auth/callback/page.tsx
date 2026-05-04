'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

/**
 * 매직 링크 콜백 페이지 (PKCE flow).
 * Supabase가 ?code=xxx 파라미터로 돌려보내면 exchangeCodeForSession을 호출해
 * 세션을 만들어야 함. (@supabase/ssr 기본 PKCE)
 *
 * useSearchParams는 prerender 시 Suspense 경계가 필요함.
 */
function CallbackInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { router.replace('/'); return; }

    let cancelled = false;
    (async () => {
      try {
        // 0) URL 에러 파라미터 먼저 체크
        const errParam = sp.get('error_description') || sp.get('error');
        if (errParam) {
          setError(decodeURIComponent(errParam));
          return;
        }

        // 1) detectSessionInUrl이 자동 처리 — onAuthStateChange로 SIGNED_IN 대기
        const { data: sub } = sb.auth.onAuthStateChange((event) => {
          if (cancelled) return;
          if (event === 'SIGNED_IN') {
            router.replace('/');
          }
        });

        // 2) 폴백 — SDK가 처리 못 했으면 직접 exchangeCodeForSession
        const code = sp.get('code');
        if (code) {
          // 약간 기다려 SDK 자동 처리 기회 줌
          await new Promise(r => setTimeout(r, 300));
          if (cancelled) return;
          const { data: sess } = await sb.auth.getSession();
          if (!sess.session) {
            // 아직 세션 없으면 직접 교환
            const { error: exErr } = await sb.auth.exchangeCodeForSession(code);
            if (cancelled) return;
            if (exErr) {
              setError(exErr.message || '로그인 처리 실패');
              sub.subscription.unsubscribe();
              return;
            }
          }
          router.replace('/');
          return;
        }

        // 3) implicit flow (URL hash) — 잠깐 기다린 뒤 세션 확인
        await new Promise(r => setTimeout(r, 800));
        if (cancelled) return;
        const { data } = await sb.auth.getSession();
        sub.subscription.unsubscribe();
        if (data.session) {
          router.replace('/');
        } else {
          setError('로그인 정보를 찾지 못했어요. 링크가 만료되었거나 같은 브라우저에서 시작하지 않았을 수 있어요.');
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '알 수 없는 오류');
      }
    })();
    return () => { cancelled = true; };
  }, [router, sp]);

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-brand to-brand-dark">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm m-4 text-center">
        {!error ? (
          <>
            <div className="text-3xl mb-3">🔓</div>
            <h2 className="text-base font-bold text-gray-900 mb-2">로그인 중...</h2>
            <p className="text-xs text-gray-500">잠시만 기다려주세요</p>
          </>
        ) : (
          <>
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-base font-bold text-gray-900 mb-2">오류</h2>
            <p className="text-xs text-red-600 mb-4">{error}</p>
            <button onClick={() => router.replace('/')}
              className="px-4 py-2 bg-brand text-white rounded text-sm hover:bg-brand-dark">
              메인으로 돌아가기
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <main className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-brand to-brand-dark">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm m-4 text-center">
          <div className="text-3xl mb-3">🔓</div>
          <h2 className="text-base font-bold text-gray-900">로그인 중...</h2>
        </div>
      </main>
    }>
      <CallbackInner />
    </Suspense>
  );
}
