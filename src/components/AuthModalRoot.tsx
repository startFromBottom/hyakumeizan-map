'use client';

import { useAuth } from '@/lib/AuthContext';
import AuthModal from './AuthModal';

/**
 * AuthContext의 모달 상태를 받아 한 번만 렌더하는 글로벌 마운트.
 * 어디서든 useAuth().openLogin() 부르면 열림.
 */
export default function AuthModalRoot() {
  const { loginModalOpen, closeLogin, configured } = useAuth();
  if (!configured) return null;
  return <AuthModal open={loginModalOpen} onClose={closeLogin} />;
}
