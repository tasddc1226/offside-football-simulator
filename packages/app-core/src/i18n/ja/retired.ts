import type { Translation } from '../core';
import type { RetiredMsgs } from '../ko/retired';

export const retired: Translation<RetiredMsgs> = {
  newCareer: '新しいキャリアをキックオフ →',
  myClub: 'マイクラブを作る',
  seeHof: '殿堂を見る',
  play: 'キャリアを再生',
  stop: '停止',
  cohortTitle: (p) => `シーズン${p.season}に引退した${p.pos}${p.n}人の中で`,
  cohortTop: (p) => `上位${p.pct}%`,
  cohortNote: '記録は1日に1回集計しています。',
  cohortScore: 'レジェンドスコア',
  cohortPeak: '最高OVR',
  cohortApps: '通算出場',
  cohortGoals: '通算ゴール',
  cohortAssists: '通算アシスト',
  cohortTrophies: 'トロフィー',
  cohortCaps: '代表出場',
  cohortBallon: 'バロンドール',
};
