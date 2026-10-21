// T-11-310 감독 커리어 화면(웹 ui/Manager.svelte · 앱 screens/owner/Manager.tsx). 시즌 결산 · 이벤트 문장은 게임 엔진
// gManager에 있다. 웹 · 앱이 같은 문구라 키를 함께 쓴다.
import { ns } from '../core';

const ko = {
  eyebrow: 'Manager career',
  title: '감독 커리어',
  // 구단주 화면 진입 카드
  entryTitle: '감독 커리어',
  entrySub: '은퇴한 선수로 감독 인생을 이어 가요',
  entryAria: '감독 커리어 열기',
  /** T-11-338 진행 중 감독 커리어 이어 하기(홈 · 내 구단 맨 위). */
  resumeEyebrow: 'Manager career',
  resumeTitle: '감독 커리어 이어 하기',
  resumeLine: (p: { club: string; n: number; total: number }) =>
    `${p.club} · ${p.n}/${p.total}시즌`,
  resumeOffers: (p: { n: number; total: number }) =>
    `구단 제의를 고르는 중이에요 · ${p.n}/${p.total}시즌`,
  resumeDone: '감독 카드로 확정만 남았어요',
  resumeAria: (p: { name: string }) => `${p.name} 감독 커리어 이어 하기`,
  resumeNoName: '진행 중인',
  entryNew: 'NEW',
  loading: '불러오는 중…',
  loadFail: '감독 정보를 불러오지 못했어요.',
  retry: '다시 시도',
  loginNeeded: '감독 커리어는 구글 로그인한 구단주만 할 수 있어요.',
  // 시작
  startHeading: '감독 커리어 시작',
  startLead:
    '지금 가진 선수 카드로 시작해요. 감독이 된 선수는 선발에서 빠지고, 커리어를 끝내면 우리 팀 감독으로 앉힐 수 있어요.',
  noCandidates: '감독으로 키울 수 있는 선수 카드가 없어요.',
  activeOther: '진행 중인 감독 커리어를 마치거나 포기하면 다른 선수로 시작할 수 있어요.',
  pick: '이 선수로 시작',
  inLineup: '선발',
  listed: '판매 중',
  confirmTitle: (p: { name: string }) => `${p.name} 선수를 감독으로 바꿀까요?`,
  confirmLineup: '지금 시즌 선발 · 친선 편성 · 프리셋에서 빠지고, 빈자리는 유스 선수가 채워요.',
  confirmListed: '이적시장 판매 등록이 내려가요.',
  confirmValue: (p: { value: string }) => `구단 가치가 ${p.value} 줄어요.`,
  confirmLocked: '감독이 된 선수는 팔거나 방출하거나 잠글 수 없어요.',
  confirmAbandon:
    '도중에 포기하면 원래 선수로 돌아와요. 선발에는 직접 다시 넣어야 해요. 감독 카드로 확정한 뒤에는 선수로 돌릴 수 없어요.',
  confirmOk: '감독으로 시작',
  cancel: '취소',
  // 진행
  progress: (p: { season: number; total: number; age: number }) =>
    `${p.season} / ${p.total}시즌 · ${p.age}세`,
  noClub: '맡은 팀 없음',
  statFame: '명성',
  statTrust: '이사회 신뢰',
  statMorale: '선수단 사기',
  statFans: '팬 여론',
  statControl: '장악력',
  statAdapt: '적응력',
  record: (p: { w: number; d: number; l: number }) => `${p.w}승 ${p.d}무 ${p.l}패`,
  honors: (p: { titles: number; cups: number; promotions: number }) =>
    `리그 우승 ${p.titles} · 컵 우승 ${p.cups} · 승격 ${p.promotions}`,
  offersHeading: '감독 제의',
  offersLead: '연락 온 구단 중 하나를 골라요.',
  offerLeague: (p: { league: string }) => p.league,
  accept: '부임하기',
  stay: '지금 팀에 남기',
  rest: '한 시즌 쉬기',
  restLead: '연락 온 구단이 없어요. 한 시즌 쉬면 명성이 조금 줄어요.',
  setupHeading: '시즌 준비',
  formation: '포메이션',
  mastery: (p: { grade: string }) => `숙련 ${p.grade}`,
  style: '성향',
  target: '이사회 목표',
  targetLead: '높은 목표를 이루면 이사회 신뢰가 크게 올라요. 못 이루면 그만큼 크게 떨어져요.',
  targetMin: '최소',
  startSeason: '시즌 시작',
  transferHeading: '이적시장',
  transferLead: '하나만 고를 수 있어요.',
  transferSpec: (p: { pos: string; ovr: number; age: number }) =>
    `${p.pos} · OVR ${p.ovr} · ${p.age}세`,
  skip: '이번엔 넘기기',
  eventHeading: (p: { n: number; total: number }) => `시즌 이야기 ${p.n} / ${p.total}`,
  next: '다음',
  toResult: '시즌 경기 치르기',
  resultHeading: (p: { n: number }) => `${p.n}시즌 결산`,
  nextSeason: '다음으로',
  doneHeading: '감독 커리어 끝',
  doneLead:
    '감독 카드로 확정하면 우리 팀 감독 칸에 앉힐 수 있어요. 확정한 뒤에는 다시 선수로 돌릴 수 없어요.',
  finish: '감독 카드로 확정',
  finishFail: '확정하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  /** T-11-443 '감독 카드로 확정' 확인 창. */
  finishTitle: '감독 카드로 확정할까요?',
  finishSeat: '확정하면 우리 팀 감독 칸에 앉힐 수 있어요.',
  finishFinal: '확정한 뒤에는 다시 선수로 돌릴 수 없어요.',
  finishOk: '확정하기',
  abandon: '감독 커리어 포기',
  abandonConfirm: '포기하면 진행한 감독 커리어가 사라지고 원래 선수로 돌아와요. 포기할까요?',
  abandonOk: '포기하기',
  history: '지난 시즌',
  historyRow: (p: { n: number; club: string; rank: number; teams: number }) =>
    `${p.n}시즌 · ${p.club} ${p.teams}팀 중 ${p.rank}위`,
  historyRest: (p: { n: number }) => `${p.n}시즌 · 쉼`,
  // 감독 카드
  myManagers: '내 감독',
  noManagers: '아직 끝낸 감독 커리어가 없어요.',
  grade: (p: { grade: string }) => `등급 ${p.grade}`,
  seasons: (p: { n: number }) => `${p.n}시즌`,
  specials: '특기',
  noSpecials: '특기 없음',
  effect: '감독 칸 효과',
  effectFor: (p: { formation: string }) => `${p.formation}일 때`,
  effectNote:
    '특기는 짝이 되는 팀 시너지가 켜질 때만 더해져요. 4-2-3-1 같은 변형 배치는 바탕 포메이션(4-3-3 · 4-4-2 · 3-5-2) 숙련을 써요. 감독 보정은 줄(공격 · 중원 · 수비)마다 −1.5부터 +3.0까지예요.',
  coachNow: '우리 팀 감독',
  seat: '우리 팀 감독으로',
  unseat: '감독 칸 비우기',
  needTeam: '이번 시즌 팀을 만들면 감독 칸을 쓸 수 있어요.',
  seatFail: '감독 칸을 바꾸지 못했어요.',
  release: '감독 경질',
  releaseTitle: (p: { name: string }) => `${p.name} 감독을 경질할까요?`,
  releasePay: (p: { amount: string }) =>
    `직접 키운 선수라 방출처럼 구단 자금 ${p.amount}을 받아요.`,
  releaseNoPay: '영입한 선수라 받는 구단 자금은 없어요.',
  releaseKeep: '감독 기록과 이미 받은 업적은 그대로 남아요.',
  releaseFinal: '경질한 감독은 되돌릴 수 없고 감독 칸에도 다시 앉힐 수 없어요.',
  releaseSeated: '감독 칸에 앉아 있는 감독은 칸을 비운 뒤 경질할 수 있어요.',
  releaseOk: '경질하기',
  releaseDone: (p: { name: string }) => `${p.name} 감독을 경질했어요.`,
  releaseFail: '감독을 경질하지 못했어요.',
  lineAtk: '공격',
  lineMid: '중원',
  lineDef: '수비',
  // 진행 연출
  liveEyebrow: (p: { n: number }) => `${p.n}시즌 경기`,
  liveRound: (p: { rd: number; total: number }) => `${p.rd} / ${p.total}경기`,
  liveSkip: '결과 바로 보기',
  liveDone: '시즌 결산 보기',
  tallyW: '승',
  tallyD: '무',
  tallyL: '패',
  tallyPts: '승점',
  badgeTitle: '리그 우승',
  badgeCup: '컵 우승',
  badgePromoted: '승격',
  badgeRelegated: '강등',
  badgeSacked: '경질',
  masteryUp: (p: { formation: string; from: string; to: string }) =>
    `${p.formation} 숙련 ${p.from} → ${p.to}`,
  seasonChange: '이번 시즌 변화',
  // 팀 화면 감독 칸
  teamCoach: '감독 칸',
  teamCoachEmpty: '비어 있어요',
  teamCoachManage: '감독 고르기',
  /** T-11-382 감독 칸 보정 내역. */
  breakdown: '보정 내역',
  partStyle: (p: { name: string }) => `${p.name} 성향`,
  breakdownCapped: (p: { raw: string; max: string }) =>
    `합은 ${p.raw}이지만 줄마다 최대 ${p.max}까지만 더해요.`,
  breakdownFloor: (p: { raw: string; min: string }) =>
    `합은 ${p.raw}이지만 줄마다 ${p.min}보다 낮아지지 않아요.`,
  breakdownOff: (p: { names: string }) =>
    `${p.names}: 짝이 되는 팀 시너지가 꺼져 있어 더하지 않아요.`,
  breakdownNote:
    '감독 보정은 줄마다 −1.5부터 +3.0까지예요. 특기는 짝 시너지가 여러 개 켜져도 한 번만 더해요.',
  /** T-11-335 남의 팀 프로필의 감독 칸. */
  profileCoach: '앉힌 감독',
  /** T-11-323 줄 힘 칸 아래 감독 보정(+1.0). */
  teamCoachLine: (p: { v: string }) => `감독 ${p.v}`,
  // T-11-329 선수 커리어와 같은 진행 연출(선택지 확률 · 성공/실패 · 시즌 단계)
  oddsSure: '확정',
  oddsLabel: (p: { label: string; odds: string }) => `${p.label}, 성공 확률 ${p.odds}`,
  outcomeOk: '성공',
  outcomeFail: '실패',
  eventResult: (p: { label: string }) => `결과 · ${p.label}`,
  stepsLabel: '이번 시즌 진행',
  stepOffers: '제의',
  stepSetup: '준비',
  stepTransfer: '영입',
  stepEvent: '이야기',
  stepResult: '결산',
  sheetEvent: (p: { n: number }) => `${p.n}시즌 이야기`,
};

export type ManagerMsgs = typeof ko;
export const managerText = ns('manager', ko);
