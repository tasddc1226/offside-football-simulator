import type { Translation } from '../core';
import type { HomeLiveMsgs } from '../ko/homeLive';

export const homeLive: Translation<HomeLiveMsgs> = {
  title: 'いまのOFFSIDE',
  statPlaying: 'プレー中',
  statSeasons: '今日のシーズン数',
  statNew: '今日の新選手',
  statRetired: '今日の引退',
  pause: 'ニュースを一時停止',
  pauseTitle: '一時停止',
  resumeTitle: '再生',
  failed: 'いまは状況を読み込めませんでした。少ししてからもう一度確認します。',
  whatRetire: (p) => `引退 · レジェンドスコア ${p.score}`,
  whatFirst: (p) => `${p.club}で最初のシーズンを終えました`,
  whatHonor: (p) => `${p.honor} · ${p.club}`,
  whatCleanSheets: (p) => `${p.club} シーズン${p.apps}試合 無失点${p.cs}`,
  whatGoals: (p) => `${p.club} シーズン${p.goals}ゴール ${p.assists}アシスト`,
  attrsNone: '能力値の記録なし',
  attrsEstimated: '推定能力値',
  baseValue: (p) => `基準額 ${p.value}`,
  agoNow: 'たった今',
  agoMin: (p) => `${p.n}分前`,
  agoHour: (p) => `${p.n}時間前`,
  agoYesterday: '昨日',
  agoDay: (p) => `${p.n}日前`,
};
