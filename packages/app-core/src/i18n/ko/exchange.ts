// T-11-374 카드 바치기 과제(웹 owner/CardExchange.svelte · 앱 screens/owner/CardExchange.tsx). 웹 · 앱이 키를 같이 쓴다.
import { ns } from '../core';

const ko = {
  // 내 구단 화면 진입 카드
  entryTitle: '카드 과제',
  entrySub: '쓰지 않는 은퇴 선수를 내고 아이템을 받아요',
  entryAria: '카드 과제 열기',
  entryNew: 'NEW',
  title: '카드 과제',
  lead: '조건에 맞는 은퇴 선수를 내면 그 카드는 사라지고 아이템을 받아요. 과제는 매주 월요일 0시(한국 시간)에 바뀌어요.',
  close: '닫기',
  back: '과제 목록',
  loading: '불러오는 중이에요…',
  loadFail: '카드 과제를 불러오지 못했어요.',
  retry: '다시 시도',
  // 난이도
  tierEasy: '쉬움',
  tierNormal: '보통',
  tierHard: '어려움',
  tierSeason: '시즌 과제',
  // 과제 이름
  nameKeepers: '수문장 모집',
  nameMidWorkers: '중원의 일꾼',
  nameBackline: '수비진 정리',
  nameFounders: '프리시즌의 기억',
  nameStrikers: '공격진 정리',
  nameLeftFoot: '왼발잡이 모임',
  nameNationalCall: '국가대표 소집',
  nameSpine: '팀의 척추',
  nameFrontLine: '공격 라인',
  nameVeterans: '베테랑 모임',
  nameBestEleven: '베스트 일레븐',
  nameLegendGift: '레전드의 선물',
  nameOneNation: '한 나라 일레븐',
  nameLegacy: '시즌의 유산',
  // 조건
  condCount: (p: { n: number }) => `선수 ${p.n}명`,
  condPos: (p: { list: string }) => `${p.list}만`,
  condShape: (p: { list: string }) => `포지션 ${p.list}`,
  condPeakRange: (p: { min: number; max: number }) => `최고 OVR ${p.min}~${p.max}`,
  condPeakMin: (p: { n: number }) => `최고 OVR ${p.n} 이상`,
  condPeakMax: (p: { n: number }) => `최고 OVR ${p.n} 이하`,
  condAvgPeak: (p: { n: number }) => `평균 최고 OVR ${p.n} 이상`,
  condSameNation: '모두 같은 국적',
  condLegendOne: (p: { n: number }) => `레전드 점수 ${p.n} 이상 1명 포함`,
  condSeasons: (p: { list: string }) => `${p.list} 선수만`,
  seasonPre: '프리시즌',
  seasonN: (p: { n: number }) => `시즌 ${p.n}`,
  condFootLeft: '왼발잡이만',
  condFootRight: '오른발잡이만',
  condFootBoth: '양발잡이만',
  // 보상
  rewardReroll: (p: { n: number }) => `리롤권 ${p.n}장`,
  rewardBoost: (p: { n: number }) => `잠재력 강화권 ${p.n}장`,
  rewardScout: (p: { n: number }) => `프리미엄 스카우트권 ${p.n}장`,
  reward: '보상',
  // 횟수 · 기한
  left: (p: { left: number; max: number }) => `남은 횟수 ${p.left}/${p.max}`,
  allDone: '이번 주에는 다 냈어요',
  seasonDone: '이번 시즌에는 다 냈어요',
  endsIn: (p: { d: number; h: number }) =>
    p.d > 0 ? `${p.d}일 ${p.h}시간 남음` : `${p.h}시간 남음`,
  seasonEnds: '시즌 마감까지',
  // 고르기
  pick: '선수 고르기',
  picked: (p: { n: number; need: number }) => `${p.n}/${p.need}명 골랐어요`,
  autoFill: '맞는 선수로 채우기',
  autoFillNone: '조건을 채울 선수가 모자라요.',
  clear: '모두 빼기',
  submit: '카드 내기',
  noCards: '낼 수 있는 은퇴 선수가 없어요.',
  lockLocked: '잠김',
  lockListed: '판매 중',
  lockStarter: '선발',
  lockNotFit: '조건 밖',
  cardLine: (p: { pos: string; peak: number }) => `${p.pos} · 최고 OVR ${p.peak}`,
  bought: '영입',
  // 확인 · 결과
  confirmTitle: '카드를 낼까요?',
  confirmBody: (p: { n: number }) =>
    `선수 ${p.n}명의 카드가 사라지고 돌아오지 않아요. 명예의 전당과 은퇴 기록은 그대로 남아요.`,
  confirmRaised: (p: { n: number }) =>
    `직접 키운 선수 ${p.n}명은 방출하면 받을 수 있던 자금을 받지 않아요.`,
  confirmValue: (p: { value: string }) => `카드 가치 합 ${p.value}`,
  confirmOk: '내기',
  cancel: '취소',
  doneTitle: '과제를 마쳤어요',
  doneBody: (p: { reward: string }) => `받은 보상: ${p.reward}`,
  doneTitleEarned: (p: { name: string }) => `새 칭호: ${p.name}`,
  claimFail: '카드를 내지 못했어요.',
  ok: '확인',
};

export type ExchangeMsgs = typeof ko;
export const exchangeText = ns('exchange', ko);
