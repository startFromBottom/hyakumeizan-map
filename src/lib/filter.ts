// 필터·검색 로직 — 순수 함수로 분리. 앱에서도 그대로 사용 가능.

import type { Mountain, Region } from './types';

export interface FilterState {
  query: string;
  regions: Set<Region>;
  elevMin: number;
  elevMax: number;
  difficultyStars: Set<number>; // 1~5
}

export const DEFAULT_FILTER: FilterState = {
  query: '',
  regions: new Set(),
  elevMin: 800,
  elevMax: 3800,
  difficultyStars: new Set(),
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export function matches(m: Mountain, f: FilterState): boolean {
  // 이름 검색: 한국어/일본어/한자/yomi/영어
  if (f.query.trim()) {
    const q = norm(f.query);
    const fields = [m.name_ko, m.name_ja, m.name_ja_kanji, m.yomi, m.name_en, m.prefectures_ko, m.prefectures_ja].filter(Boolean) as string[];
    if (!fields.some(x => norm(x).includes(q))) return false;
  }
  // 지역
  if (f.regions.size > 0) {
    if (!m.regions.some(r => f.regions.has(r))) return false;
  }
  // 표고
  if (m.elevation_m < f.elevMin || m.elevation_m > f.elevMax) return false;
  // 난이도
  if (f.difficultyStars.size > 0) {
    const stars = m.routes?.[0]?.difficulty_stars;
    if (!stars || !f.difficultyStars.has(stars)) return false;
  }
  return true;
}

export const ALL_REGIONS: Region[] = ['홋카이도','도호쿠','간토','주부','간사이','주고쿠','시코쿠','규슈'];
