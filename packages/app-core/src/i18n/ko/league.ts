// 오프사이드 리그(T-11-418) 화면: 홈 배너 · 리그 화면(일정 · 규칙 · 신청). 웹 · 앱이 함께 쓰는 문구라 키 하나를 같이 쓴다.
// 날짜는 컵 문구(cup.dayTime)로 만든 값을 넘긴다.
import { ns } from '../core';

const ko = {
  title: '오프사이드 리그',
  seasonTitle: (p: { season: number }) => `시즌 ${p.season} 오프사이드 리그`,
  open: '리그 보기',
  loadFail: '리그 정보를 불러오지 못했어요.',
  pitch:
    '8팀이 한 리그에서 홈 · 원정으로 두 번씩 붙어 14라운드를 치러요. 순위에 따라 다음 시즌 부가 오르내려요.',
  // 단계
  phaseSoon: '접수 예정',
  phaseOpen: '접수 중',
  phaseClosed: '배치 대기',
  phaseRunning: '진행 중',
  phaseDone: '종료',
  // 배너 한 줄
  soonLine: (p: { at: string }) => `${p.at}부터 신청받아요.`,
  openLine: (p: { entries: number; until: string }) => `${p.entries}팀 신청 · ${p.until}까지`,
  closedLine: (p: { at: string }) => `${p.at}에 부와 리그 배치를 발표해요.`,
  runningLine: '리그 경기가 진행 중이에요.',
  doneLine: '이번 시즌 리그가 끝났어요.',
  // 일정
  scheduleTitle: '일정',
  scheduleEntry: '신청',
  scheduleSeason: (p: { season: number }) => `시즌 ${p.season} 개막`,
  scheduleDraw: '배치 · 대진 발표',
  scheduleRounds: '1 ~ 14라운드',
  date: (p: { month: number; day: number }) => `${p.month}월 ${p.day}일`,
  range: (p: { from: string; to: string }) => `${p.from} ~ ${p.to}`,
  daily: (p: { from: string; to: string; time: string }) => `${p.from} ~ ${p.to}, 매일 ${p.time}`,
  // 규칙
  rulesTitle: '규칙',
  ruleEntry:
    '시즌 개막 7일 전부터 미리 신청할 수 있어요. 배치 때 그 시즌 팀 선발에 내 은퇴 선수가 8명보다 적으면 리그에서 빠져요.',
  ruleTiers:
    '1부는 리그 1개, 2부는 2개처럼 아래 부로 갈수록 리그가 두 배로 늘어요. 첫 시즌은 접수 마감 때 팀 OVR 순으로 위 부부터 채워요. 참가 팀 수에 따라 7팀 리그도 생기고, 7팀 리그는 라운드마다 한 팀이 쉬어요.',
  rulePoints:
    '홈 팀이 조금 유리해요. 승리 3점, 무승부 1점이에요. 승점이 같으면 득실차, 다득점, 승자승 순으로 가려요.',
  ruleMove: '리그마다 1위는 다음 시즌 한 부 위로, 7 · 8위는 한 부 아래로 가요.',
  ruleLock:
    '경기 1시간 전부터 경기가 끝날 때까지 팀 명단을 바꿀 수 없어요. 이적시장은 막지 않아요.',
  ruleForfeit:
    '경기 때 선발에 내 은퇴 선수가 8명보다 적으면 0:3 패예요. 3번 기권하면 남은 경기도 모두 0:3 패가 되고, 다음 시즌은 맨 아래 부에서 시작해요.',
  ruleReward: '보상은 구단 자금이 아니라 트로피 · 칭호 · 아이템이에요. 시즌이 끝나면 받아요.',
  // 내 신청
  entries: (p: { n: number }) => `신청 ${p.n}팀`,
  loginToEnter: '로그인하면 리그에 신청할 수 있어요.',
  enter: '리그 신청',
  entering: '신청하는 중…',
  entered: '신청 완료',
  withdraw: '신청 취소',
  withdrawing: '취소하는 중…',
  withdrawConfirm: '리그 신청을 취소할까요? 접수 기간에는 다시 신청할 수 있어요.',
  toastEntered: '리그에 신청했어요.',
  toastWithdrawn: '리그 신청을 취소했어요.',
  enteredNote: (p: { at: string }) =>
    `${p.at}에 배치를 발표해요. 그때 팀 OVR로 부와 리그가 정해져요.`,
  myOvr: (p: { ovr: number }) => `지금 내 팀 OVR ${p.ovr}`,
  presignNote: (p: { season: number; at: string }) =>
    `시즌 ${p.season} 개막 전이라도 미리 신청할 수 있어요. 시즌 ${p.season} 팀은 ${p.at} 개막부터 만들 수 있어요.`,
  readyOk: (p: { filled: number }) => `준비 완료 · 선발에 내 은퇴 선수 ${p.filled}명`,
  readyShort: (p: { filled: number; min: number }) =>
    `선발에 내 은퇴 선수가 ${p.filled}/${p.min}명이에요. 배치 전까지 ${p.min}명을 채워야 리그에 들어가요.`,
  readyNoTeam: (p: { season: number; min: number }) =>
    `아직 시즌 ${p.season} 팀이 없어요. 배치 전까지 팀을 만들고 선발에 내 은퇴 선수 ${p.min}명을 채워야 리그에 들어가요.`,
  notEntered: '이번 시즌 리그에 신청하지 않았어요.',
  drawPending: '배치 · 대진은 발표 뒤 이 화면에 올라와요.',
  // T-11-418b 배치 뒤: 내 배치 · 리그 고르기 · 순위표 · 라운드 경기 · 경기 상세.
  runningRounds: (p: { n: number; total: number }) =>
    `${p.total}라운드 중 ${p.n}라운드를 치렀어요.`,
  leagueName: (p: { tier: number; league: number }) => `${p.tier}부 ${p.league}리그`,
  placedLine: (p: { tier: number; league: number; rank: number }) =>
    `${p.tier}부 ${p.league}리그 · 지금 ${p.rank}위`,
  droppedLine: '배치 때 선발에 내 은퇴 선수가 모자라 이번 시즌 리그에 들어가지 못했어요.',
  forfeitedLine: '기권이 3번 쌓여 남은 경기는 모두 0:3 패로 기록돼요.',
  myLeague: '내 리그',
  pickLeague: '리그 고르기',
  standingsTitle: '순위표',
  zoneUp: '승격권',
  zoneDown: '강등권',
  forfeitsTag: (p: { n: number }) => `기권 ${p.n}`,
  roundsTitle: '라운드',
  roundName: (p: { n: number }) => `${p.n}라운드`,
  restTeam: (p: { team: string }) => `쉬는 팀 · ${p.team}`,
  forfeitScore: '기권',
  tableFail: '순위표를 불러오지 못했어요.',
  detailTitle: (p: { tier: number; league: number; round: number }) =>
    `${p.tier}부 ${p.league}리그 ${p.round}라운드`,
  detailBack: '리그로 돌아가기',
};

export type LeagueMsgs = typeof ko;
export const leagueText = ns('league', ko);
