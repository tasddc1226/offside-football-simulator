// 팀 화면이 같이 쓰는 문구(app-core teamText · teamOwner). 웹·앱 공용.
import { ns } from '../core';

const ko = {
  // 전적 · 경기 결과
  record: (p: { w: number; d: number; l: number }) => `${p.w}승 ${p.d}무 ${p.l}패`,
  outWin: '승',
  outDraw: '무',
  outLoss: '패',
  titleWin: '승리',
  titleDraw: '무승부',
  titleLoss: '패배',
  // 선수 고르기 정렬
  sortFit: '자리 실력',
  sortScore: '레전드 점수',
  sortPeak: '최고 OVR',
  attrEstimated: '추정 능력치 · ',
  // 경기를 못 하는 이유
  hintNoTeam: '팀을 저장하면 경기할 수 있어요.',
  hintDirty: '바꾼 편성을 저장해야 경기할 수 있어요.',
  hintNoStarters: '은퇴 선수를 한 명 이상 넣어야 경기할 수 있어요.',
  hintNoMatches: '오늘 경기는 모두 치렀어요. 한국 시각 자정에 다시 열려요.',
  hintRest: '시즌 사이 휴식기예요. 다음 시즌이 열리면 경기할 수 있어요.',
  hintPast: '지난 시즌 팀은 보기만 할 수 있어요. 지금 시즌을 고르면 경기할 수 있어요.',
  // 업적 표기
  achOneClubHint:
    '직접 키운 선수 은퇴 후 판정해요. 총 프로 10시즌 이상, 일반 구단은 한 곳이어야 해요. 상무·현역 복무는 구단 수에서 제외해요.',
  achLongServiceHint:
    '직접 키운 선수 은퇴 후 판정해요. 한 일반 구단에서 누적 10시즌 이상이어야 해요. 이적 후 복귀는 합산하고 상무·현역 복무 기간은 제외해요.',
  achTeamFitHint: '유스 선수 없이 11명 모두 적합도 1.00이어야 해요',
  achLevel: (p: { level: number; cur: string }) => `${p.level}단계 · ${p.cur}`,
  achNext: (p: { next: string }) => ` · NEXT ${p.next}`,
  achMaxLevel: ' · 최고 단계',
  achDone: '달성 완료',
  achUndone: '미달성',
  achMissing: (p: { names: string }) => `남은 것: ${p.names}`,
  achUndoneHint: (p: { hint: string }) => `미달성 · ${p.hint}`,
  achPointsGot: (p: { n: string }) => `+${p.n}점`,
  achPointsWorth: (p: { n: string }) => `${p.n}점`,
  achRankNone: '업적을 하나 달성하면 랭킹에 올라요',
  achRank: (p: { rank: string; ranked: string }) => `${p.rank}위 · ${p.ranked}명 중`,
  achCatPlayer: '선수 업적',
  achCatTeam: '팀 업적',
  achCatOwner: '구단주 업적',
  achCatManager: '감독 업적',
  achCatShortPlayer: '선수',
  achCatShortTeam: '팀',
  achCatShortOwner: '구단주',
  achCatShortManager: '감독',
  gradeRookie: '루키',
  gradeBronze: '브론즈',
  gradeSilver: '실버',
  gradeGold: '골드',
  gradePlatinum: '플래티넘',
  gradeDiamond: '다이아',
  gradeLegend: '레전드',
  preseasonTeamNote:
    '프리시즌에 키운 선수 중 지금 가진 선수로 꾸려요. 이 팀은 친구와 하는 친선전에만 나가고, 프리시즌 랭킹과 업적은 그대로예요.',
  hintPreseason: '프리시즌 팀은 친구와 하는 친선전에만 나가요. 랭크 경기는 지금 시즌 팀으로 해요.',
  wildcardLabel: (p: { n: number; max: number }) => `와일드카드 ${p.n}/${p.max}`,
  wildcardFull: (p: { max: number }) => `지난 시즌 선수는 선발에 ${p.max}명까지 넣을 수 있어요.`,
};

export type TeamCoreMsgs = typeof ko;
export const teamCoreText = ns('teamCore', ko);
