// T-11-463 시즌 BEST 11 화면 규칙(웹 Best11.svelte · 앱 screens/hof/Best11.tsx가 함께 쓴다): 자리 이름, 선정 이유 세 줄,
// 자리 변화 한 줄, 그라운드 자리 순서.
import type { Best11Change, Best11Player, Best11Response } from '@offside/contracts';
import { BEST11_SLOTS, BEST11_SLOT_ROLE, type Best11Slot } from '@offside/contracts/best11-rules';
import { DETAIL_LABEL } from '@offside/contracts/positions';
import type { TeamPosition } from '@offside/contracts/owner-team';
import { tn } from '@offside/game/i18n/names';
import { best11Text as L } from './i18n/ko/best11.js';

/** 자리 이름(왼쪽 풀백 · 센터백 …). */
export const best11SlotName = (slot: Best11Slot): string =>
  tn(DETAIL_LABEL[BEST11_SLOT_ROLE[slot]]);

/** 4-3-3 그라운드 좌표(공격이 위, 0~100). 자리 순서가 BEST11_SLOTS와 같다. 구단주 팀 기본 4-3-3은 DM · CM · AM을 대각선으로
 *  놓아 좁은 화면에서 풀백 · 윙어 카드와 겹치므로, DM을 수비 앞 가운데에 두고 CM · AM을 양옆으로 벌린다. 카드 위 포지션은
 *  좌우가 드러나게(LB · RW …) 쓴다. */
const XY: Record<Best11Slot, [number, number]> = {
  GK: [50, 92],
  LB: [14, 70],
  CB1: [36, 75],
  CB2: [64, 75],
  RB: [86, 70],
  DM: [50, 57],
  CM: [25, 44],
  AM: [75, 44],
  LW: [16, 22],
  ST: [50, 13],
  RW: [84, 22],
};
export const best11Layout = (): TeamPosition[] =>
  BEST11_SLOTS.map((s) => ({ x: XY[s][0], y: XY[s][1], slot: BEST11_SLOT_ROLE[s] }));

/** 지수 한 자리 소수. */
export const fmtIndex = (n: number): string => n.toFixed(1);

/** 선정 이유 세 줄: 개인 활약 · 팀 성과 · 개인 수상. */
export function best11Reasons(p: Best11Player): [string, string, string] {
  const f = p.facts;
  const team = [
    f.leagues && L.leagues({ n: f.leagues }),
    f.ucl && L.ucl({ n: f.ucl }),
    f.wc && L.wc({ n: f.wc }),
  ].filter(Boolean);
  const award = [
    f.ballon && L.ballon({ n: f.ballon }),
    f.fifpro && L.fifpro({ n: f.fifpro }),
    f.posAwards && L.posAwards({ n: f.posAwards }),
  ].filter(Boolean);
  return [
    L.reasonPrime({ rating: f.rating.toFixed(2), apps: f.apps }),
    team.length ? team.join(' · ') : L.noTeam,
    award.length ? award.join(' · ') : L.noAward,
  ];
}

/** 자리 변화 한 줄. */
export function best11ChangeLine(c: Best11Change): string {
  const slot = best11SlotName(c.slot);
  const name = c.in ?? L.hiddenName;
  const out = c.out ?? L.hiddenName;
  if (c.in === null && c.out !== null) return L.changeOut({ slot, out });
  return c.out === null ? L.changeFirst({ slot, name }) : L.changeIn({ slot, name, out });
}

/** 자리의 순위표(CB2는 CB1과 같은 후보군이라 CB1 순위를 본다). */
export const best11RankingOf = (data: Best11Response, slot: Best11Slot) =>
  data.rankings.find((r) => r.slot === (slot === 'CB2' ? 'CB1' : slot))?.entries ?? [];

/** 자리의 커트라인(지금 그 자리 주인의 지수). */
export const best11Cutline = (data: Best11Response, slot: Best11Slot): number | null =>
  data.slots.find((s) => s.slot === slot)?.player?.index ?? null;

/** 선정 기준 다섯 줄(화면 아래 접힌 칸). */
export const best11Criteria = (): string[] => [
  L.criteria1,
  L.criteria2,
  L.criteria3,
  L.criteria4,
  L.criteria5,
];
