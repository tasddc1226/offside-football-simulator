// 시즌별 몸값 꺾은선 그래프(웹 ui/ValueChart.svelte · 앱 components/ValueChart.tsx).
import { ns } from '../core';

const ko = {
  hint: '시즌별 몸값 · 점을 누르면 시즌 값을 보여 줘요',
  label: '시즌별 몸값',
  dotLabel: (p: { year: number; club: string; value: string }) =>
    `${p.year} ${p.club} 몸값 ${p.value}`,
};

export type MarketValueChartMsgs = typeof ko;
export const marketValueChartText = ns('marketValueChart', ko);
