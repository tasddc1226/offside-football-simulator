// 이적시장(웹 ui/Market.svelte · 앱 screens/owner/Market.tsx) 화면 문구와, 그리기 전에 만드는 문구(market.ts).
// 웹·앱이 같은 문구라 키를 함께 쓴다. 다른 줄만 Web/App 접미사로 나눈다.
import { ns } from '../core';
import { withEulReul } from '../../format.js';

const ko = {
  title: '이적시장',
  // 머리
  funds: '구단 자금',
  // T-11-442 결제 버튼으로 읽히지 않게 방출로 만든다는 걸 이름에 담는다.
  makeFunds: '방출해서 자금 만들기',
  guestHero: '로그인하면 구단주가 되어 구단 자금으로 선수를 사고팔 수 있어요.',
  statClubValue: '구단 가치',
  statBuysToday: '오늘 영입',
  statListed: '내놓은 선수',
  loading: '불러오는 중…',
  close: '닫기',
  position: '포지션',
  // 탭 · 정렬
  menu: '이적시장 메뉴',
  tabBuy: '선수 사기',
  tabSell: '팔기',
  tabTrades: '내 거래',
  sortNew: '최신 등록 순',
  sortPrice: '가격 낮은 순',
  sortOvr: 'OVR 높은 순',
  sortLabel: '정렬',
  posAll: '전체',
  // T-11-474 세부 필터(명예의 전당처럼 포지션군을 고르면 열린다)
  detailPos: '세부 포지션',
  playerType: '유형',
  filterReset: '필터 초기화',
  listCount: (p: { n: number; more: boolean }) => `선수 ${p.n}${p.more ? '+' : ''}명`,
  // 기준가 대비
  priceSame: '기준가',
  priceUp: (p: { d: number }) => `기준가 +${p.d}%`,
  priceDown: (p: { d: number }) => `기준가 −${p.d}%`,
  // 선수 사기
  justSold: '방금 이적',
  liveAll: (p: { n: number }) => `방금 이적 ${p.n}건 모두 보기`,
  liveBase: (p: { ago: string; value: string }) => `${p.ago} · 기준가 ${p.value}`,
  saleLine: (p: { name: string; pos: string; peak: number; price: string }) =>
    `${p.name} ${p.pos} ${p.peak} · ${p.price}에 이적`,
  myListing: '내 등록',
  openListing: (p: { name: string }) => `${p.name} 영입 보기`,
  cardMeta: (p: { score: string; transfers: number }) =>
    `레전드 ${p.score} · 이적 ${p.transfers}회`,
  pastCardMeta: (p: { season: string; salary: number; meta: string }) =>
    `${p.season} · 급여 ${p.salary} · ${p.meta}`,
  listFailed: '시장을 불러오지 못했어요.',
  reload: '다시 불러오기',
  more: '더 보기',
  emptyClosed: '지금은 시즌 사이 휴식기라 이적시장이 닫혀 있어요.',
  emptyFiltered: '이 조건에 맞는 선수가 아직 없어요.',
  empty: '아직 시장에 나온 선수가 없어요. 구단주가 선수를 내놓으면 여기에 올라와요.',
  // 영입 시트
  sheetBuy: '선수 영입',
  detailLegend: '레전드 점수',
  detailTransfers: '이적',
  transferTimes: (p: { n: number }) => `${p.n}회`,
  buyTitle: '이 선수를 영입할까요?',
  loginTitle: '로그인하고 영입하기',
  loginToBuy: '로그인하면 구단주가 되어 이 선수를 영입할 수 있어요.',
  baseLine: '기준가 (최고 OVR 시즌 몸값)',
  price: '판매가',
  fundsNow: '지금 구단 자금',
  fundsAfter: '영입 뒤 남는 자금',
  notEnough: '모자라요',
  buyNote:
    '영입한 선수는 바로 팀에 넣을 수 있어요. 다시 팔 수는 있지만 방출해서 자금으로 바꿀 수는 없어요.',
  ownListing: '내가 내놓은 선수예요.',
  buyShort: (p: { short: string }) =>
    `구단 자금이 ${p.short} 모자라요. 직접 키운 선수를 방출하면 자금이 생겨요.`,
  unlist: '판매 내리기',
  buyFor: (p: { price: string }) => `${p.price}에 영입하기`,
  // T-11-434 영입 · 판매 내리기가 낡은 매물이라 실패한 뒤
  priceMoved: (p: { price: string }) => `가격이 ${p.price}으로 바뀌었어요. 다시 확인해 주세요.`,
  staleGone: '이미 팔렸거나 내려간 선수예요.',
  staleRecheck: '가격이 바뀐 선수예요. 목록에서 다시 확인해 주세요.',
  // 팔기
  sellStep1: '1. 내놓을 선수',
  sellNone: '아직 내 선수 카드가 없어요. 선수가 은퇴하거나 영입하면 여기에 나와요.',
  sellStartersHidden: '선발 선수는 팀에서 뺀 뒤 내놓을 수 있어요.',
  sellSelected: '선택',
  sellPickLabel: (p: { name: string }) => `${p.name} 내놓을 선수로 고르기`,
  sellStep2: (p: { name: string; pos: string; peak: number }) =>
    `2. 가격 정하기 · ${p.name} ${p.pos} ${p.peak}`,
  presetBase: '기준가 그대로',
  presetCustom: '직접 정하기',
  presetSlider: '슬라이더로',
  sliderLabelWeb: '기준가 대비 판매가(%)',
  sliderLabelApp: '기준가 대비 판매가',
  fee: (p: { pct: number }) => `수수료 ${p.pct}%`,
  gets: '팔리면 받는 자금',
  sellHelp:
    '팔리기 전까지는 팀에서 계속 뛰어요. 팔리면 선발 자리는 유스 선수가 채워요. 언제든 내릴 수 있어요.',
  listFor: (p: { price: string }) => `${p.price}에 내놓기`,
  sellMin: (p: { value: string }) => `${p.value}부터 정할 수 있어요.`,
  sellMax: (p: { value: string }) => `${p.value}까지 정할 수 있어요.`,
  noteListed: '판매 중',
  noteNoValue: '기준가 없음',
  noteLocked: '잠김',
  // 내 거래
  tradesListed: '내놓은 선수',
  listedAgo: (p: { price: string; ago: string }) => `${p.price} · ${p.ago} 등록`,
  unlistBtn: '내리기',
  noListed: '내놓은 선수가 없어요.',
  tradeSold: '판매',
  tradeBought: '영입',
  tradeReleased: '방출',
  // T-11-153 자금 내역의 구단 자금 사용(리롤권 · 광고 대신 받은 보상).
  tradeSpent: '사용',
  tradeBonus: '장려금',
  spendReroll: '리롤권 구매',
  spendScout: '프리미엄 스카우트권 구매',
  spendCandidates: '후보 잠재력 보기',
  spendPeek: '시즌 평가 보기',
  spendBoost: '잠재력 강화',
  // 방출
  releasePane: '방출해서 자금 만들기',
  backToMarket: '이적시장으로',
  releaseIntro:
    '직접 키운 선수를 내보내면 카드 기준가만큼 구단 자금이 생겨요. 명예의 전당 기록은 그대로 남아요.',
  seasonGroup: '시즌',
  seasonChip: (p: { name: string }) => `${p.name} 선수`,
  pickAll: '전체 선택',
  pickNone: '선택 해제',
  pickAllMax: (p: { n: number }) => `최대 ${p.n}명 선택`,
  pickLimit: (p: { n: number }) => `한 번에 ${p.n}명까지 방출할 수 있어요.`,
  playersFailed: '내 선수를 불러오지 못했어요.',
  // T-11-442 로그인 전에 팔기 · 내 거래 · 방출을 열면
  guestSell: '로그인하면 직접 키운 선수를 이적시장에 내놓을 수 있어요.',
  guestTrades: '로그인하면 내놓은 선수와 구단 자금 내역을 여기서 볼 수 있어요.',
  guestRelease: '로그인하면 직접 키운 선수를 방출해서 구단 자금을 만들 수 있어요.',
  releasePickLabel: (p: { name: string }) => `${p.name} 방출할 선수로 고르기`,
  releaseInfo: (p: { score: string }) => `레전드 ${p.score} · 방출하면 받는 자금`,
  /** T-11-443 내 선수 방출 목록 한 줄(포지션 · 최고 OVR · 레전드)과 방출하면 받는 자금. */
  releaseRowInfo: (p: { pos: string; peak: number; score: string }) =>
    `${p.pos} · 최고 OVR ${p.peak} · 레전드 ${p.score}`,
  releaseGets: (p: { amount: string }) => `방출하면 받는 자금 ${p.amount}`,
  noRetired: (p: { season: string }) => `${p.season}에 은퇴한 내 선수가 없어요.`,
  dockLabel: '방출 확인',
  dockSum: (p: { n: number }) => `${p.n}명 방출 · 받는 자금`,
  dockWarn: '방출한 선수는 다시 데려올 수 없어요.',
  releaseBtn: (p: { n: number }) => `${p.n}명 방출하기`,
  sheetRelease: '선수 방출',
  releaseConfirm: (p: { count: number; amount: string }) =>
    `${p.count}명을 방출하고 구단 자금 ${withEulReul(p.amount)} 받아요. 방출한 선수는 다시 데려올 수 없어요. 명예의 전당 기록은 그대로 남아요.`,
  lockBought: '영입한 선수는 방출할 수 없어요',
  lockListed: '판매 중이에요. 내린 뒤 방출할 수 있어요',
  lockStarter: '선발이에요. 팀에서 뺀 뒤 방출할 수 있어요',
  lockPlayerLocked: '잠긴 선수예요',
  playerUnlock: '잠금 풀기',
  // 알림
  toastListed: '시장에 내놓았어요.',
  toastUnlocked: '잠금을 풀었어요.',
  toastLocked: '선수를 잠갔어요. 이적시장에 내놓거나 방출할 수 없어요.',
  toastUnlisted: '판매를 내렸어요.',
  toastBought: '선수를 영입했어요.',
  toastReleased: (p: { n: number }) => `${p.n}명을 방출했어요.`,
  // T-11-500 국적 · 팀으로 찾기
  findOpen: '국적 · 팀',
  findTitle: '국적 · 팀으로 찾기',
  findClose: '닫기',
  findTabNation: '국적',
  findTabNationOn: (p: { name: string }) => `국적 · ${p.name}`,
  findTabTeam: '팀',
  findTabTeamOn: (p: { name: string }) => `팀 · ${p.name}`,
  findNationSearch: '국적 이름',
  findTeamSearch: '리그 · 클럽 이름',
  findNationCaption: (p: { n: number }) => `매물이 있는 국적 ${p.n}개 · 매물 많은 순`,
  findLeagueCaption: '리그 · 가장 오래 뛴 리그',
  findClubCaption: '클럽 · 가장 오래 뛴 클럽',
  findLeagueAll: (p: { name: string }) => `${p.name} 전체로 보기`,
  findClearNation: '국적 지우기',
  findClearTeam: '팀 지우기',
  findRemove: (p: { name: string }) => `${p.name} 필터 지우기`,
  findNone: '맞는 국적 · 팀이 없어요.',
  findFailed: '고를 목록을 불러오지 못했어요.',
  findCount: (p: { n: number }) => `매물 ${p.n}건`,
};

export type MarketMsgs = typeof ko;
export const marketText = ns('market', ko);
