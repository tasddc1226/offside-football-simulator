// T-11-813 시즌 결산의 레전드 점수 변화 한 줄과, 레전드 · 아이콘 카드 기준을 이번 시즌에 넘었을 때의 안내.
// 라운지에서 "레전드 등급이 됐는데 왜 안 바뀌지?"가 나왔다(11-22) — 점수는 시즌 결산 때 반영되는데 그걸 알려 주는 곳이 없었다.
import { CARD_ICON_SCORE, CARD_LEGEND_SCORE } from '@offside/contracts/card-tier';
import { gameActionsText as L } from './i18n/ko/gameActions';

const n = (x: number) => x.toLocaleString('en-US');

export type LegendGainView = { line: string; cross: string | null };

/** before가 없으면(옛 세이브 · 결산 전 값을 모름) null. 점수가 그대로면 줄을 보이지 않는다. */
export function legendGain(before: number | undefined, after: number): LegendGainView | null {
  if (before === undefined || !(after > before)) return null;
  const cross =
    before < CARD_ICON_SCORE && after >= CARD_ICON_SCORE
      ? L.legendCrossIcon({ score: n(CARD_ICON_SCORE) })
      : before < CARD_LEGEND_SCORE && after >= CARD_LEGEND_SCORE
        ? L.legendCrossLegend({ score: n(CARD_LEGEND_SCORE) })
        : null;
  return { line: L.legendGain({ gain: n(after - before), score: n(after) }), cross };
}
