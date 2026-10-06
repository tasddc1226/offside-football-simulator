// 커리어 탭 문구(웹 tabs/CareerTab.svelte · 앱 components/CareerTab.tsx)와 코치 메모·이적 평가(app-core career-feedback.ts).
// 이정표·수상·소속·리그 이름과 '다음 목표' 이름은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  totalsTitle: '통산 기록',
  apps: '경기',
  goals: '골',
  assists: '도움',
  cleanSheets: '무실점',
  awards: '수상',
  peakValue: '최고 몸값',
  goalsTitle: '다음 목표',
  goalsNote: '출전·골·도움은 마친 시즌 기준이에요. 대표팀 출전과 우승도 커리어에 남아요.',
  goalLine: (p: { have: number; target: number; remaining: number }) =>
    `${p.have} / ${p.target} · 남은 ${p.remaining}`,
  clubApps: (p: { club: string; target: number }) => `${p.club}에서 ${p.target}경기 출전`,
  retiredNumber: (p: { n: number }) =>
    `한 구단에서 오래 활약하고 은퇴하면 그 구단의 ${p.n}번이 영구결번될 수 있어요.`,
  // 시즌별 기록 표
  colSeason: '시즌',
  colClub: '소속',
  colRating: '평점',
  colRank: '순위',
  seasonValue: (p: { value: string }) => `몸값 ${p.value}`,
  emptyRecords: '첫 시즌을 마치면 기록이 쌓여요.',
  recordsNote:
    '경기·골·도움은 리그·컵·대륙 대회를 합친 공식전 기록이에요. 몸값은 시즌을 마친 때의 리그·OVR·나이로 매긴 이적료 기준 추정치예요.',
  journeyTitle: '커리어 이정표',
  emptyJourney: '프로 데뷔부터 이정표가 쌓여요.',
  // 코치 메모(career-feedback.ts)
  coachNoStart: '이번 시즌 시작 능력치 기록이 없어요.',
  coachOvr: (p: { from: number; to: number }) => `이번 시즌 OVR ${p.from} → ${p.to}.`,
  coachNoChange: '아직 표시할 능력치 변화가 없어요.',
  coachServing: '군 복무 중이에요. 복무를 마치면 구단에서의 훈련과 출전을 다시 준비해요.',
  coachInjured: (p: { n: number }) =>
    `부상으로 ${p.n}경기 결장이 남았어요. 회복 상태를 먼저 확인해요.`,
  coachLowCond: '컨디션이 낮아 부상 위험이 커졌어요. 휴식·회복은 출전 준비에 도움이 돼요.',
  coachLowMorale:
    '사기가 낮으면 같은 능력치 훈련에서도 성장이 줄어요. 휴식·회복으로 사기를 회복할 수 있어요.',
  coachLopsided: (p: { attr: string }) =>
    `${p.attr}이 다른 핵심 능력치보다 앞서 있어 이 능력치의 훈련 성장이 줄어요. 다른 핵심 능력치를 보완해 주세요.`,
  coachRounded: 'OVR은 반올림한 종합 수치예요. OVR이 같아도 세부 능력치는 달라질 수 있어요.',
  coachDisclaimer: '이 메모만으로 성장 정체의 원인이나 한계를 단정할 수는 없어요.',
  // 이적 시장 평가
  marketAssess: (p: { ovr: number; rating: string | null; fame: number; age: number }) =>
    `현재 OVR ${p.ovr} · ${p.rating === null ? '' : `지난 시즌 평점 ${p.rating} · `}인기 ${p.fame} · ${p.age}세. 구단은 기량·지난 시즌 평점·인기·나이를 함께 봐요. 리그 조건과 스카우트·에이전트 이벤트도 제의에 영향을 줘요. 좋은 활약이 특정 구단의 제의를 보장하지는 않아요.`,
  offerAssess: (p: { ovr: number; str: number | string; role: string }) =>
    `현재 OVR ${p.ovr} · 팀 전력 ${p.str}. 제시된 출전 조건은 ${p.role || '별도 안내 없음'}이에요. 실제 출전은 컨디션·부상·감독 신뢰 등에 따라 달라져요.`,
};

export type GameCareerMsgs = typeof ko;
export const gameCareerText = ns('gameCareer', ko);
