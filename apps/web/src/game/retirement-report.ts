// ───────── 은퇴 리포트: 전성기·베스트 시즌·개인 기록·연도별 타임라인 (T-10-002) ─────────
// 순수 함수만 있다 — s.career(이미 기록된 시즌들)만 읽고 RNG를 전혀 쓰지 않는다.
import type { CareerRecord, GameState } from './types.js';

export interface PersonalBest {
  key: string;
  label: string;
  value: number;
  year: number;
  age: number;
}
/** 시즌별 스탯 중 개인 최고 기록(연도/나이 포함)을 뽑는다. */
export function personalBests(s: GameState): PersonalBest[] {
  const rows = s.career;
  if (!rows.length) return [];
  const pick = (key: string, label: string, f: (r: CareerRecord) => number): PersonalBest | null => {
    const best = rows.reduce((a, r) => (f(r) > f(a) ? r : a), rows[0]!);
    const v = f(best);
    return v > 0 ? { key, label, value: v, year: best.year, age: best.age } : null;
  };
  const out = [
    pick('goals', '한 시즌 최다골', (r) => r.goals),
    pick('assists', '한 시즌 최다도움', (r) => r.assists),
    pick('apps', '한 시즌 최다출전', (r) => r.apps),
    pick('rating', '한 시즌 최고평점', (r) => r.rating),
    (s.pos === 'GK' || s.pos === 'DF') ? pick('cs', '한 시즌 최다무실점', (r) => r.cs || 0) : null,
    pick('ovr', '커리어 최고 OVR', (r) => r.ovr),
  ].filter((x): x is PersonalBest => !!x);
  return out;
}

/** 3시즌 연속 구간 중 (골+도움*0.8+평점*apps*0.3)이 가장 높은 구간을 "전성기"로 본다. 시즌이
 * 3개 미만이면 있는 만큼만 반환한다. */
// 시즌 기여도(전성기·베스트 시즌 선정 공통 기준).
const score = (r: CareerRecord) => r.goals + r.assists * 0.8 + r.rating * r.apps * 0.3;

export function primeSeasons(s: GameState, windowSize = 3): CareerRecord[] {
  const rows = s.career;
  if (rows.length <= windowSize) return rows.slice();
  let bestStart = 0, bestSum = -Infinity;
  for (let i = 0; i <= rows.length - windowSize; i++) {
    let sum = 0;
    for (let j = i; j < i + windowSize; j++) sum += score(rows[j]!);
    if (sum > bestSum) { bestSum = sum; bestStart = i; }
  }
  return rows.slice(bestStart, bestStart + windowSize);
}

/** 베스트 3시즌(반드시 연속일 필요는 없음): 위 score 기준 상위 3개, 연대순 정렬해 반환. */
export function bestSeasons(s: GameState, n = 3): CareerRecord[] {
  const rows = s.career;
  return rows.slice().sort((a, b) => score(b) - score(a)).slice(0, n).sort((a, b) => a.year - b.year);
}

export interface TimelineRow {
  year: number;
  age: number;
  club: string;
  summary: string;
  ch: string[];
}
export function careerTimeline(s: GameState): TimelineRow[] {
  return s.career.map((r) => ({
    year: r.year,
    age: r.age,
    club: r.club,
    summary: `${r.league} · ${r.apps}경기 ${r.goals}골 ${r.assists}도움${r.honors.length ? ` · ${r.honors.join(', ')}` : ''}`,
    ch: r.ch || [],
  }));
}
