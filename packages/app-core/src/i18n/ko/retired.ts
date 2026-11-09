// 은퇴 직후 화면(Retired)·은퇴 선수 상세(Legend)의 버튼과 커리어 재생. 웹·앱 공용.
import { ns } from '../core';

const ko = {
  newCareer: '새 커리어 킥오프 →',
  myClub: '내 구단 만들기',
  seeHof: '명예의 전당 보기',
  play: '커리어 재생',
  stop: '멈춤',
  // T-11-675 은퇴 동기 비교.
  cohortTitle: (p: { season: number; pos: string; n: string }) =>
    `시즌 ${p.season}에 은퇴한 ${p.pos} ${p.n}명 중에서`,
  cohortTop: (p: { pct: string }) => `상위 ${p.pct}%`,
  cohortNote: '하루 한 번 모은 기록이에요.',
  cohortScore: '레전드 점수',
  cohortPeak: '최고 OVR',
  cohortApps: '통산 경기',
  cohortGoals: '통산 골',
  cohortAssists: '통산 도움',
  cohortTrophies: '트로피',
  cohortCaps: 'A매치',
  cohortBallon: '발롱도르',
};

export type RetiredMsgs = typeof ko;
export const retiredText = ns('retired', ko);
