// 커리어 하이 배지·다음 목표(records.ts)와 은퇴 리포트 이야기 줄(retirement-report.ts).
import { ns } from '@offside/contracts/i18n';

const ko = {
  chGoals: '커리어 최다골',
  chAssists: '커리어 최다도움',
  chApps: '커리어 최다출전',
  chRating: '커리어 최고평점',
  chCs: '커리어 최다무실점',
  msApps: (p: { n: number }) => `통산 ${p.n}경기 출전`,
  msCaps: (p: { n: number }) => `A매치 ${p.n}경기 출전`,
  msTrophy: (p: { n: number }) => `우승 트로피 ${p.n}회`,
  msGoals: (p: { n: number }) => `통산 ${p.n}골`,
  msAssists: (p: { n: number }) => `통산 ${p.n}도움`,
  /** 은퇴 리포트 챕터의 이야기 결말 줄. 이름·결말은 저장값을 지금 언어로 옮겨 넘긴다. */
  storyEnding: (p: { name: string; ending: string }) => `「${p.name}」 ${p.ending}`,
};
export type GRecordsMsgs = typeof ko;
export const gRecordsText = ns('gRecords', ko);
