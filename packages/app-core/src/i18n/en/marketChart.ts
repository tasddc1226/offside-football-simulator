import type { Translation } from '../core';
import type { MarketChartMsgs } from '../ko/marketChart';

export const marketChart: Translation<MarketChartMsgs> = {
  rangeWeek: '1W',
  rangeMonth: '1M',
  rangeSeason: 'Season',
  rangeGroup: 'Period',
  title: 'Prices for the same position and grade',
  group: (p) => `${p.pos} OVR ${p.band}-${p.band + 4}`,
  legendLine: 'Daily average',
  legendDot: "This player's trades",
  empty: 'No trades yet.',
  failed: "Couldn't load prices.",
  loading: 'Loading…',
  baseLabel: 'Base',
  index: 'Market prices',
  indexSub: (p) =>
    `${p.trades} ${p.trades === 1 ? 'trade' : 'trades'} in the last 7 days · vs base value`,
  indexA11y: (p) => `Market prices at ${p.pct} of base value, ${p.change}`,
  noChange: 'No change',
  dayText: (p) => `${p.day} · avg ${p.avg} · ${p.trades} ${p.trades === 1 ? 'trade' : 'trades'}`,
  tradeText: (p) => `${p.day} · this player · ${p.ratio}`,
};
