'use client';

import { useState, useRef } from 'react';
import { processImage } from '@/lib/imageProcess';
import { usePhotos } from '@/lib/usePhotos';
import type { ReviewTargetType } from '@/lib/useReviews';

interface Props {
  targetType: ReviewTargetType;
  targetId: string;
  reviewId?: number | null;
  onUploaded?: () => void;
  compact?: boolean;
}

const MAX_PER_TARGET = 6;
const MAX_FILE_BYTES = 15 * 1024 * 1024;   // 15MB 원본 한도

export default function PhotoUpload({ targetType, targetId, reviewId, onUploaded, compact }: Props) {
  const { photos, upload } = usePhotos(targetType, targetId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const myPhotos = photos.filter(p => p.user_id);   // 본인 여부는 RLS+author로 별도 판정 필요
                                                     // 단순화: 본인 업로드 = 가장 최근 본인 user_id
  // 실제로는 useAuth 가져와도 되지만 단순화: 카운트만 알면 됨
  const remaining = MAX_PER_TARGET - photos.length;
  const canUpload = remaining > 0;

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';   // 같은 파일 다시 선택 가능
    if (files.length === 0) return;
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    setError(null);
    if (!canUpload) {
      setError(`이 항목엔 사진 ${MAX_PER_TARGET}장까지 올라갈 수 있어요.`);
      return;
    }
    const slots = Math.min(remaining, files.length);
    if (slots < files.length) {
      setError(`최대 ${slots}장만 업로드돼요 (남은 슬롯: ${remaining})`);
    }
    setBusy(true);
    setProgress({ done: 0, total: slots });
    let uploaded = 0;
    for (let i = 0; i < slots; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) {
        setError(`이미지가 아닌 파일 무시: ${f.name}`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setError(`너무 큰 파일 무시 (15MB 초과): ${f.name}`);
        continue;
      }
      try {
        const proc = await processImage(f);
        const r = await upload({
          file: proc.blob,
          ext: proc.ext,
          width: proc.width,
          height: proc.height,
          mimeType: proc.mimeType,
          taken_at: proc.taken_at,
          geo: proc.geo,
          reviewId: reviewId ?? null,
        });
        if (!r.ok) {
          setError(r.error ?? '업로드 실패');
        } else {
          uploaded++;
        }
      } catch (e: any) {
        setError(e?.message ?? '처리 실패');
      }
      setProgress({ done: i + 1, total: slots });
    }
    setBusy(false);
    setProgress(null);
    if (uploaded > 0) onUploaded?.();
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={onPick}
        disabled={busy || !canUpload}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || !canUpload}
        className={`${compact ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'} rounded-md border font-semibold transition disabled:opacity-50 ${
          canUpload
            ? 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50'
            : 'border-gray-200 bg-gray-100 text-gray-400'
        }`}>
        {busy
          ? `📤 ${progress ? `${progress.done}/${progress.total}` : '업로드 중...'}`
          : canUpload
            ? `📷 사진 추가 ${photos.length > 0 ? `(${photos.length}/${MAX_PER_TARGET})` : ''}`
            : `📷 사진 ${MAX_PER_TARGET}장 모두 차있음`}
      </button>
      {error && (
        <div className="mt-1 text-[10px] text-red-600">⚠ {error}</div>
      )}
    </div>
  );
}
