import type { Translation } from '../core';
import type { FirstsMsgs } from '../ko/firsts';

export const firsts: Translation<FirstsMsgs> = {
  title: 'サーバー初の実績',
  introRecords: (p) =>
    `${p.records ? 'すべてのプレイヤーの中で最も高い記録です。より大きな記録が出ると持ち主が変わります。' : 'すべてのプレイヤーを通じて、最初に打ち立てた記録だけが残ります。'}名前は殿堂で名前を公開した選手だけ表示されます。`,
  seasonLabel: 'シーズン',
  tabsLabel: '記録の分類',
  loadFailed: 'サーバー初の記録を読み込めませんでした。しばらくしてからもう一度お試しください。',
  loading: '読み込み中…',
  empty: 'まだサーバー初の記録はありません。',
  noRecord: 'まだ記録なし',
  locked: '未達成',
  mine: '自分の選手',
  steps: (p) => `${p.done}/${p.total}段階`,
  next: (p) => `次の目標: ${p.label}`,
  allDone: '最後の段階まで達成しました',
  showSteps: 'すべての段階を見る',
  hideSteps: '段階を閉じる',
  burst: (p) => `${p.n}段階`,
  topTitle: '記録を最も多く打ち立てた選手',
  topCount: (p) => `${p.n}個`,
};
