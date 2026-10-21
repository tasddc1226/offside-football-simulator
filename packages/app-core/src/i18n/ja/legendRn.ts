import type { Translation } from '../core';
import type { LegendRnMsgs } from '../ko/legendRn';

export const legendRn: Translation<LegendRnMsgs> = {
  missKicker: '永久欠番の審査',
  missSeasons: (p: { club: string; seasons: number; need: number }) =>
    `${p.club}で${p.seasons}シーズンプレーしました。永久欠番には同じクラブで${p.need}シーズン以上が必要です。`,
  pctBand: (p) => `${p.pct}%台`,
  missScore: (p) =>
    `${p.club}での貢献ポイントは永久欠番の基準の${p.band}でした。基準を超えると欠番になります。`,
  missScoreClose: (p) =>
    `${p.club}での貢献ポイントは永久欠番の基準にわずかに届きませんでした。基準を超えると欠番になります。`,
  missScoreSeasons: (p) =>
    `${p.club}での貢献ポイントは永久欠番の基準の${p.band}で、${p.seasons}シーズンのプレーも${p.need}シーズンに届きませんでした。`,
  missStatSeasons: '同一クラブのシーズン',
  missStatSeasonsVal: (p) => `${p.seasons} / ${p.need}シーズン`,
  missStatScore: '貢献ポイント',
  missStatScoreVal: (p) => `基準の${p.band}`,
  missStatScoreClose: '基準のすぐ下',
  missStatScoreOver: '基準以上',
  pending: 'サーバーが永久欠番を審査しています。少ししてから殿堂で確認できます。',
  lineNum: (p) => `${p.number}番`,
  lineNumAfter: 'はこれから、',
  lineNameAfter: 'の名とともに残ります。',
  stats: (p) =>
    `${p.from}–${p.to} · ${p.seasons}シーズン · ${p.apps}試合 ${p.goals}ゴール ${p.assists}アシスト`,
  foot: (p) => `${p.club} 永久欠番 · サーバー${p.seq}番目の欠番`,
  takenA: (p) => `${p.number}番はすでに`,
  anonLegend: '匿名のレジェンド',
  takenB: 'の名で残っているため、',
  takenC: 'クラブは',
  takenD: 'の名を名誉の壁に刻みました。',
  anonA: '名前を公開すると',
  anonSlot: (p) => `${p.club} ${p.number}番`,
  anonTail: 'の永久欠番が確定します。',
  anonNote: '先に名前を公開した選手がその番号を受け取ります。',
  publish: '名前を公開して欠番を受け取る',
  alertTitle: (p) => `👑 ${p.name}、${p.number}番が永久欠番に`,
  alertSub: (p) => `${p.club} · サーバー${p.seq}番目の欠番`,
  alertLabel: (p) => `${p.name}、${p.number}番が永久欠番に`,
  alertOpen: '見る',
  alertClose: '通知を閉じる',
  jerseyLabel: (p) => `${p.name} ${p.number}番 永久欠番のユニフォーム`,
  wallOfHonor: 'クラブでの活躍が認められ、「名誉の壁」の称号を獲得しました。',
};
