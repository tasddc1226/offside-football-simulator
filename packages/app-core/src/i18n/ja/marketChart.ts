import type { Translation } from '../core';
import type { MarketChartMsgs } from '../ko/marketChart';

export const marketChart: Translation<MarketChartMsgs> = {
  rangeWeek: '1週',
  rangeMonth: '1か月',
  rangeSeason: 'シーズン',
  rangeGroup: '期間',
  title: '同じポジション · ランクの相場',
  group: (p) => `${p.pos} OVR ${p.band}〜${p.band + 4}`,
  legendLine: '1日の平均',
  legendDot: 'この選手の取引',
  empty: 'まだ取引がありません。',
  failed: '相場を読み込めませんでした。',
  loading: '読み込み中…',
  baseLabel: '基準価格',
  index: '市場相場',
  indexSub: (p) => `直近7日の取引 ${p.trades}件 · 基準価格比`,
  indexA11y: (p) => `市場相場は基準価格の${p.pct}、${p.change}`,
  noChange: '変動なし',
  dayText: (p) => `${p.day} · 平均 ${p.avg} · ${p.trades}件`,
  tradeText: (p) => `${p.day} この選手 · ${p.ratio}`,
};
