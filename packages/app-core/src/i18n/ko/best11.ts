// T-11-463 시즌 BEST 11(웹 Best11.svelte, 앱 screens/hof/Best11.tsx). 자리 이름은 세부 포지션 이름(DETAIL_LABEL)을 tn()으로 옮긴다.
import { ns } from '../core';

const ko = {
  tab: 'BEST 11',
  title: (p: { season: string }) => `${p.season} BEST 11`,
  seasonAria: 'BEST 11 시즌',
  lead: '시즌마다 포지션별로 가장 빛난 은퇴 선수 11명을 그라운드에 세워요.',
  provisional: '잠정',
  final: '확정',
  provisionalUntil: (p: { when: string }) =>
    `시즌 중에는 은퇴 선수가 나올 때마다 자리 주인이 바뀌어요. ${p.when}(한국 시간)에 확정돼요.`,
  provisionalOpen:
    '시즌 중에는 은퇴 선수가 나올 때마다 자리 주인이 바뀌어요. 시즌 마감 때 확정돼요.',
  finalAt: (p: { day: string }) => `${p.day}에 확정된 명단이에요.`,
  updated: (p: { when: string }) => `${p.when} 갱신`,
  loadFailed: 'BEST 11을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  empty: '아직 BEST 11 자격을 채운 은퇴 선수가 없어요.',
  emptySlot: '빈자리',
  slotAria: (p: { slot: string; name: string; index: string }) =>
    `${p.slot} · ${p.name} · BEST 11 지수 ${p.index}`,
  emptySlotAria: (p: { slot: string }) => `${p.slot} · 빈자리`,
  pitchAria: 'BEST 11 그라운드',
  pickHint: '자리를 누르면 선정 이유와 그 자리 순위가 보여요.',
  // 선수 카드
  index: 'BEST 11 지수',
  pillarInd: '개인 활약',
  pillarTeam: '팀 성과',
  pillarAward: '개인 수상',
  reasonTitle: '선정 이유',
  reasonPrime: (p: { rating: string; apps: number }) =>
    `전성기 5시즌 평점 ${p.rating} · 프로 ${p.apps}경기`,
  leagues: (p: { n: number }) => `리그 우승 ${p.n}회`,
  ucl: (p: { n: number }) => `챔스 ${p.n}회`,
  wc: (p: { n: number }) => `월드컵 ${p.n}회`,
  noTeam: '팀 우승 없음',
  ballon: (p: { n: number }) => `발롱도르 ${p.n}회`,
  fifpro: (p: { n: number }) => `FIFPRO 월드 11 ${p.n}회`,
  posAwards: (p: { n: number }) => `포지션 상 ${p.n}회`,
  noAward: '개인 수상 없음',
  since: (p: { when: string }) => `${p.when}부터 이 자리`,
  openPlayer: '선수 기록 보기',
  // 자리 순위
  rankTitle: (p: { slot: string }) => `${p.slot} 순위`,
  rankLead: '지수 상위 10명이에요. 한 구단주는 한 자리만 차지해요.',
  cutline: (p: { index: string }) => `지금 커트라인 ${p.index}`,
  heldXi: (p: { slot: string }) => `BEST 11 ${p.slot}`,
  heldOwner: '같은 구단주',
  heldOwnerNote: '같은 구단주의 다른 선수가 BEST 11에 있어 빠졌어요.',
  rankEmpty: '이 자리 후보가 아직 없어요.',
  // 자리 변화
  changesTitle: '최근 자리 변화',
  changeIn: (p: { slot: string; name: string; out: string }) => `${p.slot} ${p.out} → ${p.name}`,
  changeFirst: (p: { slot: string; name: string }) => `${p.slot} 첫 주인 ${p.name}`,
  changeOut: (p: { slot: string; out: string }) => `${p.slot} ${p.out} 빠짐`,
  hiddenName: '비공개 선수',
  // 선정 기준
  criteriaTitle: '선정 기준',
  criteria1:
    '그 시즌에 은퇴한 공개 이름 선수 중 프로 300경기, 20경기 이상 뛴 시즌 5개를 채운 선수가 후보예요.',
  criteria2:
    'BEST 11 지수는 개인 활약 50 · 팀 성과 30 · 개인 수상 20이에요. 기둥마다 그 자리 1위를 100으로 봐요.',
  criteria3: '개인 활약은 전성기 5시즌 평점과 포지션 기록이고, 뛴 리그의 수준을 반영해요.',
  criteria4: '개인 수상은 시즌마다 큰 상 3개까지 세고, 자기 포지션 상은 2배로 쳐요.',
  criteria5:
    '한 구단주는 한 자리만 차지해요. 지수가 같으면 개인 활약, 개인 수상, 먼저 은퇴한 순이에요.',
};

export type Best11Msgs = typeof ko;
export const best11Text = ns('best11', ko);
