// 은퇴 선수 리포트(웹 LegendReport.svelte · 앱 screens/retired/LegendReport.tsx)와 app-core legend.ts의 알림 문구.
// 점수 구성 항목 이름·칭호·구단·리그 이름처럼 게임이 만든 문구는 옮기지 않는다.
import { ns } from '../core';

const ko = {
  // 타이틀
  reportLabel: (p: { name: string }) => `${p.name} 커리어 결산`,
  retiredAge: (p: { age: number }) => `${p.age}세 은퇴`,
  scoreLabel: (p: { score: number }) => `레전드 점수 ${p.score}`,
  worth: '은퇴 가치',
  peakValue: (p: { value: string; season: string; club: string }) =>
    `최고 몸값 ${p.value} · ${p.season} ${p.club}`,
  peakOvr: (p: { peak: number }) => `최고 OVR ${p.peak}`,
  rnPillTitle: (p: { club: string; number: number }) => `${p.club} 영구결번 ${p.number}번`,
  rnPill: (p: { club: string; number: number }) => `👑 ${p.club} 영결 ${p.number}`,
  // 통산 기록
  statsLabel: '통산 기록',
  statSeasons: '시즌',
  statApps: '경기',
  statCleanSheets: '무실점',
  statGaPoints: '공격P',
  statGoals: '골',
  statAssists: '도움',
  statCaps: 'A매치',
  statTrophies: '트로피',
  statBallon: '발롱도르 수상',
  noDetailNote: '시즌별 상세 기록이 없는 예전 기록이라 요약만 보여 줘요.',
  scrollCue: '스크롤해서 커리어 돌아보기',
  // 구단별 커리어
  journeyTitle: '구단별 커리어',
  chapterMeta: (p: { leagues: string; ageFrom: number; ageTo: number; seasons: number }) =>
    `${p.leagues} · ${p.ageFrom === p.ageTo ? `${p.ageFrom}세` : `${p.ageFrom}–${p.ageTo}세`} · ${p.seasons}시즌`,
  valueTitle: '몸값 흐름',
  nationalTitle: '국가대표',
  natGa: (p: { goals: number; assists: number }) => `${p.goals}골 · ${p.assists}도움`,
  honoursTitle: '우승 연혁',
  // 은퇴 시점 잠재력
  potTitle: '은퇴 시점 잠재력 평가',
  potLine: (p: { value: number }) => `잠재력 ${p.value} · 은퇴 시점에 기록한 값`,
  peakOvrLabel: '최고 OVR',
  // 마지막 휘슬
  finaleLine1: (p: { age: number; club: string }) => `${p.age}세, ${p.club}에서`,
  finaleLine2: '마지막 휘슬이 울렸습니다.',
  thanks: (p: { name: string }) => `수고했어요, ${p.name}`,
  // 자세히 보기
  moreSummary: '시즌별 기록 · 레전드 점수 구성 자세히 보기',
  breakdownTitle: '레전드 점수 구성',
  breakdownNote:
    '포지션별 기여(공격수·미드필더는 골·도움, 수비수·골키퍼는 무실점 중심) + 출전 · 우승 · 개인상 · A매치 · 최고 OVR · 발롱도르/월드컵 보너스',
};

export type LegendMsgs = typeof ko;
export const legendText = ns('legend', ko);
