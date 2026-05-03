'use client';

interface Props {
  progress: number;     // 0~1
  steps: { label: string; done: boolean }[];
}

/**
 * 첫 진입 시 데이터 로딩 화면.
 * mountains.length === 0 인 동안만 표시.
 */
export default function LoadingScreen({ progress, steps }: Props) {
  const pct = Math.round(progress * 100);
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-brand to-brand-dark text-white">
      <div className="text-center max-w-sm w-full px-6">
        <div className="text-5xl mb-4 select-none">⛰</div>
        <h1 className="text-xl font-bold mb-1">日本百名山</h1>
        <p className="text-xs opacity-80 mb-6">일본 100대 명산 지도</p>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-white transition-all duration-300 ease-out"
               style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[11px] opacity-75 mb-6 font-mono">{pct}%</div>

        {/* Steps */}
        <ul className="text-[11px] space-y-1 text-left max-w-[220px] mx-auto">
          {steps.map((s, i) => (
            <li key={i} className={`flex items-center gap-2 transition-opacity ${s.done ? 'opacity-100' : 'opacity-40'}`}>
              <span className="flex-shrink-0 w-3 inline-block">{s.done ? '✓' : '·'}</span>
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
