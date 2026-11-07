// T-11-669 실험군 화면(웹 RetireExp.svelte · 앱 RetireExp.tsx)이 그리는 글. 실험군일 때만 불러오는 청크에 둔다.
// 숫자는 저장된 시즌 기록 그대로이고, 원인 · 감정을 덧붙이지 않는다.
import { tn } from '@offside/game/i18n/names';
import type {
  RetireCta,
  RetireNextKind,
  RetireScene,
  RetireSceneKind,
} from './retireExperiment.js';
import { retireExpText as L } from './i18n/ko/retireExp.js';

export type RetireSceneView = {
  kind: RetireSceneKind;
  title: string;
  when: string;
  stats: string;
  rating: string | null;
  detail: string;
  honors: string | null;
};

const TITLE: Record<RetireSceneKind, () => string> = {
  first_apps: () => L.firstApps,
  peak_rating: () => L.peakRating,
  last_apps: () => L.lastApps,
};

export function retireSceneView(s: RetireScene, pos: string): RetireSceneView {
  const r = s.rec;
  const back = pos === 'GK' || pos === 'DF';
  const league = tn(r.league);
  return {
    kind: s.kind,
    title: TITLE[s.kind](),
    when: L.when({ year: r.year, age: r.age, club: tn(r.club) }),
    stats: back
      ? L.statsBack({ apps: r.apps, goals: r.goals, cs: r.cs })
      : L.stats({ apps: r.apps, goals: r.goals, assists: r.assists }),
    rating: r.rating > 0 ? L.rating({ rating: r.rating.toFixed(2) }) : null,
    detail:
      typeof r.rank === 'number' && Number.isFinite(r.rank) && r.rank > 0
        ? L.leagueRank({ league, rank: r.rank, ovr: r.ovr })
        : L.league({ league, ovr: r.ovr }),
    honors: r.honors?.length ? L.honors({ list: r.honors.map(tn).join(' · ') }) : null,
  };
}

const NEXT: Record<RetireNextKind, () => string> = {
  team: () => L.nextTeam,
  login: () => L.nextLogin,
  club: () => L.nextClub,
  wait: () => L.nextWait,
  blocked: () => L.nextBlocked,
};
export const retireNextText = (k: RetireNextKind): string => NEXT[k]();

const CTA: Record<RetireCta, () => string> = {
  team: () => L.ctaTeam,
  login: () => L.ctaLogin,
  club: () => L.ctaClub,
};
export const retireCtaLabel = (c: RetireCta): string => CTA[c]();
