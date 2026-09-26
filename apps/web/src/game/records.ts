// ───────── 커리어 하이(CH) 배지 · 다음 마일스톤 진행도 (T-10-002) ─────────
// 이 파일의 함수는 전부 순수 함수다 — game/rng.ts의 시드 RNG(rnd/ri/pick/gauss/poisson)를 절대
// 호출하지 않는다. 오직 이미 계산된 GameState/CareerRecord만 읽어 파생 데이터를 만들기 때문에,
// 메인 시뮬레이션 RNG 소비 순서에 영향을 줄 수 없다(결정성 유지 조건).
import type { Pos } from './data.js';
import type { CareerRecord, GameState } from './types.js';

export type ChKey = 'goals' | 'assists' | 'apps' | 'rating' | 'cs';

const CH_LABEL: Record<ChKey, string> = { goals: '커리어 최다골', assists: '커리어 최다도움', apps: '커리어 최다출전', rating: '커리어 최고평점', cs: '커리어 최다무실점' };
export function chLabel(k: string): string {
  return CH_LABEL[k as ChKey] ?? k;
}

/** 방금 push된 rec(=s.career의 마지막 원소)을 제외한 이전 시즌들 중 각 지표의 최고값을 구해, rec이
 * 그 값을 경신했는지 본다. 최초 시즌(이전 기록이 0개)은 비교 대상이 없으므로 CH로 치지 않는다(항상
 * "경신"이 되어 의미가 없어지는 것을 막는다).
 * T-10-034: `r !== rec` 같은 객체 동일성으로 거르면 안 된다 — 앱에서는 s가 Svelte $state 프록시라
 * push된 원소가 rec과 다른 객체가 되어 rec 자신이 '이전 시즌'에 남고, CH가 영영 잡히지 않았다. */
export function detectCareerHighs(s: GameState, rec: CareerRecord): ChKey[] {
  const prior = s.career.slice(0, -1);
  if (!prior.length) return [];
  const out: ChKey[] = [];
  const maxOf = (f: (r: CareerRecord) => number) => Math.max(...prior.map(f));
  if (rec.goals > 0 && rec.goals > maxOf((r) => r.goals)) out.push('goals');
  if (rec.assists > 0 && rec.assists > maxOf((r) => r.assists)) out.push('assists');
  if (rec.apps > 0 && rec.apps > maxOf((r) => r.apps)) out.push('apps');
  if (rec.rating > 0 && rec.rating > maxOf((r) => r.rating)) out.push('rating');
  if ((s.pos === 'GK' || s.pos === 'DF') && rec.cs > 0 && rec.cs > maxOf((r) => r.cs || 0)) out.push('cs');
  return out;
}

// ───────── 다음 마일스톤(통산 목표) ─────────
export interface NextMilestone {
  key: string;
  label: string;
  have: number;
  target: number;
  remaining: number;
}
interface Threshold { key: string; label: (n: number) => string; get: (t: { p: number; g: number; a: number; caps: number; trophies: number }) => number; targets: number[] }

const THRESHOLDS_BY_POS: Record<Pos, Threshold[]> = (() => {
  const common: Threshold[] = [
    { key: 'apps', label: (n) => `통산 ${n}경기 출전`, get: (t) => t.p, targets: [100, 200, 300, 400, 500, 600, 700] },
    { key: 'caps', label: (n) => `A매치 ${n}경기 출전`, get: (t) => t.caps, targets: [10, 30, 50, 100] },
    { key: 'trophy', label: (n) => `우승 트로피 ${n}회`, get: (t) => t.trophies, targets: [1, 3, 5, 10] },
  ];
  const goals: Threshold = { key: 'goals', label: (n) => `통산 ${n}골`, get: (t) => t.g, targets: [10, 30, 50, 100, 150, 200, 300] };
  const assists: Threshold = { key: 'assists', label: (n) => `통산 ${n}도움`, get: (t) => t.a, targets: [10, 30, 50, 100, 150] };
  return {
    FW: [goals, assists, ...common],
    MF: [assists, goals, ...common],
    DF: [assists, goals, ...common],
    GK: [...common, goals, assists],
  };
})();

/** 포지션에 맞는 지표 순서로, 아직 못 채운 목표 중 가장 가까운 3~4개를 반환한다(각 지표당 하나씩,
 * 다음 미달성 구간만). RNG 없음 — 저장된 통산 합계만 읽는다. */
export function nextMilestones(s: GameState, max = 4): NextMilestone[] {
  const t = s.career.reduce(
    (a, r) => ({ p: a.p + r.apps, g: a.g + r.goals, a: a.a + r.assists, caps: s.nat.caps, trophies: s.trophies.length }),
    { p: 0, g: 0, a: 0, caps: s.nat.caps, trophies: s.trophies.length },
  );
  const out: NextMilestone[] = [];
  for (const th of THRESHOLDS_BY_POS[s.pos] ?? []) {
    const have = th.get(t);
    const next = th.targets.find((n) => n > have);
    if (next == null) continue;
    out.push({ key: th.key, label: th.label(next), have, target: next, remaining: next - have });
  }
  // 남은 목표가 작은(가까운) 순서로 최대 max개
  return out.sort((x, y) => x.remaining / x.target - y.remaining / y.target).slice(0, max);
}
