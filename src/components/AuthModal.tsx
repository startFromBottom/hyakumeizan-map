'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sb = getSupabase();
    if (!sb) {
      setError('로그인이 아직 설정되지 않았어요.');
      return;
    }
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { error: err } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // 매직 링크 클릭 시 돌아올 주소
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) throw err;
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? '로그인 실패. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setEmail('');
    setSent(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40"
         onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm m-4 p-6"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">로그인 / 가입</h2>
          <button onClick={handleClose} disabled={busy}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xl leading-none w-7 h-7 flex items-center justify-center">×</button>
        </div>

        {!sent ? (
          <>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              이메일을 입력하면 로그인 링크를 보내드려요.<br/>
              가입과 로그인이 같은 흐름이에요. 비밀번호 없음.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={busy}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="w-full px-4 py-2 bg-brand text-white rounded-md font-semibold text-sm hover:bg-brand-dark disabled:opacity-50 transition">
                {busy ? '전송 중...' : '✉️ 로그인 링크 받기'}
              </button>
            </form>
            {error && (
              <div className="mt-3 text-xs text-red-600">⚠ {error}</div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
              💡 가입하면 산을 ⭐ 즐겨찾기 하거나 다녀온 산을 ✓ 체크인할 수 있어요.
              <br/>이메일은 로그인에만 사용해요.
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">📬</div>
            <h3 className="text-sm font-bold text-gray-900 mb-2">메일을 확인해주세요</h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              <span className="font-semibold">{email}</span> 으로<br/>
              로그인 링크를 보냈어요. 메일에서 링크를 클릭하면 자동으로 로그인됩니다.
            </p>
            <p className="text-[10px] text-gray-400">
              (도착이 늦으면 스팸함도 확인해보세요)
            </p>
            <button onClick={handleClose}
              className="mt-4 text-xs text-brand hover:underline">
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
