// 이적시장(웹 ui/Market.svelte · 앱 screens/owner/Market.tsx) 화면 문구와, 그리기 전에 만드는 문구(market.ts).
// 웹·앱이 같은 문구라 키를 함께 쓴다. 다른 줄만 Web/App 접미사로 나눈다.
import { ns } from '../core';
import { withEulReul } from '../../format.js';

const ko = {
  title: '이적시장',
  // 머리
  funds: '구단 자금',
  makeFunds: '자금 만들기',
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
  sortLabel: '정렬',
  posAll: '전체',
  seasonCount: (p: { n: number; more: boolean }) => `이번 시즌 선수 ${p.n}${p.more ? '+' : ''}명`,
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
  listFailed: '시장을 불러오지 못했어요.',
  reload: '다시 불러오기',
  more: '더 보기',
  emptyClosed: '지금은 시즌 사이 휴식기라 이적시장이 닫혀 있어요.',
  emptyFiltered: '이 포지션에는 아직 나온 선수가 없어요.',
  empty: '아직 시장에 나온 선수가 없어요. 이번 시즌에 은퇴한 선수가 나오면 여기에 올라와요.',
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
  buyLimit: '오늘 영입 횟수를 다 썼어요. 내일 다시 영입할 수 있어요.',
  buyShort: (p: { short: string }) =>
    `구단 자금이 ${p.short} 모자라요. 직접 키운 선수를 방출하면 자금이 생겨요.`,
  unlist: '판매 내리기',
  buyFor: (p: { price: string }) => `${p.price}에 영입하기`,
  // 팔기
  sellStep1: '1. 내놓을 선수',
  sellSeasonOnly: (p: { season: string }) => `(${p.season} 선수만)`,
  thisSeason: '이번 시즌',
  sellNone:
    '이번 시즌에 은퇴한 내 선수가 없어요. 지난 시즌 선수는 방출해서 자금으로 바꿀 수 있어요.',
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
  noteStarter: '선발',
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
  playersFailed: '내 선수를 불러오지 못했어요.',
  releasePickLabel: (p: { name: string }) => `${p.name} 방출할 선수로 고르기`,
  releaseInfo: (p: { score: string }) => `레전드 ${p.score} · 기준가`,
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
  // 알림
  toastListed: '시장에 내놓았어요.',
  toastUnlisted: '판매를 내렸어요.',
  toastBought: '선수를 영입했어요.',
  toastReleased: (p: { n: number }) => `${p.n}명을 방출했어요.`,
};

export type MarketMsgs = typeof ko;
export const marketText = ns('market', ko);
