// T-11-376 지난 시즌 선수 급여 안내(편성 화면 급여 막대를 누르면 여는 안내 · 고르기 목록 칩). 웹 SalaryGuide · 앱 같은 시트.
import { ns } from '../core';

const ko = {
  title: '급여 안내',
  close: '닫기',
  intro:
    '구단 팀 선발 11명 중 지난 시즌 선수는 급여를 받아요. 지난 시즌 선수 급여를 모두 더한 값이 예산 안이어야 팀을 저장할 수 있어요.',
  free: '이번 시즌 선수는 급여가 없어요. 몇 명이든 넣을 수 있어요.',
  budget: '예산',
  used: '지금 쓰는 급여',
  left: '남은 예산',
  tableTitle: '급여표',
  tableNote: '카드 최고 OVR로 정해요. 직접 키웠는지, 영입했는지는 상관없어요.',
  tableOvr: '최고 OVR',
  tableSalary: '급여',
  bandLow: (p: { n: number }) => `${p.n} 이하`,
  bandRange: (p: { a: number; b: number }) => `${p.a}~${p.b}`,
  bandHigh: (p: { n: number }) => `${p.n} 이상`,
  examplesTitle: (p: { budget: number }) => `예산 ${p.budget} 안에서 고르는 예`,
  example: (p: { band: string; n: number; sum: number }) =>
    `OVR ${p.band} 선수 ${p.n}명 (급여 ${p.sum})`,
  examplesNote: '섞어서 써도 돼요. 급여 합만 예산 안이면 돼요.',
  howTitle: '편성할 때',
  how1: '예산을 넘는 선수는 고르기 목록에 "예산 초과"로 보여요. 지난 시즌 선수를 빼면 그만큼 다시 쓸 수 있어요.',
  how2: '선발에 든 선수끼리 자리를 바꾸면 급여 합은 그대로예요.',
  how3: '자동 배치는 예산 안에서 가장 센 선발을 골라요.',
  whyTitle: '왜 급여가 있나요',
  why1: '새 시즌마다 새 선수를 키우는 재미를 지키려고 해요. 이번 시즌 선수가 늘 가장 싼 전력이에요.',
  why2: '예전에는 지난 시즌 선수를 3명까지만 넣을 수 있었어요. 급여로 바꾸면서 중간급 선수 여러 명을 쓰는 선택도 생겼어요.',
  why3: '급여는 많아야 20이라 지난 시즌 선수 3명은 언제나 예산 60 안에 들어요. 예전에 짠 선발은 그대로 쓸 수 있어요.',
  why4: '예산은 구단 자금이나 결제로 늘릴 수 없어요.',
};

export type SalaryMsgs = typeof ko;
export const salaryText = ns('salary', ko);
