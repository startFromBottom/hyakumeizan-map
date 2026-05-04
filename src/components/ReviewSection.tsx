'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useReviews, ReviewTargetType, ReviewRow } from '@/lib/useReviews';
import { usePhotos } from '@/lib/usePhotos';
import PhotoUpload from './PhotoUpload';
import Lightbox from './Lightbox';

interface Props {
  targetType: ReviewTargetType;
  targetId: string;
  targetName?: string;             // "후지산", "산장 X" 등 — placeholder용
  compact?: boolean;               // 산장/숙소처럼 작게
}

const TYPE_LABEL: Record<ReviewTargetType, string> = {
  mountain: '산',
  route: '코스',
  hut: '산장',
  lodging: '숙소',
};

const SECTION_TITLE: Record<ReviewTargetType, string> = {
  mountain: '산 후기',
  route: '코스 후기',
  hut: '산장 후기',
  lodging: '숙소 후기',
};

export default function ReviewSection({ targetType, targetId, targetName, compact }: Props) {
  const { user, configured, openLogin } = useAuth();
  const { reviews, myReview, stats, loaded, submit, remove } = useReviews(targetType, targetId);
  const { photos, remove: removePhoto } = usePhotos(targetType, targetId);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // 편집 모드 진입 시 기존 본인 후기 로드
  useEffect(() => {
    if (editing && myReview) {
      setRating(myReview.rating);
      setBody(myReview.body ?? '');
    } else if (editing && !myReview) {
      setRating(0);
      setBody('');
    }
  }, [editing, myReview]);

  if (!configured) return null;

  const onClickWrite = () => {
    if (!user) { openLogin(); return; }
    setEditing(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) return;
    setBusy(true);
    const r = await submit(rating, body);
    setBusy(false);
    if (r.ok) {
      setEditing(false);
    } else if (r.needLogin) {
      openLogin();
    }
  };

  const onDelete = async () => {
    if (!confirm('내 후기를 삭제할까요?')) return;
    setBusy(true);
    await remove();
    setBusy(false);
  };

  const others = reviews.filter(r => !user || r.user_id !== user.id);

  return (
    <section className={`px-5 ${compact ? 'py-3' : 'py-4'} border-b border-gray-100`}>
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <h3 className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-gray-900 flex-shrink-0`}>
          💬 {SECTION_TITLE[targetType]}
          {loaded && stats.count > 0 && (
            <span className="ml-2 text-amber-600 font-mono text-xs">
              ★ {stats.avg?.toFixed(1)}
              <span className="text-gray-500 ml-1">({stats.count})</span>
            </span>
          )}
          {photos.length > 0 && (
            <span className="ml-2 text-gray-500 text-xs">📷 {photos.length}</span>
          )}
        </h3>
        {!editing && (
          <button onClick={onClickWrite}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition flex-shrink-0 ${
              myReview
                ? 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50'
                : 'border-amber-400 bg-amber-400 text-white hover:bg-amber-500'
            }`}>
            {myReview ? '✏️ 수정' : '✏️ 후기 쓰기'}
          </button>
        )}
      </div>

      {/* 사진 갤러리 — 후기 폼 외부, 후기 카드들 위 */}
      {photos.length > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-1">
          {photos.slice(0, 8).map((p, i) => (
            <button key={p.id} type="button"
              onClick={() => setLightboxIndex(i)}
              className="relative aspect-square overflow-hidden rounded bg-gray-100 hover:opacity-90 transition group">
              <img src={p.public_url} alt={p.caption ?? ''}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              {/* 본인 사진이면 ✕ 삭제 (호버) */}
              {user && p.user_id === user.id && (
                <span
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm('이 사진을 삭제할까요?')) {
                      await removePhoto(p.id);
                    }
                  }}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  aria-label="삭제">×</span>
              )}
            </button>
          ))}
          {photos.length > 8 && (
            <button type="button" onClick={() => setLightboxIndex(8)}
              className="aspect-square rounded bg-gray-200 hover:bg-gray-300 transition flex items-center justify-center text-xs font-semibold text-gray-700">
              +{photos.length - 8}
            </button>
          )}
        </div>
      )}

      {/* 라이트박스 */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      )}

      {/* 작성/수정 폼 */}
      {editing && (
        <form onSubmit={onSubmit} className="mt-2 p-3 rounded-md bg-amber-50/50 border border-amber-200 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-600 mr-1">평점:</span>
            <RatingInput value={rating} onChange={setRating} />
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={`${targetName ?? TYPE_LABEL[targetType]}에 대한 짧은 후기 (선택)`}
            maxLength={500}
            rows={3}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand resize-none"
          />
          {/* 사진 첨부 */}
          <PhotoUpload
            targetType={targetType}
            targetId={targetId}
            reviewId={myReview?.id ?? null}
            compact
          />
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>{body.length}/500</span>
            <div className="flex gap-1.5">
              {myReview && (
                <button type="button" onClick={onDelete} disabled={busy}
                  className="text-red-500 hover:text-red-700 px-2">
                  삭제
                </button>
              )}
              <button type="button" onClick={() => setEditing(false)} disabled={busy}
                className="text-gray-500 hover:text-gray-700 px-2">
                취소
              </button>
              <button type="submit" disabled={busy || rating < 1}
                className="px-3 py-1 bg-amber-500 text-white rounded font-semibold hover:bg-amber-600 disabled:opacity-50">
                {busy ? '저장 중...' : myReview ? '수정 저장' : '후기 등록'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 본인 후기 (편집 모드 아닐 때만) */}
      {!editing && myReview && (
        <div className="mb-2 p-2.5 rounded-md bg-amber-50 border border-amber-200">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-amber-800 font-semibold">내 후기</span>
              <Stars rating={myReview.rating} />
            </div>
            <span className="text-[10px] text-gray-500">{myReview.updated_at.slice(0, 10)}</span>
          </div>
          {myReview.body && (
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{myReview.body}</p>
          )}
        </div>
      )}

      {/* 다른 사용자 후기 */}
      {others.length > 0 && (
        <ul className="space-y-1.5 mt-2">
          {others.slice(0, compact ? 3 : 5).map(r => (
            <li key={r.id} className="p-2 rounded bg-white border border-gray-100">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[11px] font-semibold text-gray-700 truncate">
                  {r.author_name || '익명'}
                </span>
                <Stars rating={r.rating} />
                <span className="text-[10px] text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
              </div>
              {r.body && (
                <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-line">{r.body}</p>
              )}
            </li>
          ))}
          {others.length > (compact ? 3 : 5) && (
            <li className="text-[10px] text-gray-400 text-center py-1">
              + 후기 {others.length - (compact ? 3 : 5)}개 더
            </li>
          )}
        </ul>
      )}

      {/* 후기가 하나도 없을 때 */}
      {loaded && reviews.length === 0 && !editing && (
        <p className="text-[11px] text-gray-400 italic mt-1">
          첫 후기를 남겨주세요.
        </p>
      )}
    </section>
  );
}

// ── 별점 입력 (인터랙티브)
function RatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  return (
    <div className="flex gap-0.5 select-none">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          className={`text-xl leading-none transition ${
            n <= display ? 'text-amber-500' : 'text-gray-300'
          } hover:scale-110`}
          aria-label={`${n}점`}>
          ★
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-xs text-amber-700 font-semibold self-center">{value}점</span>
      )}
    </div>
  );
}

// ── 별점 표시 (read-only)
function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-xs">
      {'★'.repeat(rating)}
      <span className="text-gray-300">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}
