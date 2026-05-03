'use client';

import type { Mountain } from '@/lib/types';
import { ALL_REGIONS, DEFAULT_FILTER, FilterState } from '@/lib/filter';
import { useFavorites } from '@/lib/useFavorites';
import { useCheckins } from '@/lib/useCheckins';

export type SortKey =
  | 'no'              // 후카다 원작 1~100 순서 (북→남)
  | 'name_ko'
  | 'elev_desc' | 'elev_asc'
  | 'difficulty_desc' | 'difficulty_asc'
  | 'distance_desc' | 'distance_asc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'no',              label: '번호순 (1~100, 북→남)' },
  { value: 'name_ko',         label: '이름순 (한국어)' },
  { value: 'elev_desc',       label: '해발고도 ↓ (높은 순)' },
  { value: 'elev_asc',        label: '해발고도 ↑ (낮은 순)' },
  { value: 'difficulty_desc', label: '난이도 ↓ (어려운 순)' },
  { value: 'difficulty_asc',  label: '난이도 ↑ (쉬운 순)' },
  { value: 'distance_desc',   label: '코스 거리 ↓ (긴 순)' },
  { value: 'distance_asc',    label: '코스 거리 ↑ (짧은 순)' },
];

interface Props {
  mountains: Mountain[];
  filter: FilterState;
  setFilter: (next: FilterState) => void;
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  selectedNo: number | null;
  onSelect: (no: number) => void;
  totalCount: number;
}

function Stars({ n }: { n?: number | null }) {
  if (!n) return <span className="text-gray-400 text-xs">—</span>;
  return <span className="text-amber-500">{'★'.repeat(n)}<span className="text-gray-300">{'★'.repeat(5 - n)}</span></span>;
}

