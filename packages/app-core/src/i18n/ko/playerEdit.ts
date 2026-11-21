// T-11-804 첫 시즌 선수 정보 고치기(웹 PlayerEditSheet.svelte · 앱 screens/game/PlayerEditSheet.tsx, 선수 탭 · 이름 옆 연필).
import { ns } from '../core';

const ko = {
  title: '선수 정보 고치기',
  entry: '고치기',
  entryLabel: (p: { name: string }) => `${p.name} 선수 정보 고치기`,
  hint: '첫 시즌 결산 전까지 이름 · 주발 · 체격을 무료로 고칠 수 있어요.',
  lead: '첫 시즌 결산 전까지 무료로, 몇 번이든 고칠 수 있어요. 결산이 끝나면 이름은 변경권으로만 바꿀 수 있어요.',
  name: '이름',
  nameRule: (p: { max: number }) =>
    `${p.max}자까지 쓸 수 있어요. 링크와 욕설, < > 기호는 쓸 수 없어요.`,
  nameEmpty: '이름을 넣어 주세요.',
  nameInvalid: '쓸 수 없는 이름이에요. 다른 이름을 넣어 주세요.',
  body: '체격',
  height: '키',
  weight: '몸무게',
  heightRange: (p: { min: number; max: number }) => `키는 ${p.min}~${p.max}cm 사이로 넣어 주세요.`,
  weightRange: (p: { min: number; max: number }) =>
    `몸무게는 ${p.min}~${p.max}kg 사이로 넣어 주세요.`,
  tooLight: '키에 비해 몸무게가 너무 가벼워요.',
  tooHeavy: '키에 비해 몸무게가 너무 무거워요.',
  bodyNote: 'OVR은 그대로예요. 세부 능력치 분포만 옮겨요.',
  ovrMove: (p: { from: number; to: number }) =>
    `OVR ${p.from} → ${p.to}. 두 역할 중 높은 쪽으로 OVR을 재는 선수라 체격에 따라 달라져요.`,
  bodyPlayed: '지금까지 오른 능력치는 그대로 두고 체격 보정만 옮겨요.',
  bodyNone: '체격을 넣기 전에 만든 선수라 체격은 고칠 수 없어요.',
  preview: '바뀌는 세부 능력치',
  previewNone: '바뀌는 세부 능력치가 없어요.',
  foot: '주발',
  footNote:
    '주발은 선수 경기 결과에 영향이 없어요. 구단 경기에서 선수 카드를 풀백 · 윙어 자리에 세울 때만 쓰여요.',
  save: '저장',
  close: '닫기',
  same: '바뀐 내용이 없어요.',
  done: '선수 정보를 고쳤어요.',
  closed: '첫 시즌 결산이 끝나 더 고칠 수 없어요.',
};

export type PlayerEditMsgs = typeof ko;
export const playerEditText = ns('playerEdit', ko);
