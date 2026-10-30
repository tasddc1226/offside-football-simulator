// T-11-377 선수 이름 변경권(웹 RenameSheet.svelte, 앱 screens/rename/RenameSheet.tsx · 구단주 화면 상점 칸).
import { ns } from '../core';
import { withRo } from '../../format.js';

const ko = {
  title: '선수 이름 바꾸기',
  entry: '이름 바꾸기',
  entryLabel: (p: { name: string }) => `${p.name} 이름 바꾸기`,
  lead: '변경권 1장으로 이름을 바꿔요. 바꾼 이름은 명예의 전당 · 이적시장 · 구단 경기에 공개돼요.',
  label: '새 이름',
  // T-11-442 쓸 수 있는 이름과 쓰기 전 확인
  rule: (p: { max: number }) =>
    `${p.max}자까지 쓸 수 있어요. 링크와 욕설, < > 기호는 쓸 수 없어요.`,
  next: '다음',
  confirm: (p: { name: string }) => `이름을 ${withRo(p.name)} 바꿀까요?`,
  confirmNote: '변경권 1장을 쓰고, 바꾼 이름은 명예의 전당 · 이적시장 · 구단 경기에 공개돼요.',
  edit: '다시 고치기',
  have: (p: { n: number }) => `가진 변경권 ${p.n}장`,
  btn: '1장 쓰고 바꾸기',
  busy: '바꾸는 중…',
  done: (p: { name: string }) => `이름을 ${withRo(p.name)} 바꿨어요.`,
  fail: '이름을 바꾸지 못했어요. 잠시 뒤 다시 눌러 주세요.',
  empty: '이름을 넣어 주세요.',
  invalid: '쓸 수 없는 이름이에요. 다른 이름을 넣어 주세요.',
  same: '지금 이름과 같아요.',
  none: '변경권이 없어요. 출석 체크 28일째에 1장을 받아요.',
  noneApp: '변경권이 없어요. 출석 체크 28일째에 1장을 받거나 아래에서 살 수 있어요.',
  guest: '로그인하면 변경권으로 선수 이름을 바꿀 수 있어요.',
  close: '닫기',
  shopTitle: '선수 이름 변경권',
  shopHave: (p: { n: number }) => `가진 변경권 ${p.n}장`,
  shopWeb: '변경권은 앱에서 살 수 있어요.',
  shopNote: '진행 중인 선수는 선수 화면 이름 옆, 은퇴 · 영입한 선수는 내 선수 목록에서 바꿔요.',
};

export type RenameMsgs = typeof ko;
export const renameText = ns('rename', ko);
