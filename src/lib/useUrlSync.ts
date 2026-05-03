'use client';

import { useEffect, useRef } from 'react';

/**
 * URL ?m=&r= 파라미터와 selectedNo / selectedRouteId를 양방향 동기화.
 * - mount 시 1회 URL 읽음 → 콜백으로 setter 호출
 * - 이후 selectedNo/selectedRouteId 변경 시마다 history.replaceState로 URL 갱신
 *   (router.push 안 씀 → 뒤로가기 스택에 안 쌓이도록)
 */
export function useUrlSync(opts: {
  selectedNo: number | null;
  selectedRouteId: string | null;
  onInit: (no: number | null, routeId: string | null) => void;
}) {
  const initDoneRef = useRef(false);

  // 1) Mount 시 URL 읽기
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initDoneRef.current) return;
    initDoneRef.current = true;
    const sp = new URLSearchParams(window.location.search);
    const m = sp.get('m');
    const r = sp.get('r');
    const no = m ? parseInt(m, 10) : null;
    const rid = r || null;
    if (no !== null && !Number.isNaN(no)) {
      opts.onInit(no, rid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) selectedNo / selectedRouteId 변경 시 URL 동기화
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!initDoneRef.current) return;
    const url = new URL(window.location.href);
    if (opts.selectedNo != null) {
      url.searchParams.set('m', String(opts.selectedNo));
    } else {
      url.searchParams.delete('m');
    }
    if (opts.selectedRouteId) {
      url.searchParams.set('r', opts.selectedRouteId);
    } else {
      url.searchParams.delete('r');
    }
    const nextUrl = url.pathname + (url.search || '') + url.hash;
    if (nextUrl !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [opts.selectedNo, opts.selectedRouteId]);
}

/**
 * 현재 선택 상태를 공유 가능한 URL로 만들어 클립보드에 복사.
 */
export async function copyShareUrl(selectedNo: number | null, selectedRouteId: string | null): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.origin + window.location.pathname);
  if (selectedNo != null) url.searchParams.set('m', String(selectedNo));
  if (selectedRouteId) url.searchParams.set('r', selectedRouteId);
  try {
    await navigator.clipboard.writeText(url.toString());
    return true;
  } catch {
    // fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = url.toString();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
