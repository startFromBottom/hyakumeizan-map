'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

/**
 * 매직 링크 콜백 페이지.
 * Supabase가 토큰을 URL hash 또는 query로 보내면, 클라이언트 SDK가 자동으로
 * 세션을 만든 다음 우리는 이 라우트를 빠져나가 메인 페이지로 돌아가면 됨.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { router.replace('/'); return; }

    // Supabase 클라이언트가 URL의 토큰을 자동 파싱해서 세션을 생성함.
    // 우리는 약간 기다린 뒤 메인으로 보내기만 하면 됨.
    let cancelled = false;

    (async () => {
      // 첫 onAuthStateChange가 SIGNED_IN으로 발화되면 즉시 이동
      const { data: sub } = sb.auth.onAuthStateChange((event) => {
        if (cancelled) return;
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          router.replace('/');
        }
      });

      // 폴백: 3초 안에 이벤트 안 오면 그냥 메인으로
      const timer = setTimeout(async () => {
        if (cancelled) return;
        const { data } = await sb.auth.getSession();
        if (!data.session) {
          setError('로그인 처리 실패. 다시 시도해주세요.');
        } else {
          router.replace('/');
        }
      }, 3000);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        sub.subscription.unsubscribe();
      };
    })();
  }, [router]);

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
