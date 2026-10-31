import type { Translation } from '../core';
import type { CareerOverviewMsgs } from '../ko/careerOverview';
export const careerOverview: Translation<CareerOverviewMsgs> = {
  calendarTitle: '大会日程',
  calendarHint:
    '代表大会はシーズン決算時に行われます。出場は予選・年齢・選出・クラブの許可で決まります。',
  currentYear: '現在の年',
  endYear: '終了したシーズン',
  yearLabel: (p) => `${p.year}年`,
  calendarAge: '歳',
  wildcard: 'オーバーエイジ選出が必要',
  youth: 'U-23代表選出が必要',
  senior: '代表選出が必要',
  qualified: '本大会出場決定',
  eliminated: '予選敗退',
  qualification: '予選結果待ち',
  scoringTitle: 'リーグ選手記録',
  scoringHint: 'リーグ戦のみ集計します。同率1位は得点王・アシスト王を共同受賞します。',
  scoringLegacy: '今季は従来の表彰ルールを維持します。順位は来季から表示されます。',
  goalRank: '得点',
  assistRank: 'アシスト',
  mine: '自分の選手',
  rivalForward: 'フォワード',
  rivalCreator: 'ミッドフィルダー',
  rankLabel: (p) => `${p.rank}位`,
  seasonOver: 'シーズン終了',
};
