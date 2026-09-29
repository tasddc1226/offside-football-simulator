// T-10-092 팀 히스토리 배지(원작 클럽하우스의 '팀 히스토리'). 팀 행에 쌓아 둔 전적·연승·골 차와 시즌 최종 순위로 판정하는
// 순수 함수다 — 배지 테이블 없이 읽을 때마다 센다. 얻은 배지만 돌려준다(얻는 순서대로).
import type { TeamBadge } from '@offside/contracts';

export type BadgeTeam = {
  filled: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  bestStreak: number;
  bestMargin: number;
  likes: number;
};

type Rule = TeamBadge & { ok: (t: BadgeTeam) => boolean };

const RULES: Rule[] = [
  {
    id: 'debut',
    label: '데뷔전',
    desc: '첫 경기를 치렀다',
    ok: (t) => t.wins + t.draws + t.losses > 0,
  },
  { id: 'first-win', label: '첫 승', desc: '첫 승리를 거뒀다', ok: (t) => t.wins >= 1 },
  { id: 'full', label: '풀 스쿼드', desc: '유스 없이 11명을 채웠다', ok: (t) => t.filled >= 11 },
  { id: 'streak-3', label: '3연승', desc: '3경기를 내리 이겼다', ok: (t) => t.bestStreak >= 3 },
  { id: 'rout', label: '대승', desc: '4골 차 이상으로 이겼다', ok: (t) => t.bestMargin >= 4 },
  { id: 'wins-10', label: '10승', desc: '10번 이겼다', ok: (t) => t.wins >= 10 },
  { id: 'streak-5', label: '5연승', desc: '5경기를 내리 이겼다', ok: (t) => t.bestStreak >= 5 },
  {
    id: 'goals-100',
    label: '100골',
    desc: '팀 경기에서 100골을 넣었다',
    ok: (t) => t.goalsFor >= 100,
  },
  { id: 'likes-10', label: '인기 구단', desc: '좋아요 10개를 받았다', ok: (t) => t.likes >= 10 },
  { id: 'wins-30', label: '30승', desc: '30번 이겼다', ok: (t) => t.wins >= 30 },
  { id: 'streak-10', label: '10연승', desc: '10경기를 내리 이겼다', ok: (t) => t.bestStreak >= 10 },
  { id: 'wins-100', label: '100승', desc: '100번 이겼다', ok: (t) => t.wins >= 100 },
];

/** 시즌 최종 순위 배지(끝난 시즌만). */
const FINAL: { id: string; label: string; top: number }[] = [
  { id: 'final-1', label: '시즌 우승', top: 1 },
  { id: 'final-3', label: '시즌 TOP 3', top: 3 },
  { id: 'final-10', label: '시즌 TOP 10', top: 10 },
];

/** 얻은 배지. finalRank는 끝난 시즌의 최종 순위(진행 중이거나 랭킹에 없으면 null). */
export function teamBadges(
  t: BadgeTeam,
  finalRank: number | null,
  seasonName: string,
): TeamBadge[] {
  const final = finalRank === null ? undefined : FINAL.find((f) => finalRank <= f.top);
  return [
    ...(final
      ? [{ id: final.id, label: final.label, desc: `${seasonName} 최종 ${finalRank}위` }]
      : []),
    ...RULES.filter((r) => r.ok(t)).map(({ id, label, desc }) => ({ id, label, desc })),
  ];
}
