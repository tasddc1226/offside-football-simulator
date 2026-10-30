import type { Translation } from '../core';
import type { MarketValueChartMsgs } from '../ko/marketValueChart';

export const marketValueChart: Translation<MarketValueChartMsgs> = {
  hint: '各賽季身價 · 點一下圓點即可查看該賽季的數值',
  label: '各賽季身價',
  dotLabel: (p) => `${p.year} ${p.club} 身價 ${p.value}`,
};
