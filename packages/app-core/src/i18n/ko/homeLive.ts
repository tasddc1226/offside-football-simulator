// 홈 라이브 현황(웹 HomeLive.svelte · 앱 screens/home/HomeLive.tsx · app-core homeLive.ts).
import { ns } from '../core';

const ko = {
  title: '지금 오프사이드에서는',
  statPlaying: '지금 뛰는 중',
  statSeasons: '오늘 치른 시즌',
  statNew: '오늘 새 선수',
  statRetired: '오늘 은퇴',
  pause: '소식 일시정지',
  pauseTitle: '일시정지',
  resumeTitle: '다시 재생',
  failed: '지금은 현황을 불러오지 못했어요. 잠시 뒤 다시 확인할게요.',
  whatRetire: (p: { score: number }) => `은퇴 · 레전드 점수 ${p.score}`,
  whatFirst: (p: { club: string }) => `${p.club}에서 첫 시즌을 마쳤어요`,
  whatHonor: (p: { honor: string; club: string }) => `${p.honor} · ${p.club}`,
  whatCleanSheets: (p: { club: string; apps: number; cs: number }) =>
    `${p.club} 시즌 ${p.apps}경기 무실점 ${p.cs}`,
  whatGoals: (p: { club: string; goals: number; assists: number }) =>
    `${p.club} 시즌 ${p.goals}골 ${p.assists}도움`,
};

export type HomeLiveMsgs = typeof ko;
export const homeLiveText = ns('homeLive', ko);
