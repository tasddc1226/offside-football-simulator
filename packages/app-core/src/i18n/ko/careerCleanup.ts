// 설정의 '지난 커리어 정리'(웹 CareerCleanup.svelte · 앱 screens/settings/CareerCleanup.tsx · app-core careerCleanup.ts).
import { ns } from '../core';

const ko = {
  title: '지난 커리어 정리',
  body: '새 선수로 다시 시작하면서 이어 하지 않은 커리어를 정리해요. 은퇴한 선수의 기록, 카드, 명예의 전당은 그대로예요.',
  find: '정리할 커리어 찾기',
  finding: '찾는 중이에요.',
  none: '정리할 커리어가 없어요.',
  found: (p: { n: string }) => `하루 넘게 이어 하지 않은 커리어가 ${p.n}개 있어요.`,
  clear: (p: { n: string }) => `${p.n}개 정리하기`,
  clearing: '정리하는 중이에요.',
  confirmTitle: '지난 커리어 정리',
  confirm: (p: { n: string }) =>
    `커리어 ${p.n}개를 정리할까요? 지금 이 기기에서 하는 커리어는 빼요. 정리한 커리어도 백업으로 다시 이어 하면 정리가 풀려요.`,
  cancel: '취소',
  ok: '정리하기',
  done: (p: { n: string }) => `커리어 ${p.n}개를 정리했어요.`,
  error: '불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  clearError: (p: { n: string }) =>
    `커리어 ${p.n}개까지 정리하고 멈췄어요. 잠시 뒤에 다시 시도해 주세요.`,
};

export type CareerCleanupMsgs = typeof ko;
export const careerCleanupText = ns('careerCleanup', ko);
