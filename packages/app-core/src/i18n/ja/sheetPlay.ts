import type { Translation } from '../core';
import type { SheetPlayMsgs } from '../ko/sheetPlay';

export const sheetPlay: Translation<SheetPlayMsgs> = {
  storyTag: (p) => `ストーリー · ${p.name}`,
  eventResult: (p) => `結果 · ${p.label}`,
  dexNew: '📖 図鑑に新項目',
  dexNote: 'ホームの確率図鑑で見られます',
  storyEnd: (p) => `ストーリー完結 · ${p.name}`,
  storyStarted: '新しいストーリー開始:',
  storyNext: '物語は次のフェーズに続きます。',
  marketTitle: '来シーズン、どこでプレーしますか？',
  salary: '年俸',
  offerA11y: (p) =>
    `${p.name}、${p.lg}${p.salary !== null ? `、年俸 ${p.salary}` : ''}${p.sub ? `、${p.sub}` : ''}${p.reason ? `、${p.reason}` : ''}`,
  noHonors: '今シーズンの受賞はありませんでした。',
  promoTitle: 'Kリーグ1昇格決定',
  promoBodyWeb: (p) =>
    `今シーズン1位で${p.club}の昇格が決まりました。来シーズンはKリーグ1で新たな挑戦が始まります。`,
  promoBodyApp: (p) =>
    `今シーズン1位で${p.club}の昇格が決まりました。来シーズンはKリーグ1でプレーします。`,
  promoDownWeb: (p) => `入れ替わる${p.club} · Kリーグ2降格`,
  promoDownApp: (p) => `${p.club} · Kリーグ2降格`,
  comps: '大会別成績',
  tours: '代表 · 国際大会',
  gala: 'バロンドール授賞式',
  miles: 'キャリアの節目',
  scoutHint: 'スカウトのひと言',
  fans: 'ファンの反応',
  ageWeb: (p) => `${p.age}歳になりました。次のシーズンの準備をしましょう。`,
  ageApp: (p) => `${p.age}歳になりました。次のシーズンに備えます。`,
};
