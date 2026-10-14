// T-11-261 대륙 대회 녹아웃 대진(내 팀 경로) 보기 — 웹 시즌 탭(tabs/SeasonTab.svelte)·앱 시즌 탭(screens/game/SeasonTab.tsx) 공용.
// 엔진이 저장한 승부(comps.ts koTie·drawNext)를 그대로 읽는다. 화면에서 상대나 결과를 새로 만들지 않는다.
import { clubById } from '@offside/game/clubs';
import { tn } from '@offside/game/i18n/names';
import type { SeasonComp } from '@offside/game/types';
import { gameSeasonText as L } from './i18n/ko/gameSeason';

export type BracketRowState = 'won' | 'lost' | 'champion' | 'runnerUp' | 'next';
export type BracketRow = {
  /** 단계 이름(지금 언어). */
  stage: string;
  /** 'vs 상대' 줄. */
  vs: string;
  /** '2차전 합산' · '단판'. */
  legs: string;
  state: BracketRowState;
  /** 결과 문구('통과' · '탈락' · '우승' · '준우승' · '다음 상대'). */
  result: string;
};
export type BracketView = { rows: BracketRow[]; note: string | null };

/** 녹아웃에 들어섰지만 대진 기록이 없는 상태(이 기능 전 세이브). */
const LEGACY_KO = new Set(['16강 직행', '녹아웃 PO', '16강 진출']); // i18n-ignore 저장값

const oppName = (id: string): string => tn(clubById(id)?.name ?? id);
const resultOf = (state: BracketRowState): string =>
  state === 'next'
    ? L.bracketNext
    : state === 'champion'
      ? L.bracketChampion
      : state === 'runnerUp'
        ? L.bracketRunnerUp
        : state === 'won'
          ? L.bracketWon
          : L.bracketLost;

/** 대륙 대회의 내 팀 녹아웃 경로. 컵·슈퍼컵, 리그 페이즈만 치른 대회면 null. */
export function bracketView(c: SeasonComp): BracketView | null {
  if (c.type !== 'cont') return null;
  const b = c.bracket;
  if (!b || (!b.path.length && !b.next))
    return c.alive && LEGACY_KO.has(c.stage) ? { rows: [], note: L.bracketLegacy } : null;
  const rows: BracketRow[] = b.path.map((t) => {
    const final = t.stage === '결승'; // i18n-ignore 저장값
    const state: BracketRowState = final
      ? t.won
        ? 'champion'
        : 'runnerUp'
      : t.won
        ? 'won'
        : 'lost';
    return {
      stage: tn(t.stage),
      vs: L.bracketVs({ opp: oppName(t.opp) }),
      legs: L.bracketLegs({ n: t.legs }),
      state,
      result: resultOf(state),
    };
  });
  if (b.next)
    rows.push({
      stage: tn(b.next.stage),
      vs: L.bracketVs({ opp: oppName(b.next.opp) }),
      legs: L.bracketLegs({ n: b.next.legs }),
      state: 'next',
      result: resultOf('next'),
    });
  return { rows, note: null };
}

/** 시즌 결산의 대회별 성적 아래 한 줄: '16강 vs A 통과 · 8강 vs B 통과 · 4강 vs C 탈락'. 경로가 없으면 null. */
export function bracketLine(c: SeasonComp): string | null {
  const v = bracketView(c);
  if (!v || !v.rows.length) return null;
  return v.rows
    .filter((r) => r.state !== 'next')
    .map((r) => `${r.stage} ${r.vs} ${r.result}`)
    .join(' · ');
}
