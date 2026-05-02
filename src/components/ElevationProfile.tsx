'use client';

import { useMemo, useRef, useState } from 'react';
import type { RouteProfile } from '@/lib/types';

interface Props {
  profile?: RouteProfile;
  height?: number;
}

function pickStep(range: number): number {
  const candidates = [50, 100, 200, 250, 500, 1000, 2000];
  for (const s of candidates) {
    if (range / s <= 6) return s;
  }
  return 2000;
}

// 기울기(grade)에 따라 색상 — 녹색(완만) → 노랑 → 주황 → 빨강(가파름)
function gradeColor(grade: number): string {
  // grade는 라디안에 해당하는 dy/dx (0~0.5 이상)
  const abs = Math.abs(grade);
  if (abs < 0.10) return '#1f7a3e';   // 녹색 — 평지~10%
  if (abs < 0.20) return '#75a32a';   // 연두 — 10~20%
  if (abs < 0.30) return '#d4a017';   // 노랑 — 20~30%
  if (abs < 0.45) return '#dd7a1a';   // 주황 — 30~45%
  return '#c53030';                   // 빨강 — 45% 이상
}

export default function ElevationProfile({ profile, height = 140 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null);

  const data = useMemo(() => {
    if (!profile || profile.distance_m.length < 2) return null;
    const dMax = profile.distance_m[profile.distance_m.length - 1];
    const eMin = Math.min(...profile.elevation_m);
    const eMax = Math.max(...profile.elevation_m);
    const step = pickStep(Math.max(50, eMax - eMin));
    const yMin = Math.floor(eMin / step) * step;
    const yMax = Math.ceil(eMax / step) * step;
    const yRange = Math.max(step, yMax - yMin);
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax; v += step) ticks.push(v);
    // 누적 상승고도
    let cumAsc = 0;
    const cumAscArr = [0];
    for (let i = 1; i < profile.elevation_m.length; i++) {
      const d = profile.elevation_m[i] - profile.elevation_m[i - 1];
      if (d > 0) cumAsc += d;
      cumAscArr.push(cumAsc);
    }
    return { dMax, eMin, eMax, yMin, yMax, yRange, ticks, step, cumAsc, cumAscArr };
  }, [profile]);

  const segments = useMemo(() => {
    if (!profile || !data) return null;
    const W = 100, H = 100;
    const pts = profile.distance_m.map((d, i) => {
      const x = (d / data.dMax) * W;
      const y = H - ((profile.elevation_m[i] - data.yMin) / data.yRange) * H;
      return [x, y] as const;
    });
    // 세그먼트별 색상 계산 — 실거리 기준 grade
    const segs: Array<{ d: string; color: string }> = [];
    for (let i = 1; i < pts.length; i++) {
      const dx_m = profile.distance_m[i] - profile.distance_m[i - 1];
      const dy_m = profile.elevation_m[i] - profile.elevation_m[i - 1];
      const grade = dx_m > 0 ? dy_m / dx_m : 0;
      const color = gradeColor(grade);
      segs.push({
        d: `M ${pts[i - 1][0].toFixed(2)} ${pts[i - 1][1].toFixed(2)} L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`,
        color,
      });
    }
    const fill = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ` L ${W} ${H} L 0 ${H} Z`;
    return { segs, fill, pts };
  }, [profile, data]);

  if (!profile || !data || !segments) {
    return <div className="text-xs text-gray-400 italic">표고 프로필 데이터 없음</div>;
  }

  const Y_AXIS_W = 36;
  const X_AXIS_H = 16;

  // 마우스 위치에서 가장 가까운 점 찾기
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, xPx / rect.width));
    const dTarget = ratio * data.dMax;
    // 이진탐색
    let lo = 0, hi = profile.distance_m.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (profile.distance_m[mid] < dTarget) lo = mid + 1;
      else hi = mid;
    }
    const idx = lo;
    const x = (profile.distance_m[idx] / data.dMax) * 100;
    const y = 100 - ((profile.elevation_m[idx] - data.yMin) / data.yRange) * 100;
    setHover({ x, y, idx });
  };

  return (
    <div className="relative" style={{ height: height + X_AXIS_H, paddingLeft: Y_AXIS_W }}>
      <div className="absolute left-0 top-0" style={{ height: height, width: Y_AXIS_W }}>
        {data.ticks.map((v, i) => {
          const ratio = (v - data.yMin) / data.yRange;
          const top = (1 - ratio) * 100;
          return (
            <div key={i} className="absolute right-1 text-[10px] text-gray-500 font-mono"
              style={{ top: `${top}%`, transform: 'translateY(-50%)' }}>
              {v}m
            </div>
          );
        })}
      </div>

      <div
        ref={containerRef}
        className="relative cursor-crosshair"
        style={{ height }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* 그리드 */}
        <div className="absolute inset-0 pointer-events-none">
          {data.ticks.map((v, i) => {
            const ratio = (v - data.yMin) / data.yRange;
            const top = (1 - ratio) * 100;
            const isEdge = i === 0 || i === data.ticks.length - 1;
            return (
              <div key={i} className="absolute left-0 right-0 border-t"
                style={{ top: `${top}%`,
                  borderColor: isEdge ? '#d1d5db' : '#e5e7eb',
                  borderTopStyle: isEdge ? 'solid' : 'dashed' }} />
            );
          })}
        </div>

        {/* SVG 곡선 */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full block pointer-events-none">
          <defs>
            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f6f43" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#1f6f43" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {/* 면 (단색) */}
          <path d={segments.fill} fill="url(#elevFill)" />
          {/* 라인 (세그먼트별 색상) */}
          {segments.segs.map((s, i) => (
            <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          ))}
          {/* hover 인디케이터 */}
          {hover && (
            <>
              <line x1={hover.x} y1={0} x2={hover.x} y2={100} stroke="#999" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
              <circle cx={hover.x} cy={hover.y} r="2" fill="#d32f2f" stroke="white" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>

        {/* 툴팁 */}
        {hover && (
          <div
            className="absolute pointer-events-none bg-white shadow-lg border border-gray-200 rounded-md px-2 py-1 text-[11px] font-mono z-10 whitespace-nowrap"
            style={{
              left: `min(calc(${hover.x}% + 8px), calc(100% - 130px))`,
              top: `max(${hover.y}% - 50px, 0px)`,
            }}
          >
            <div className="text-gray-600">{(profile.distance_m[hover.idx] / 1000).toFixed(2)} km</div>
            <div className="font-semibold text-gray-900">{Math.round(profile.elevation_m[hover.idx])} m</div>
            <div className="text-[10px] text-gray-500">상승 +{Math.round(data.cumAscArr[hover.idx])}m</div>
          </div>
        )}
      </div>

      <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
        <span>0 km</span>
        <span className="text-gray-400 font-sans">
          {Math.round(data.eMin)}m → {Math.round(data.eMax)}m · 누적 +{Math.round(data.cumAsc)}m
        </span>
        <span>{(data.dMax / 1000).toFixed(1)} km</span>
      </div>

      {/* 기울기 범례 (작게) */}
      <div className="flex justify-center gap-3 text-[9px] text-gray-500 mt-1">
        <span><span className="inline-block w-2 h-2 rounded-full mr-0.5" style={{ background: '#1f7a3e' }} />~10%</span>
        <span><span className="inline-block w-2 h-2 rounded-full mr-0.5" style={{ background: '#75a32a' }} />~20%</span>
        <span><span className="inline-block w-2 h-2 rounded-full mr-0.5" style={{ background: '#d4a017' }} />~30%</span>
        <span><span className="inline-block w-2 h-2 rounded-full mr-0.5" style={{ background: '#dd7a1a' }} />~45%</span>
        <span><span className="inline-block w-2 h-2 rounded-full mr-0.5" style={{ background: '#c53030' }} />45%+</span>
      </div>
    </div>
  );
}
