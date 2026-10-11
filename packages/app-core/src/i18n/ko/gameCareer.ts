// 커리어 탭 문구(웹 tabs/CareerTab.svelte · 앱 components/CareerTab.tsx)와 코치 메모·이적 평가(app-core career-feedback.ts).
// 이정표·수상·소속·리그 이름과 '다음 목표' 이름은 게임이 만든 문구라 옮기지 않는다.
import { ns } from '../core';

const ko = {
  rnTitle: '영구결번 도전',
  rnIntro: '오래 뛴 구단에 이 번호를 남길 수 있을까요?',
  rnLoading: '시즌 기록을 확인하고 있어요.',
  rnRetry: '다시 확인',
  rnError: '기록을 불러오지 못했어요. 연결과 기록 동기화 상태를 확인해 주세요.',
  rnEmpty:
    '프로 구단에서 시즌을 마치면 구단별 도전 현황이 쌓여요. 고교·대학·군 복무 시즌은 제외돼요.',
  rnBasis: '서버에 저장된 시즌 기록 기준이에요. 진행 중인 시즌은 포함하지 않아요.',
  rnSyncing: '이 기기의 시즌 기록이 아직 모두 반영되지 않았어요. 동기화 후 다시 확인해 주세요.',
  rnScope: (p: { season: number; number: number }) =>
    `${p.season === 0 ? '프리시즌' : `시즌 ${p.season}`} · 등번호 ${p.number}`,
  rnAvailable: '현재 빈 번호',
  rnTaken: '이미 영구결번',
  rnUnknown: '번호 확인 중',
  rnSeasons: (p: { have: number; need: number }) => `소속 ${p.have} / ${p.need}시즌`,
  rnProgress: (p: { pct: number }) => `구단 기여도 ${p.pct === 0 ? '10% 미만' : `${p.pct}%`}`,
  rnRemain: (p: { count: number }) => `이 구단에서 ${p.count}시즌 더 뛰어야 해요.`,
  rnBuild: '꾸준한 출전과 포지션에 맞는 활약, 구단 우승·개인상으로 기여도를 쌓아요.',
  rnReady: '현재 기록은 기준을 충족해요. 은퇴 시 최종 심사해요.',
  rnOutside: '기준은 충족했지만 기여도가 더 높은 구단이 먼저 심사돼요.',
  rnTakenHint: '이 구단의 번호는 먼저 등록됐어요. 다른 후보 구단이 있는지 확인할 수 있어요.',
  rnRules:
    '같은 서비스 시즌의 구단별 번호를 모든 유저가 공유해요. 자격을 갖춘 상위 2개 구단 중 한 곳에서 받을 수 있어요.',
  rnNote:
    '기여도는 10% 단위의 참고치이며 이적에 따라 달라질 수 있어요. 번호는 예약되지 않고, 이름을 공개한 선수의 은퇴 심사에서 최종 확정돼요.',
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
  // 이적 시장 평가
  marketAssess: (p: { ovr: number; rating: string | null; fame: number; age: number }) =>
    `현재 OVR ${p.ovr} · ${p.rating === null ? '' : `지난 시즌 평점 ${p.rating} · `}인기 ${p.fame} · ${p.age}세. 구단은 기량·지난 시즌 평점·인기·나이를 함께 봐요. 리그 조건과 스카우트·에이전트 이벤트도 제의에 영향을 줘요. 좋은 활약이 특정 구단의 제의를 보장하지는 않아요.`,
  offerAssess: (p: { ovr: number; str: number | string; role: string }) =>
    `현재 OVR ${p.ovr} · 팀 전력 ${p.str}. 제시된 출전 조건은 ${p.role || '별도 안내 없음'}이에요. 실제 출전은 컨디션·부상·감독 신뢰 등에 따라 달라져요.`,
};

export type GameCareerMsgs = typeof ko;
export const gameCareerText = ns('gameCareer', ko);