export default function Sidebar({ mountains, filter, setFilter, sortKey, setSortKey, selectedNo, onSelect, totalCount }: Props) {
  const fav = useFavorites();
  const ci = useCheckins();
  const toggleRegion = (r: any) => {
    const next = new Set(filter.regions);
    if (next.has(r)) next.delete(r); else next.add(r);
    setFilter({ ...filter, regions: next });
  };
  const toggleStar = (s: number) => {
    const next = new Set(filter.difficultyStars);
    if (next.has(s)) next.delete(s); else next.add(s);
    setFilter({ ...filter, difficultyStars: next });
  };

  return (
    <aside className="w-[360px] flex-shrink-0 h-full bg-white border-r border-gray-200 flex flex-col shadow-sm">
      <header className="px-4 py-3 border-b border-gray-200">
        <h1 className="text-lg font-bold text-brand-dark leading-tight">日本百名山</h1>
        <p className="text-xs text-gray-500 mt-0.5">일본 100대 명산 · 등산 코스 지도</p>
      </header>

      <div className="px-4 py-3 border-b border-gray-200 space-y-3 bg-gray-50">
        {/* 활성 필터 카운트 + 리셋 */}
        {(() => {
          const activeCount =
            (filter.query.trim() ? 1 : 0) +
            filter.regions.size +
            ((filter.elevMin !== DEFAULT_FILTER.elevMin || filter.elevMax !== DEFAULT_FILTER.elevMax) ? 1 : 0) +
            filter.difficultyStars.size;
          if (activeCount === 0) return null;
          return (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-brand-dark font-semibold">
                필터 {activeCount}개 활성
              </span>
              <button
                onClick={() => setFilter({ ...DEFAULT_FILTER, regions: new Set(), difficultyStars: new Set() })}
                className="px-2 py-0.5 rounded bg-white border border-gray-300 text-gray-700 hover:border-brand hover:text-brand font-medium"
              >
                ↻ 모두 초기화
              </button>
            </div>
          );
        })()}

        <div className="relative">
          <input
            type="text"
            value={filter.query}
            onChange={e => setFilter({ ...filter, query: e.target.value })}
            placeholder="이름·지역 검색 (한/일/한자/yomi)"
            className="w-full px-3 py-2 pr-8 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {filter.query && (
            <button
              onClick={() => setFilter({ ...filter, query: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-lg leading-none"
              aria-label="검색어 지우기"
            >
              ×
            </button>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-700 mb-1">지역</div>
          <div className="flex flex-wrap gap-1">
            {ALL_REGIONS.map(r => {
              const on = filter.regions.has(r);
              return (
                <button key={r} onClick={() => toggleRegion(r)}
                  className={`px-2 py-1 text-xs rounded border transition ${on ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-300 hover:border-brand'}`}>
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-700 mb-1.5 flex justify-between items-baseline">
            <span>표고 범위</span>
            <span className="text-brand font-mono font-semibold">
              {filter.elevMin.toLocaleString()} – {filter.elevMax.toLocaleString()} m
            </span>
          </div>
          <div className="space-y-2">
            <label className="block">
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>최소</span>
                <span className="font-mono">{filter.elevMin.toLocaleString()} m</span>
              </div>
              <input type="range" min={800} max={3800} step={50} value={filter.elevMin}
                onChange={e => setFilter({ ...filter, elevMin: Math.min(Number(e.target.value), filter.elevMax - 100) })}
                className="w-full accent-brand" />
            </label>
            <label className="block">
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>최대</span>
                <span className="font-mono">{filter.elevMax.toLocaleString()} m</span>
              </div>
              <input type="range" min={800} max={3800} step={50} value={filter.elevMax}
                onChange={e => setFilter({ ...filter, elevMax: Math.max(Number(e.target.value), filter.elevMin + 100) })}
                className="w-full accent-brand" />
            </label>
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-0.5 px-0.5 font-mono">
            <span>800m</span>
            <span>3,800m</span>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-700 mb-1">난이도</div>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(s => {
              const on = filter.difficultyStars.has(s);
              return (
                <button key={s} onClick={() => toggleStar(s)}
                  className={`px-2 py-1 text-xs rounded border transition ${on ? `diff-${s} text-white border-transparent` : 'bg-white text-gray-700 border-gray-300 hover:border-brand'}`}>
                  {'★'.repeat(s)}
                </button>
              );
            })}
          </div>
        </div>

        {/* 정렬 */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-1">정렬</div>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-gray-500 pt-1">
          {mountains.length} / {totalCount}개 표시
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <ul>
          {mountains.map(m => {
            const r = m.routes?.find(x => x.is_primary) ?? m.routes?.[0];
            const sel = m.no === selectedNo;
            return (
              <li key={m.no}>
                <button onClick={() => onSelect(m.no)}
                  className={`w-full text-left px-4 py-2.5 border-b border-gray-100 hover:bg-brand-light transition ${sel ? 'bg-brand-light' : ''}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        <span className="text-gray-400 mr-1.5">#{m.no}</span>
                        {m.name_ko}
                        {fav.isFav(m.no) && <span className="ml-1 text-amber-500">⭐</span>}
                        {ci.isClimbed(m.no) && <span className="ml-1 text-emerald-600">✓</span>}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{m.name_ja} · {m.prefectures_ko}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-mono text-gray-700">{m.elevation_m.toLocaleString()}m</div>
                      <div className="text-xs"><Stars n={r?.difficulty_stars} /></div>
                    </div>
                  </div>
                  {r && (
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {r.distance_km}km · 상승 {r.ascent_m}m
                      {m.routes && m.routes.length > 1 && (
                        <span className="text-brand ml-1.5">· {m.routes.length}코스</span>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
          {mountains.length === 0 && (
            <li className="px-6 py-10 text-center">
              <div className="text-sm text-gray-700 font-semibold mb-1">조건에 맞는 산이 없어요</div>
              <div className="text-xs text-gray-500 mb-3">필터를 너무 좁게 잡았을 수 있어요.<br/>예: 표고 범위가 일본 100명산 분포와 안 맞을 때</div>
              <button
                onClick={() => setFilter({ ...DEFAULT_FILTER, regions: new Set(), difficultyStars: new Set() })}
                className="px-3 py-1.5 rounded bg-brand text-white text-xs font-semibold hover:bg-brand-dark"
              >
                ↻ 필터 모두 초기화
              </button>
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}
