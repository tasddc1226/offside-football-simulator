import type { Translation } from '../core';
import type { GameAuctionMsgs } from '../ko/gameAuction';

export const gameAuction: Translation<GameAuctionMsgs> = {
  title: '高級オークション',
  line: (p) => `今シーズンの出品が届きました。1つ${p.cost}で、箱を開けるまで等級はわかりません。`,
  lineDone: '今シーズンの出品はすべて買いました。次のシーズンに新しい出品が届きます。',
  buy: '落札',
  got: '落札済み',
  short: '資金不足',
  confirm: (p) => `${p.item}の箱を${p.cost}で買いますか？等級は開けるまでわかりません。`,
  confirmBtn: '落札する',
  cancel: 'キャンセル',
  odds: (p) => `等級の確率：一般 ${p.g1}% · 高級 ${p.g2}% · 名品 ${p.g3}% · 伝説 ${p.g4}%`,
  note: '品ごとに価値がつき、引退するときに引退レガシーに加算されます（人気が高いほど高く評価されます）。1種類の4等級を集めるとセット効果で試合のパフォーマンスが少し上がります。重複した品は買値の半額で売ります。引退すると代表的な3点が殿堂に残ります。',
  adButton: '出品を入れ替える',
  adBadge: '広告',
  adNote: '広告を見ると今シーズンの出品を入れ替えられます（シーズンに1回）。',
  adNoteFree: '広告削除で今シーズンの出品を入れ替えられます（シーズンに1回）。',
  adWatch: '広告を最後まで見ると出品を入れ替えられます。',
  refreshed: '新しい出品が届きました。',
  shelfWorth: (p) => (p.sets ? `価値${p.value} · セット${p.sets}` : `価値${p.value}`),
  shelfTitle: 'コレクション棚',
  shelfCount: (p) => `コレクション ${p.n}/${p.total}`,
  shelfLabel: (p) => `${p.item} ${p.grade} ${p.on ? '所持' : 'なし'}`,
  rolling: '箱を開けています…',
  resultTitle: (p) => `${p.grade}の${p.item}`,
  resultNew: (p) => `コレクション棚に新しい品が加わりました。価値${p.value}。`,
  resultDupe: (p) => `すでに持っている品なので${p.refund}で売りました。`,
  resultComplete: (p) =>
    `${p.item}の4等級をすべて集めました。セット効果で試合のパフォーマンスが少し上がります。`,
  close: 'OK',
  creditTitle: '代表コレクション',
};
