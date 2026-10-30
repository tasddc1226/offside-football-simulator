// 업적 달성 알림 시트(웹 ui/sheets/Achieve.svelte · 앱 sheets/Achieve.tsx · app-core achNudge.ts).
import { ns } from '../core';
import { withRo } from '../../format';

const ko = {
  gradeUp: (p: { grade: string }) => `${p.grade} 등급이 됐어요`,
  achieved: (p: { n: number }) => `업적 ${p.n}개를 달성했어요`,
  nextGrade: (p: { name: string; pts: string }) => `${p.name}까지 ${p.pts}점`,
  nextGradeRank: (p: { name: string; n: string }) => `${p.name}까지 ${p.n}계단`,
  fromTo: (p: { from: string; to: string }) => `${p.from}에서 ${withRo(p.to)}`,
  more: (p: { n: number }) => `외 ${p.n}개`,
  gainedPts: (p: { n: string }) => `+${p.n}점`,
  nowPts: (p: { n: string }) => `지금 ${p.n}점`,
  // T-11-357 이번에 받은 업적 보상(아이템 이름은 teamCore achRewardBoost·achRewardScout).
  reward: (p: { items: string }) => `보상으로 ${p.items}을 받았어요`,
  viewAch: '업적 보기',
  close: '닫기',
};

export type SheetAchieveMsgs = typeof ko;
export const sheetAchieveText = ns('sheetAchieve', ko);
