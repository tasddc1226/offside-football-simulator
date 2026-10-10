// T-11-196 프리미엄 스카우트 확률 공개표(웹·앱 공용). 게임 엔진이 실제로 뽑는 식(scoutOdds)으로 계산한 값을 그대로 보인다.
import { SCOUT_GRADES, scoutOdds, type ScoutGrade } from '@offside/game/candidates';
import { scoutText as L } from './i18n/ko/scout';

export interface ScoutOddsRow {
  label: string;
  cells: { grade: ScoutGrade; pct: string }[];
}

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

/** opened: 시즌이 개막해 세부 포지션을 고르는 때인지(개막 전과 분포가 다르다). */
export function scoutOddsRows(opened: boolean): ScoutOddsRow[] {
  const o = scoutOdds(opened ? 'ST' : null);
  return (
    [
      [L.oddsNormal, o.normal],
      [L.oddsSure, o.sure],
      [L.oddsRest, o.rest],
    ] as const
  ).map(([label, t]) => ({
    label,
    cells: SCOUT_GRADES.map((grade) => ({ grade, pct: pct(t[grade]) })),
  }));
}
