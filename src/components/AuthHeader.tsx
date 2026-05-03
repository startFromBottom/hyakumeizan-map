'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import AuthModal from './AuthModal';

export default function AuthHeader() {
  const { user, loading, configured, signOut } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // SSR/CSR hydration mismatch 방지 — 클라이언트 마운트 후에만 렌더
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  // env 셋업 안 된 환경에서는 아무것도 표시 안 함 (로컬 dev에서 .env.local 깜빡한 경우 등)
  if (!configured) return null;

  if (loading) {
    return (
      <div className="absolute top-3 right-16 z-[1100] bg-white shadow rounded-md px-3 py-2 text-xs text-gray-400 border border-gray-200">
        ...
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="absolute top-3 right-3 z-[1100] bg-white shadow-md rounded-md px-3 py-2 text-xs font-semibold border border-gray-200 hover:bg-brand hover:text-white hover:border-brand transition">
          🔓 로그인
        </button>
        <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  // 로그인된 상태 — 이메일 첫 글자 아바타 + 드롭다운
  const initial = (user.user_metadata?.name || user.email || '?').slice(0, 1).toUpperCase();
  const displayName = user.user_metadata?.name || user.email?.split('@')[0] || '사용자';

  return (
    <>
      <div className="absolute top-3 right-3 z-[1100]">
        <button
          onClick={() => setMenuOpen(s => !s)}
          className="flex items-center gap-2 bg-white shadow-md rounded-full pl-1 pr-3 py-1 text-xs font-semibold border border-gray-200 hover:border-brand transition">
          <span className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold">
            {initial}
          </span>
          <span className="text-gray-700 max-w-[100px] truncate">{displayName}</span>
        </button>

        {menuOpen && (
          <>
            {/* 바깥 클릭 시 닫기 */}
            <div className="fixed inset-0 z-[1099]" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-[1100] overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="text-xs font-semibold text-gray-900 truncate">{displayName}</div>
                <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
              </div>
              <button
                onClick={() => { signOut(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition">
                로그아웃
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
