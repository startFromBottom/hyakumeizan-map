'use client';

import { useState, useRef, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'email' | 'code';

export default function AuthModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);  // 비밀번호 로그인 모드 (개발/테스트용)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // 코드 단계로 넘어갈 때 자동 포커스
  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [step]);

  if (!open) return null;

  const sendCode = async (e: React.FormEvent) => {
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
          shouldCreateUser: true,
          // emailRedirectTo 생략 → OTP 코드 방식 사용
        },
      });
      if (err) throw err;
      setStep('code');
    } catch (e: any) {
      setError(e?.message ?? '코드 전송 실패. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sb = getSupabase();
    if (!sb) return;
    const cleanCode = code.replace(/\D/g, '');
    if (cleanCode.length < 6 || cleanCode.length > 8) {
      setError('인증 코드를 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await sb.auth.verifyOtp({
        email: email.trim(),
        token: cleanCode,
        type: 'email',
      });
      if (err) throw err;
      // 성공 — onAuthStateChange가 발화되어 헤더가 자동 갱신
      handleClose();
    } catch (e: any) {
      setError(e?.message ?? '코드가 올바르지 않거나 만료되었어요.');
    } finally {
      setBusy(false);
    }
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sb = getSupabase();
    if (!sb) return;
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      const { error: err } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      handleClose();
    } catch (e: any) {
      setError(e?.message ?? '로그인 실패. 이메일·비밀번호를 확인해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    try {
      const { error: err } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) throw err;
      // signInWithOAuth는 자동으로 Google 로그인 페이지로 리다이렉트.
      // 여기 코드는 보통 도달 안 함.
    } catch (e: any) {
      setError(e?.message ?? 'Google 로그인 실패');
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setEmail('');
    setCode('');
    setPassword('');
    setStep('email');
    setUsePassword(false);
    setError(null);
    onClose();
  };

  const goBackToEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40"
         onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm m-4 p-6"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {step === 'email' ? '로그인 / 가입' : '코드 입력'}
          </h2>
          <button onClick={handleClose} disabled={busy}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xl leading-none w-7 h-7 flex items-center justify-center">×</button>
        </div>

        {step === 'email' ? (
          <>
            {/* Google OAuth — 가장 빠른 길 */}
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 mb-3 border border-gray-300 bg-white rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-50">
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.37-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {busy ? '연결 중...' : 'Google로 계속하기'}
            </button>

            {/* 구분선 */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-gray-400">또는</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              {usePassword
                ? '이메일과 비밀번호로 로그인합니다.'
                : '이메일을 입력하면 인증 코드를 보내드려요. 가입과 로그인이 같은 흐름이에요.'}
            </p>
            <form onSubmit={usePassword ? signInWithPassword : sendCode} className="space-y-3">
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
              {usePassword && (
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  disabled={busy}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              )}
              <button
                type="submit"
                disabled={busy || !email.trim() || (usePassword && !password)}
                className="w-full px-4 py-2 bg-brand text-white rounded-md font-semibold text-sm hover:bg-brand-dark disabled:opacity-50 transition">
                {busy ? '...' : usePassword ? '🔑 로그인' : '✉️ 인증 코드 받기'}
              </button>
            </form>
            {error && (
              <div className="mt-3 text-xs text-red-600">⚠ {error}</div>
            )}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => { setUsePassword(p => !p); setError(null); }}
                disabled={busy}
                className="text-[11px] text-gray-500 hover:text-brand underline-offset-2 hover:underline">
                {usePassword ? '← 인증 코드로 로그인' : '비밀번호로 로그인 →'}
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
              💡 가입하면 산을 ⭐ 즐겨찾기 하거나 다녀온 산을 ✓ 체크인할 수 있어요.
              <br/>이메일은 로그인에만 사용해요.
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              <span className="font-semibold text-gray-700">{email}</span> 으로 보낸<br/>
              인증 코드를 입력해주세요. (도착이 늦으면 스팸함도 확인)
            </p>
            <form onSubmit={verify} className="space-y-3">
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={code}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setCode(v);
                  // 6자리 또는 8자리 다 입력되면 자동 제출
                  if (v.length === 6 || v.length === 8) {
                    setTimeout(() => {
                      const form = e.currentTarget.form;
                      if (form && !busy) form.requestSubmit();
                    }, 100);
                  }
                }}
                placeholder="인증 코드"
                disabled={busy}
                autoComplete="one-time-code"
                className="w-full px-3 py-3 border border-gray-300 rounded-md text-center text-2xl font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="w-full px-4 py-2 bg-brand text-white rounded-md font-semibold text-sm hover:bg-brand-dark disabled:opacity-50 transition">
                {busy ? '확인 중...' : '로그인'}
              </button>
            </form>
            {error && (
              <div className="mt-3 text-xs text-red-600">⚠ {error}</div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-[11px]">
              <button onClick={goBackToEmail} disabled={busy}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-30">
                ← 다른 이메일로
              </button>
              <button onClick={sendCode as any} disabled={busy}
                className="text-brand hover:underline disabled:opacity-30">
                코드 다시 받기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
