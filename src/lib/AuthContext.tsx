'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;        // 첫 세션 로딩 중
  configured: boolean;     // env 셋업 여부
  signOut: () => Promise<void>;
  // 어디서든 로그인 모달을 열 수 있게
  loginModalOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null, session: null, loading: true, configured: false,
  signOut: async () => {},
  loginModalOpen: false,
  openLogin: () => {},
  closeLogin: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const configured = isSupabaseConfigured();
  const openLogin = () => setLoginModalOpen(true);
  const closeLogin = () => setLoginModalOpen(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }

    // 첫 진입 시 기존 세션 복원
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 로그인·로그아웃 이벤트 구독
    const { data: sub } = sb.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, configured, signOut, loginModalOpen, openLogin, closeLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
