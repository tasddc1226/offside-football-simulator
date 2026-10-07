import type { Translation } from '../core';
import type { MarketValueChartMsgs } from '../ko/marketValueChart';

export const marketValueChart: Translation<MarketValueChartMsgs> = {
  hint: 'シーズン別の市場価値 · 点をタップするとそのシーズンの値を表示します',
  label: 'シーズン別の市場価値',
  dotLabel: (p) => `${p.year} ${p.club} 市場価値 ${p.value}`,
};
