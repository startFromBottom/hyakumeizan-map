'use client';

import { useEffect } from 'react';

interface Photo {
  id: number | string;
  public_url: string;
  caption?: string | null;
  author_name?: string | null;
}

interface Props {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}

export default function Lightbox({ photos, index, onClose, onIndex }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
      else if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onClose, onIndex]);

  if (photos.length === 0) return null;
  const cur = photos[Math.min(index, photos.length - 1)];

  return (
    <div className="fixed inset-0 z-[3000] bg-black/90 flex items-center justify-center"
         onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-3 right-3 text-white/80 hover:text-white text-3xl w-10 h-10 flex items-center justify-center"
        aria-label="닫기">×</button>

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + photos.length) % photos.length); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl w-12 h-12 flex items-center justify-center"
            aria-label="이전">‹</button>
          <button
            onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % photos.length); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl w-12 h-12 flex items-center justify-center"
            aria-label="다음">›</button>
        </>
      )}

      <img
        src={cur.public_url}
        alt={cur.caption ?? ''}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[92vw] max-h-[90vh] object-contain rounded shadow-2xl"
      />

      {(cur.caption || cur.author_name) && (
        <div className="absolute bottom-3 inset-x-0 text-center text-white text-xs px-4">
          {cur.author_name && <span className="text-white/70 mr-2">— {cur.author_name}</span>}
          {cur.caption && <span className="text-white/95">{cur.caption}</span>}
          {photos.length > 1 && (
            <span className="text-white/50 ml-3 font-mono">{index + 1}/{photos.length}</span>
          )}
        </div>
      )}
    </div>
  );
}
