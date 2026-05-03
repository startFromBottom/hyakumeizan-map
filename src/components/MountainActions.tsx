'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useFavorites } from '@/lib/useFavorites';
import { useCheckins } from '@/lib/useCheckins';

interface Props {
  mountainNo: number;
  mountainName: string;
}

/**
 * DetailPanel 헤더 아래 ⭐ 즐겨찾기 + ✓ 체크인 액션.
 * 비로그인 사용자가 누르면 로그인 모달 자동 오픈.
 */
export default function MountainActions({ mountainNo, mountainName }: Props) {
  const { user, configured, openLogin } = useAuth();
  const fav = useFavorites();
  const ci = useCheckins();
  const [busy, setBusy] = useState(false);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [visitedAt, setVisitedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  if (!configured) return null;

  const isFav = fav.isFav(mountainNo);
  const isClimbed = ci.isClimbed(mountainNo);
  const myCheckins = ci.checkinsFor(mountainNo);

  const onToggleFav = async () => {
    setBusy(true);
    const r = await fav.toggle(mountainNo);
    setBusy(false);
    if (r.needLogin) openLogin();
  };

  const onClickCheckin = () => {
    if (!user) { openLogin(); return; }
    setShowCheckinForm(s => !s);
  };

  const onSubmitCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await ci.add(mountainNo, visitedAt, note);
    setBusy(false);
    if (r.ok) {
      setShowCheckinForm(false);
      setNote('');
    } else if (r.needLogin) {
      openLogin();
    }
  };

  const onRemoveCheckin = async (id: number) => {
    if (!confirm('이 체크인을 삭제할까요?')) return;
    setBusy(true);
    await ci.remove(id);
    setBusy(false);
  };

  return (
    <section className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60">
      <div className="flex gap-2">
        <button
          onClick={onToggleFav}
          disabled={busy}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold border transition disabled:opacity-50 ${
            isFav
              ? 'bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200'
              : 'bg-white border-gray-200 text-gray-700 hover:border-amber-300'
          }`}>
          {isFav ? '⭐ 즐겨찾기됨' : '☆ 즐겨찾기'}
        </button>
        <button
          onClick={onClickCheckin}
          disabled={busy}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold border transition disabled:opacity-50 ${
            isClimbed
              ? 'bg-emerald-100 border-emerald-400 text-emerald-800 hover:bg-emerald-200'
              : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300'
          }`}>
          {isClimbed ? `✓ 다녀옴 (${myCheckins.length})` : '+ 체크인'}
        </button>
      </div>

      {/* 체크인 입력 폼 */}
      {showCheckinForm && user && (
        <form onSubmit={onSubmitCheckin} className="mt-2 p-3 rounded-md bg-white border border-emerald-200 space-y-2">
          <div className="text-[11px] text-gray-600 font-medium">
            언제 다녀오셨나요?
          </div>
          <div className="flex gap-1.5">
            <input
              type="date"
              value={visitedAt}
              onChange={e => setVisitedAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="짧은 메모 (선택)"
              maxLength={200}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="flex gap-1.5 justify-end">
            <button type="button" onClick={() => setShowCheckinForm(false)} disabled={busy}
              className="px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-700">
              취소
            </button>
            <button type="submit" disabled={busy}
              className="px-3 py-1 text-[11px] bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {busy ? '저장 중...' : '✓ 체크인 저장'}
            </button>
          </div>
        </form>
      )}

      {/* 기존 체크인 리스트 (있을 때만) */}
      {myCheckins.length > 0 && !showCheckinForm && (
        <div className="mt-2 space-y-1">
          {myCheckins.slice(0, 3).map(c => (
            <div key={c.id} className="flex items-baseline gap-2 text-[11px] text-gray-600 px-2 py-1 rounded bg-white border border-gray-100">
              <span className="font-mono text-emerald-700 flex-shrink-0">📅 {c.visited_at}</span>
              {c.note && <span className="flex-1 truncate">{c.note}</span>}
              <button onClick={() => onRemoveCheckin(c.id)}
                className="text-[10px] text-gray-300 hover:text-red-500 ml-auto">
                삭제
              </button>
            </div>
          ))}
          {myCheckins.length > 3 && (
            <div className="text-[10px] text-gray-400 text-center">
              + {myCheckins.length - 3}회 더
            </div>
          )}
        </div>
      )}
    </section>
  );
}
