// 업적 달성 알림 시트(웹 ui/sheets/Achieve.svelte · 앱 sheets/Achieve.tsx · app-core achNudge.ts).
import { ns } from '../core';

const ko = {
  gradeUp: (p: { grade: string }) => `${p.grade} 등급이 됐어요`,
  achieved: (p: { n: number }) => `업적 ${p.n}개를 달성했어요`,
  nextGrade: (p: { name: string; pts: string }) => `${p.name}까지 ${p.pts}점`,
  fromTo: (p: { from: string; to: string }) => `${p.from}에서 ${p.to}로`,
  more: (p: { n: number }) => `외 ${p.n}개`,
  gainedPts: (p: { n: string }) => `+${p.n}점`,
  nowPts: (p: { n: string }) => `지금 ${p.n}점`,
  viewAch: '업적 보기',
  close: '닫기',
};

export type SheetAchieveMsgs = typeof ko;
export const sheetAchieveText = ns('sheetAchieve', ko);
