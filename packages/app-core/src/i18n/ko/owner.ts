// 구단주 허브(웹 Owner.svelte · 앱 screens/owner/Owner.tsx) + 허브가 그리기 전에 만드는 문구(ownerHub.ts).
// 웹·앱 문구가 다른 줄은 Web/App 접미사로 나눈다.
import { ns } from '../core';

const ko = {
  title: '구단주',
  summaryLabel: '구단주 요약',
  /** 닉네임이 없을 때 동그란 아바타에 들어가는 한 글자. */
  avatarInitial: '구',
  guestName: '게스트 구단주',
  guestSub: '기록은 이 기기에만 저장돼요',
  signedInSubWeb: 'Google 계정으로 로그인했어요',
  signedInSubApp: '로그인했어요',
  emptySummary: '첫 커리어를 끝까지 뛰면 은퇴 선수와 레전드 점수가 여기에 쌓여요.',
  statClubValue: '구단 가치',
  statRetired: '은퇴 선수',
  statLegend: '레전드 점수',
  statRetiredNumbers: '영구결번',
  playersCount: (p: { n: number; text: string }) => `${p.text}명`,
  numbersCount: (p: { n: number }) => `${p.n}개`,
  fundsLine: (p: { funds: string }) => `구단 자금 ${p.funds}`,
  myTeam: '내 팀',
  manager: (p: { manager: string; formation: string }) => `${p.manager} 감독 · ${p.formation}`,
  teamOvr: (p: { ovr: number }) => `팀 OVR ${p.ovr}`,
  statRecord: '전적',
  statRating: '레이팅',
  statToday: '오늘 경기',
  play: '경기하기',
  teamFailed: '시즌마다 은퇴한 선수로 팀을 꾸려 겨루고, 라이브 랭킹과 구단 업적을 채워요.',
  loading: '불러오는 중…',
  buildTeam: '팀 만들기',
  teamBtnApp: '내 팀 · 시즌 업적',
  marketTitle: '이적시장',
  marketSub: (p: { funds: string }) => `구단 자금 ${p.funds} · 이번 시즌 선수를 사고팔아요`,
  open: '열기',
  /** 잠긴 '내 팀' 카드 가운데 배지. 🔒 뒤 U+FE0E는 글자 모양(이모지 아님) 지정. */
  lockBadge: '\u{1F512}︎ 로그인하면 열려요',
  accountSection: '계정',
  adminTools: '운영 도구',
  // ownerHub.ts
  teamEmptyWith: (p: { season: string; n: number }) =>
    `${p.season}에 은퇴한 내 선수 ${p.n}명으로 팀을 꾸릴 수 있어요. 빈 자리는 유스 선수가 채워요.`,
  teamEmptyNone: (p: { season: string }) =>
    `${p.season}에 뛰고 은퇴한 선수가 생기면 팀을 꾸릴 수 있어요.`,
  locked: (p: { players: number }) =>
    `로그인하면 ${p.players > 0 ? `은퇴한 선수 ${p.players}명으로` : '은퇴한 선수로'} 팀을 꾸려 다른 구단주와 겨뤄요. 하루 경기·라이브 랭킹·시즌 업적이 열려요.`,
};

export type OwnerMsgs = typeof ko;
export const ownerText = ns('owner', ko);
