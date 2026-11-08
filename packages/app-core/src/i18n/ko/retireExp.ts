// T-11-669 은퇴 화면 실험군의 대표 장면 · 내 구단 다음 행동(웹 · 앱 공용). 장면은 저장된 시즌 기록의 숫자만 옮긴다.
import { ns } from '../core';

const ko = {
  eyebrow: 'Key Scenes',
  title: '이 커리어의 장면',
  note: '저장된 시즌 기록에서 골랐어요.',
  firstApps: '첫 출전 기록',
  peakRating: '최고 평점 시즌',
  lastApps: '마지막 출전 시즌',
  when: (p: { year: number; age: number; club: string }) => `${p.year} · ${p.age}세 · ${p.club}`,
  stats: (p: { apps: number; goals: number; assists: number }) =>
    `${p.apps}경기 ${p.goals}골 ${p.assists}도움`,
  statsBack: (p: { apps: number; goals: number; cs: number }) =>
    `${p.apps}경기 ${p.goals}골 무실점 ${p.cs}`,
  rating: (p: { rating: string }) => `평점 ${p.rating}`,
  league: (p: { league: string; ovr: number }) => `${p.league} · OVR ${p.ovr}`,
  leagueRank: (p: { league: string; rank: number; ovr: number }) =>
    `${p.league} ${p.rank}위 · OVR ${p.ovr}`,
  honors: (p: { list: string }) => `이 시즌 우승 · 수상: ${p.list}`,
  open: '자세히',
  close: '접기',
  nextEyebrow: 'My Club',
  nextTitle: '내 구단에서',
  nextTeam: '기록이 서버에 올라갔어요. 내 팀 편성에서 이 선수를 고를 수 있어요.',
  nextLogin: '기록이 서버에 올라갔어요. 로그인하면 이 선수로 팀을 꾸려 다른 구단주와 겨뤄요.',
  nextClub: '서버에 올라간 은퇴 선수는 내 구단의 보유 선수로 모여요.',
  nextWait: '기록을 서버에 올리는 중이에요. 올라가면 내 구단의 보유 선수에 들어가요.',
  nextBlocked: '기록이 서버에 올라가지 않아 내 구단에서 쓸 수 없어요.',
  ctaTeam: '내 팀 편성 열기',
  ctaLogin: '로그인하고 팀 꾸리기',
  ctaClub: '내 구단 보기',
};

export type RetireExpMsgs = typeof ko;
export const retireExpText = ns('retireExp', ko);
