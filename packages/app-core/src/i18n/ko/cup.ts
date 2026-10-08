// 오프사이드 컵(T-11-145) 화면: 구단주 화면 배너 · 대회 화면 · 팀 편성 마감 띠 · 팀 프로필 컵 기록 · 선수 후보 리롤권.
// 웹·앱이 함께 쓰는 문구라 키 하나를 같이 쓴다.
import { ns } from '../core';

const ko = {
  title: '오프사이드 컵',
  edition: (p: { n: number }) => `제${p.n}회`,
  fullTitle: (p: { n: number }) => `제${p.n}회 오프사이드 컵`,
  champTitle: (p: { n: number }) => `제${p.n}회 오프사이드 컵 챔피언`,
  champBadge: (p: { n: number }) => `제${p.n}회 챔피언`,
  open: '대회 보기',
  loadFail: '대회 정보를 불러오지 못했어요.',
  loading: '불러오는 중…',
  // 날짜. month·day는 숫자, time은 "21:00".
  dayTime: (p: { month: number; day: number; time: string }) => `${p.month}월 ${p.day}일 ${p.time}`,
  whenToday: (p: { time: string }) => `오늘 ${p.time}`,
  // 대회 단계
  phaseSoon: '접수 예정',
  phaseOpen: '접수 중',
  phaseClosed: '추첨 대기',
  phaseGroup: '조별 예선',
  phaseKnockout: '토너먼트',
  phaseDone: '종료',
  phaseCancelled: '열리지 않음',
  // 성적·라운드
  stageChampion: '우승',
  stageRunnerup: '준우승',
  stageSf: '4강',
  stageQf: '8강',
  stageR16: '16강',
  stageR32: '32강',
  stageGroup: '조별 예선',
  roundG1: '조별 1경기',
  roundG2: '조별 2경기',
  roundG3: '조별 3경기',
  roundR32: '32강',
  roundR16: '16강',
  roundQf: '8강',
  roundSf: '4강',
  roundF: '결승',
  // 배너 한 줄
  soonLine: (p: { at: string }) => `${p.at}부터 신청받아요.`,
  openLine: (p: { entries: number; cap: number; until: string }) =>
    `${p.entries}/${p.cap}팀 신청 · ${p.until}까지`,
  closedLine: (p: { at: string }) => `${p.at}에 조를 추첨해요.`,
  groupLine: (p: { teams: number }) => `${p.teams}팀이 조별 예선을 치르고 있어요.`,
  knockoutLine: (p: { round: string }) => `${p.round} 진행 중이에요.`,
  doneLine: (p: { team: string }) => `우승 ${p.team}`,
  cancelledLine: '신청한 팀이 모자라 이번 대회는 열리지 않았어요.',
  // 내 상태
  entered: '신청 완료',
  enter: '컵 신청하기',
  entering: '신청 중…',
  withdraw: '신청 취소',
  withdrawing: '취소 중…',
  withdrawConfirm: '컵 신청을 취소할까요? 접수 기간 안에는 다시 신청할 수 있어요.',
  toastEntered: '컵에 신청했어요.',
  toastWithdrawn: '신청을 취소했어요.',
  loginToEnter: 'Google 로그인하면 신청할 수 있어요.',
  enterLockNote: '신청하면 선발 선수는 이적시장에 올리거나 방출할 수 없어요. 탈락하면 풀려요.',
  reasonNoTeam: '이번 시즌 구단이 있어야 신청할 수 있어요.',
  reasonNotEnough: (p: { filled: number; min: number }) =>
    `선발에 내 선수가 ${p.min}명 이상 있어야 해요. 지금은 ${p.filled}명이에요.`,
  reasonListed: '이적시장에 올린 선수가 선발에 있어요. 선발에서 빼거나 판매를 취소해 주세요.',
  reasonFull: '정원이 다 찼어요.',
  reasonClosed: '지금은 신청 기간이 아니에요.',
  notEntered: '이번 대회에는 신청하지 않았어요.',
  nextMatch: (p: { round: string; vs: string; at: string }) =>
    `다음 경기 ${p.round} · ${p.vs} · ${p.at}`,
  nextPending: '다음 경기 상대가 정해지는 중이에요.',
  lockNote: (p: { when: string }) => `${p.when} 명단 마감`,
  lockedNow: '명단이 잠겼어요. 경기가 끝나면 다시 바꿀 수 있어요.',
  myResult: (p: { stage: string }) => `내 성적 ${p.stage}`,
  youWon: '우승했어요!',
  // 편성 화면 띠
  lineupLocked: '컵 경기 명단이 잠겼어요. 경기가 끝나면 다시 바꿀 수 있어요.',
  lineupBand: (p: { when: string }) =>
    `${p.when} 컵 명단이 마감돼요. 마감부터 그 경기가 끝날 때까지 바꿀 수 없어요.`,
  // 대회 화면
  secMine: '내 대회',
  secRules: '규칙',
  secSchedule: '일정',
  secRewards: '보상',
  secGroups: '조별 예선',
  secBracket: '토너먼트',
  secEntrants: '신청한 팀',
  entrantsNote: '먼저 신청한 순서예요. 신청이 끝나면 조를 추첨해요.',
  mineTeam: '내 팀',
  rulePlay: (p: { min: number; cap: number }) =>
    `선발에 내 선수가 ${p.min}명 이상 있는 이번 시즌 팀이 신청할 수 있어요. 정원은 ${p.cap}팀이고 먼저 신청한 순서로 받아요.`,
  ruleGroup:
    '신청이 끝나면 팀 OVR을 기준으로 조를 추첨해요. 조마다 한 번씩 겨루고, 조 1·2위가 토너먼트에 올라가요.',
  rulePoints: '승점은 승 3점, 무 1점, 패 0점이에요. 같으면 득실차, 다득점 순으로 가려요.',
  ruleKnockout: '토너먼트는 단판이고, 비기면 승부차기로 가려요.',
  ruleDaily: (p: { time: string }) =>
    `경기는 하루에 한 번 ${p.time}에 서버가 치러요. 앱이나 웹을 켜 두지 않아도 돼요.`,
  ruleLock: (p: { time: string }) =>
    `명단은 경기 1시간 전(${p.time})에 잠기고 그 경기가 끝나면 풀려요. 컵 경기는 홈 이점이 없고 일반 경기의 전적·레이팅에 들어가지 않아요.`,
  ruleForfeit:
    '참가 중인 선발 선수는 이적시장에 올리거나 방출할 수 없어요. 경기에 나오지 못하면 0:3 패배로 처리돼요.',
  schedEntry: '신청',
  schedDraw: '조 추첨',
  rewardStage: '성적',
  rewardItem: '보상',
  rewardReroll: (p: { n: number }) => `선수 후보 리롤권 ${p.n}장`,
  rewardTrophy: '트로피·칭호',
  rewardNote:
    '리롤권은 새 선수를 만들 때 후보 3명을 다시 뽑는 데 써요. 탈락이 정해지면 바로 받아요.',
  groupName: (p: { no: number }) => `${p.no}조`,
  myGroup: '내 조',
  thTeam: '팀',
  thP: '경기',
  thW: '승',
  thD: '무',
  thL: '패',
  thGd: '득실',
  thPts: '승점',
  advanceNote: '초록으로 표시한 1·2위가 토너먼트에 올라가요.',
  noGroups: '추첨이 끝나면 조 편성과 순위가 여기에 나와요.',
  noBracket: '조별 예선이 끝나면 대진표가 나와요.',
  tbd: '미정',
  forfeit: '몰수',
  mineTag: '내 경기',
  pens: (p: { home: number; away: number }) => `승부차기 ${p.home}:${p.away}`,
  matchAria: (p: { home: string; away: string; hg: number; ag: number }) =>
    `${p.home} ${p.hg} 대 ${p.ag} ${p.away}, 경기 상세 보기`,
  teamsCount: (p: { n: number }) => `${p.n}팀`,
  // 경기 상세
  detailBack: '대회로 돌아가기',
  detailFail: '경기를 불러오지 못했어요.',
  detailRound: (p: { round: string; group: number | null }) =>
    p.group ? `${p.round} · ${p.group}조` : p.round,
  noGoals: '골이 없었어요.',
  assist: (p: { name: string }) => `도움 ${p.name}`,
  penWinner: (p: { team: string }) => `${p.team} 승부차기 승`,
  winner: (p: { team: string }) => `${p.team} 승`,
  draw: '무승부',
  forfeitNote: '한 팀이 나오지 못해 0:3 몰수패로 끝났어요.',
  // 팀 프로필 컵 기록
  honorsTitle: '컵 기록',
  honorResult: (p: { edition: number; stage: string }) =>
    `제${p.edition}회 오프사이드 컵 ${p.stage}`,
  honorTeam: (p: { team: string }) => `참가 팀 ${p.team}`,
  // 선수 만들기 리롤권
  rerollBtn: (p: { n: number }) => `후보 다시 뽑기 (리롤권 ${p.n}장)`,
  rerollBusy: '다시 뽑는 중…',
  rerollConfirm: (p: { n: number }) =>
    `리롤권 1장을 써서 후보 3명을 다시 뽑을까요? 지금 후보와 광고로 확인한 잠재력 범위는 사라지고, 리롤권은 ${p.n}장 남아요.`,
  rerollDone: (p: { n: number }) => `후보를 다시 뽑았어요. 리롤권 ${p.n}장 남았어요.`,
  rerollFail: '리롤권을 쓰지 못했어요.',
  // T-11-152 구단 자금으로 사는 리롤권
  shopTitle: '리롤권 상점',
  shopSub: '구단 자금으로 선수 후보 리롤권을 사요',
  shopSubHave: (p: { n: number }) => `가진 리롤권 ${p.n}장 · 구단 자금으로 더 살 수 있어요`,
  createShopHint: '리롤권이 없어요. 구단 자금으로 리롤권을 사면 후보를 다시 뽑을 수 있어요.',
  createShopGo: '리롤권 상점 가기',
  shopOpen: '열기',
  shopClose: '접기',
  shopHave: (p: { n: number }) => `가진 리롤권 ${p.n}장`,
  shopFunds: (p: { funds: string }) => `구단 자금 ${p.funds}`,
  shopPrice: (p: { price: string }) => `다음 한 장 ${p.price}`,
  shopToday: (p: { bought: number; cap: number }) => `오늘 ${p.bought}/${p.cap}장`,
  shopNote:
    '같은 날 더 살수록 비싸져요. 매일 0시(한국 시간)에 가격과 횟수가 처음으로 돌아가요. 리롤권은 새 선수를 만들 때 후보 선택 화면에서 써요.',
  shopBuy: (p: { price: string }) => `${p.price}에 사기`,
  shopBusy: '사는 중…',
  shopSoldOut: '오늘 살 수 있는 만큼 다 샀어요. 내일 0시(한국 시간)에 다시 살 수 있어요.',
  shopClosed: '지금은 리롤권을 팔지 않아요.',
  shopShort: '구단 자금이 모자라요.',
  shopConfirm: (p: { price: string; balance: string }) =>
    `리롤권 1장을 ${p.price}에 살까요? 산 뒤 구단 자금은 ${p.balance} 남고, 되돌릴 수 없어요.`,
  shopDone: (p: { n: number }) => `리롤권을 샀어요. 이제 ${p.n}장 있어요.`,
  shopFail: '리롤권을 사지 못했어요.',
  shopLoadFail: '상점을 불러오지 못했어요.',
};

export type CupMsgs = typeof ko;
export const cupText = ns('cup', ko);
