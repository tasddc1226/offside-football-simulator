import type { Translation } from '../core';
import type { LegendStyleMsgs } from '../ko/legendStyle';

export const legendStyle: Translation<LegendStyleMsgs> = {
  title: '玩法傾向',
  bets: '擲骰子的選擇',
  betsSmall: (p) => `成功${p.wins}次 · ${p.pct}%`,
  luck: '運氣',
  luckUp: (p) => `比預期多成功${p.n}次`,
  luckDown: (p) => `比預期少成功${p.n}次`,
  luckEven: '成功次數剛好符合預期',
  longshots: '40%以下的豪賭',
  longshotsSmall: (p) => `命中${p.n}次`,
  moves: '轉會',
  movesSmall: (p) =>
    `${p.tierUp ? `升上更高聯賽${p.tierUp}次` : '—'}${p.snubUp ? ` · 拒絕豪門${p.snubUp}次` : ''}`,
  bestLabel: '生涯最妙的一手',
  bestBefore: '成功機率',
  bestAfter: (p) => `的「${p.title}」，終究做到了。`,
  choices: (p) => `以${p.choices}次選擇為準${p.since ? ` · ${p.since}歲以後的紀錄` : ''}`,
};
