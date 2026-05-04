'use client';

import { useState } from 'react';
import { copyShareUrl } from '@/lib/useUrlSync';

interface Props {
  selectedNo: number | null;
  selectedRouteId: string | null;
}

export default function ShareButton({ selectedNo, selectedRouteId }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const ok = await copyShareUrl(selectedNo, selectedRouteId);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // 산 선택 안 됐으면 사이트 메인 URL을 공유 — 항상 활성
  // 위치: 모바일에선 좌상단 (left-3), 데스크톱에선 사이드바 토글 옆 (left-[110px])
  return (
    <button onClick={onClick}
      className={`absolute top-3 left-3 md:left-[110px] z-[1100] shadow-md rounded-md px-3 py-2 text-xs font-semibold border transition ${
        copied
          ? 'bg-emerald-600 text-white border-emerald-700'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
      }`}
      title={selectedNo != null ? '현재 보고 있는 산·코스를 공유' : '사이트 링크 공유'}>
      {copied ? '✓ 복사됨!' : '🔗 공유'}
    </button>
  );
}
