import type { Translation } from '../core';
import type { TeamDivisionMsgs } from '../ko/teamDivision';

export const teamDivision: Translation<TeamDivisionMsgs> = {
  d0: 'アマチュア',
  d1: 'セミプロII',
  d2: 'セミプロI',
  d3: 'プロII',
  d4: 'プロI',
  d5: 'エリートII',
  d6: 'エリートI',
  d7: 'マスター',
  label: 'ディビジョン',
  toNext: (p) => `${p.name}まであと${p.n}ポイント`,
  top: '最上位のディビジョンです',
  guard: (p) => `降格猶予中・あと${p.n}ポイント下がると降格します`,
  progressAria: (p) => `${p.name}ディビジョン、次のディビジョンまで${p.pct}%`,
  promoted: (p) => `${p.name}に昇格!`,
  relegated: (p) => `${p.name}に降格しました`,
  promotedBody: '試合結果でディビジョンが上がりました。',
  relegatedBody: 'RPを上げ直せば戻れます。',
  changedAway: (p) => `受けた試合の結果で${p.name}ディビジョンになりました`,
  tabAll: 'すべて',
  tabsAria: 'ディビジョン',
  countLine: (p) => `${p.s}チーム`,
  myDivision: '自分のディビジョン',
  emptyDivision: 'このディビジョンにはまだチームがありません。',
  rewardNote: (p) =>
    `${p.from}の締めから、シーズン終了時のディビジョンがプロII以上ならバッジとリロール券がもらえます。そのシーズンのランク試合${p.matches}試合以上、先発の引退選手8人以上が必要です。`,
  rewardTitle: 'シーズン報酬',
  previewNote: '今シーズンはディビジョンの表示のみで、報酬はありません。',
};
