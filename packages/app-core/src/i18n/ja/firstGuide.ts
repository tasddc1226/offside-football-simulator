import type { Translation } from '../core';
import type { FirstGuideMsgs } from '../ko/firstGuide';

export const firstGuide: Translation<FirstGuideMsgs> = {
  title: 'はじめての案内',
  close: '閉じる',
  closeAria: 'はじめての案内を閉じる',
  typesTitle: 'ポジションとタイプ',
  typesBody: (p) =>
    `選手作成で選んだ得意能力${p.n}つでタイプが決まります。組み合わせごとのタイプと合うチームシナジーはタイプ図鑑にあります。`,
  typesGo: 'タイプ図鑑',
  shopTitle: 'リロールチケット・スカウト券・強化券',
  shopBody:
    'マイクラブ画面のショップで買えます。リロールチケットとスカウト券は選手作成の候補選びで、強化券は選手タブのポテンシャル強化で使います。',
  shopGo: 'ショップへ',
  guideTitle: '永久欠番・引退',
  guideBody: '永久欠番の条件、引退年齢、殿堂入りはゲームガイドにまとめています。',
  guideGo: 'ゲームガイド',
  itemsTitle: 'スカウト券・強化券はここ',
  itemsBody:
    'リロールチケット・プレミアムスカウト券・ポテンシャル強化券はマイクラブ画面のショップにあります。クラブ資金で買う商品はWebとアプリで、課金商品はアプリで買えます。',
  itemsCloseAria: '商品の場所の案内を閉じる',
  typeDex: '選手タイプ図鑑',
};
