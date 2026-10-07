import type { Translation } from '../core';
import type { LegendStyleMsgs } from '../ko/legendStyle';

export const legendStyle: Translation<LegendStyleMsgs> = {
  title: 'プレースタイル',
  bets: 'サイコロを振った選択',
  betsSmall: (p) => `成功${p.wins}回 · ${p.pct}%`,
  luck: '運',
  luckUp: (p) => `期待より${p.n}回多く成功`,
  luckDown: (p) => `期待より${p.n}回少なく成功`,
  luckEven: 'ちょうど期待どおりに成功',
  longshots: '40%以下の勝負',
  longshotsSmall: (p) => `${p.n}回的中`,
  moves: '移籍',
  movesSmall: (p) =>
    `${p.tierUp ? `上位リーグへ${p.tierUp}回` : '—'}${p.snubUp ? ` · ビッグクラブを${p.snubUp}回拒否` : ''}`,
  bestLabel: 'キャリア最高の一手',
  bestBefore: '成功確率',
  bestAfter: (p) => `の「${p.title}」、ついにやり遂げた。`,
  choices: (p) => `選択${p.choices}回が基準${p.since ? ` · ${p.since}歳以降の記録` : ''}`,
};
