import type { Translation } from '../core';
import type { MarketValueChartMsgs } from '../ko/marketValueChart';

export const marketValueChart: Translation<MarketValueChartMsgs> = {
  hint: "Value by season · tap a dot to see that season's value",
  label: 'Value by season',
  dotLabel: (p) => `${p.year} ${p.club} value ${p.value}`,
};
