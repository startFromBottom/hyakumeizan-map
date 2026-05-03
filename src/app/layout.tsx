import './globals.css';
import 'leaflet/dist/leaflet.css';   // ★ npm 패키지에서 정적 import — 빌드 시 번들링
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/AuthContext';
import AuthModalRoot from '@/components/AuthModalRoot';

export const metadata: Metadata = {
  title: '日本百名山 — 일본 100대 명산 지도',
  description: '일본 100대 명산(日本百名山)의 위치·등산 코스·표고 프로필을 한 화면에서 탐색.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          {children}
          <AuthModalRoot />
        </AuthProvider>
      </body>
    </html>
  );
}
