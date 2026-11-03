// 게임 진행 액션이 시트·리포트에 담는 문구(app-core game-actions.ts, 웹·앱 공용). 구간 이름·대회 단계·병역 결과·이벤트 본문 같은
// 게임이 만든 문구는 옮기지 않고 그대로 넘긴다. 금액은 부르는 쪽이 서식을 맞춰 문자열로 넘긴다.
import { ns } from '../core';
import { waGwa, withRo } from '../../format';

const ko = {
  eventLater: '잠시 닫기',
  // 대표팀 경기 줄
  natDetail: (p: { mins: number; g: number; a: number; rating: number | string | null }) =>
    `${p.mins}분${p.g ? ` ${p.g}골` : ''}${p.a ? ` ${p.a}도움` : ''} · 평점 ${p.rating}`,
  natBench: '벤치',
  // T-11-186 컵·대륙 대회 경기 줄
  compDetail: (p: { mins: number; g: number; a: number }) =>
    `${p.mins}분${p.g ? ` ${p.g}골` : ''}${p.a ? ` ${p.a}도움` : ''}`,
  compLeg: (p: { stage: string; leg: number }) => `${p.stage} ${p.leg}차전`,
  compLeagueGame: (p: { n: number; res: string }) => `리그 페이즈 ${p.n}경기 · ${p.res}`,
  compThrough: '통과',
  compOut: '탈락',
  /** T-11-261 녹아웃 상대 구단 */
  compVs: (p: { name: string }) => `vs ${p.name}`,
  natNotInSquad: '명단 외',
  natNoMedal: '메달 없음',
  natTourLine: (p: {
    stage: string;
    score: string;
    mins: number;
    g: number;
    a: number;
    rating: number | string | null;
  }) =>
    `${p.stage} · ${p.score}${p.mins ? ` · ${p.g ? p.g + '골 ' : ''}${p.a ? p.a + '도움 ' : ''}평점 ${p.rating}` : ''}`,
  // 구간 진행
  preseasonDone: '프리시즌 완료',
  phaseResult: (p: { phase: string }) => `${p.phase} 결과`,
  stepNat: 'A매치 소집 명단 발표',
  stepEvent: '새 소식이 들려와요…',
  phaseRunning: (p: { year: number; phase: string }) => `${p.year} · ${p.phase} 진행 중`,
  blockTitle: (p: { range: string; n: number }) => `${p.range} · ${p.n}경기`,
  preseasonRunning: (p: { year: number }) => `${p.year} · 프리시즌 진행 중`,
  stepCampPro: '전지훈련 캠프 입소',
  stepCampAmateur: '동계 훈련 시작',
  stepFitness: '체력 테스트',
  stepTactics: '전술 훈련',
  stepFriendly: '연습 경기',
  preseasonReady: '시즌 준비를 마쳤어요',
  // 시즌 결산 준비
  endRunning: (p: { year: number }) => `${p.year} · 시즌 결산 중`,
  endTable: '리그 최종 순위 확정',
  endTours: '국제 대회 결과 반영',
  endAwards: '시즌 시상식',
  endRecords: '커리어 기록 정리',
  // 이벤트 선택지·결과
  oddsSafe: '안전',
  oddsSafeHint: '결과는 확정이지만 보상이 줄고, 가끔 대가가 따라요',
  // T-11-432 판정 없이 결과가 정해진 선택지('확정'은 좋은 일처럼 읽혀 바꿨다). 확률은 결정적 장면과 같은 '성공 N%'.
  oddsSure: '판정 없음',
  oddsPct: (p: { p: number }) => `성공 ${p.p}%`,
  // T-11-432 선택지 득실 칩
  peekCond: '컨디션',
  peekMorale: '사기',
  peekFame: '인기',
  peekTrust: '신뢰',
  peekMoney: '자금',
  peekAttr: '능력치',
  peekPot: '잠재력',
  peekUp: (p: { label: string }) => `${p.label} ↑`,
  peekDown: (p: { label: string }) => `${p.label} ↓`,
  peekOut: '결장',
  peekStory: (p: { name: string }) => `${p.name} 시작`,
  peekFail: (p: { chip: string }) => `실패 시 ${p.chip}`,
  peekSafeCost: '가끔 대가',
  peekAria: (p: { chips: string }) => `득실 ${p.chips}`,
  oddsMinigame: (p: { zone: string }) => `원터치 · ${p.zone}`,
  oddsMinigameTerm: '원터치',
  oddsMinigameHint: '바늘이 초록 구간에 올 때 탭하면 성공해요. 구간 넓이는 능력치로 정해져요',
  outcomeOk: '성공',
  outcomeFail: '실패',
  outcomeDecided: '결정',
  ok: '확인',
  // 시즌 결산 시트
  colCs: '무실점',
  colAssists: '도움',
  seasonTitle: (p: { club: string; league: string; rank: number | string }) =>
    `${p.club} · ${p.league} ${p.rank}위`,
  compLine: (p: { name: string; stage: string; apps: number; g: number; a: number }) =>
    `${p.name} · ${p.stage} · ${p.apps}경기 ${p.g}골 ${p.a}도움`,
  toMarket: '이적 시장으로 →',
  // 이적 시장 시트
  strLine: (p: { league: string; str: number; avg: number }) =>
    `${p.league} · 팀 전력 ${p.str} (리그 평균 ${p.avg})`,
  feeAbout: (p: { fee: string }) => `이적료 약 ${p.fee}`,
  freeAgent: '자유계약(FA)',
  contractYears: (p: { years: number }) => `${p.years}년 계약`,
  renewExtension: (p: { ext: number; total: number; desc: string }) =>
    `1년 남음 · ${p.ext}년 연장 · 총 ${p.total}년. ${p.desc}`,
  retireAgeLimit: (p: { age: number }) => `은퇴는 ${p.age}세부터 할 수 있어요.`,
  retireBtn: '은퇴하기',
  // 계약서
  contractTitleExt: '연장 계약서에 사인할까요?',
  contractTitleRookie: '프로 계약서에 사인할까요?',
  loanSeason: '임대 1시즌',
  contractTitleLoan: '임대 계약서에 사인할까요?',
  contractTextLoan: (p: { club: string }) =>
    `${p.club}에서 한 시즌 뛰어요. 연봉과 남은 계약은 원소속 구단 그대로예요.`,
  ctaLoan: '사인하고 임대',
  contractTitleTransfer: '이적 계약서에 사인할까요?',
  contractTextExt: '남은 계약에 기간을 더해요. 새 연봉은 이번 시즌부터 적용돼요.',
  contractTextStart: (p: { club: string; rookie: boolean }) =>
    `${p.club}${waGwa(p.club)} 함께 ${p.rookie ? '첫 프로 시즌을' : '새 시즌을'} 시작해요.`,
  termSalary: '연봉',
  termLeft: '남은 계약',
  termLeftValue: '1년',
  termExtra: '추가 연장',
  termTotal: '총 계약 기간',
  termPeriod: '계약 기간',
  termYears: (p: { n: number }) => `${p.n}년`,
  termFee: '이적료',
  termFeeValue: (p: { fee: string }) => `약 ${p.fee}`,
  termRole: '역할',
  ctaExt: '사인하고 계약 연장',
  ctaRookie: '사인하고 프로 입단',
  ctaTransfer: '사인하고 이적',
  // 이적 비행
  flyingTo: (p: { city: string }) => `${withRo(p.city)} 날아가는 중`,
  flightSub: (p: { country: string; league: string; hours: number }) =>
    `${p.country} · ${p.league} · 약 ${p.hours}시간 비행`,
  // 병역·시즌 시작
  milEyebrow: '병역',
  milServe: '복무',
  milPass: '합격',
  milDecided: '결정',
  startSeasonBtn: (p: { year: number }) => `${p.year} 시즌 시작 →`,
  startSeasonToast: (p: { year: number }) => `${p.year} 시즌 시작!`,
  // 새 커리어 · 은퇴 확인
  newTitle: '새로 시작할까요?',
  newText: (p: { name: string }) =>
    `새 선수로 킥오프하면 ${p.name} 선수의 커리어는 사라져요. 만들기를 취소하면 이어서 할 수 있어요. 명예의 전당에는 은퇴한 선수만 남아요.`,
  newBtn: '새 커리어 시작',
  cancel: '취소',
  retireTitle: '정말 은퇴하시겠어요?',
  retireTextHof: '은퇴하면 이 선수의 커리어는 명예의 전당에 기록되고, 더 이상 플레이할 수 없어요.',
  retireTextShort: (p: { note: string }) => `은퇴하면 더 이상 플레이할 수 없어요. ${p.note}`,
  retireYes: '은퇴한다',
  retireStay: '조금 더 뛴다',
  careerStartToast: '고교 마지막 시즌이 시작돼요',
  // T-11-431 되돌릴 수 없는 진로 확인
  pathUniTitle: '대학에 진학할까요?',
  pathUniText:
    '받은 프로 입단 제의는 모두 사라지고 대학리그에서 뛰어요. 4학년을 마치기 전까지 프로에 다시 도전할 수 있어요. 진학하면 되돌릴 수 없어요.',
  pathUniCta: '대학 진학',
  pathSangmuTitle: '상무에 지원할까요?',
  pathSangmuText: (p: { pct: number; abroad: boolean; fail: 'army' | 'market' | 'stay' }) =>
    `합격 확률은 ${p.pct}%예요. 합격하면 김천 상무에서 2시즌 복무하며 K리그1에 나가요.${p.abroad ? ' 해외 구단과의 계약은 해지돼요.' : ' 전역하면 원소속팀으로 돌아와요.'} 불합격하면 ${p.fail === 'army' ? '바로 현역으로 입대해요' : p.fail === 'market' ? '이적 시장에서 새 팀을 찾아요' : '지금 팀에 남아요'}. 지원하면 되돌릴 수 없어요.`,
  pathSangmuCta: '상무 지원',
  pathArmyTitle: '현역으로 입대할까요?',
  pathArmyText: (p: { abroad: boolean }) =>
    `18개월 동안 복무해요. 2시즌 동안 공식전에 나갈 수 없고 능력치와 인지도가 떨어져요.${p.abroad ? ' 해외 구단과의 계약은 해지돼요.' : ''} 입대하면 되돌릴 수 없어요.`,
  pathArmyCta: '현역 입대',
  pathBack: '다시 고르기',
};

export type GameActionsMsgs = typeof ko;
export const gameActionsText = ns('gameActions', ko);
