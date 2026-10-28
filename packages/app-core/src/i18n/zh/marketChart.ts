import type { Translation } from '../core';
import type { MarketChartMsgs } from '../ko/marketChart';

export const marketChart: Translation<MarketChartMsgs> = {
  rangeWeek: '1週',
  rangeMonth: '1個月',
  rangeSeason: '賽季',
  rangeGroup: '期間',
  title: '同位置 · 同等級行情',
  group: (p) => `${p.pos} OVR ${p.band}~${p.band + 4}`,
  legendLine: '每日平均',
  legendDot: '此球員的交易',
  empty: '還沒有交易。',
  failed: '無法載入行情。',
  loading: '載入中…',
  baseLabel: '基準價',
  index: '市場行情',
  indexSub: (p) => `近7天交易${p.trades}筆 · 相對基準價`,
  indexA11y: (p) => `市場行情為基準價的${p.pct}，${p.change}`,
  noChange: '沒有變動',
  todayTrades: (p: { trades: number }) => `今日交易${p.trades}筆`,
  lastDayTrades: (p: { trades: number }) => `最後交易日${p.trades}筆`,
  volume: '交易量',
  live: '即時',
  dayText: (p) => `${p.day} · 平均 ${p.avg} · ${p.trades}筆`,
  tradeText: (p) => `${p.day} 此球員 · ${p.ratio}`,
};
