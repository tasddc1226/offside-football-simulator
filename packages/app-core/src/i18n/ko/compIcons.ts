// 리그·대회 로고 바꾸기(T-11-679) — 웹 CompIcon.svelte · CompIconSheet.svelte, 앱 ui/CompIcon.tsx, app-core compIcons.ts · compEmblem.ts.
import { ns } from '../core';

const ko = {
  sheetTitle: (p: { name: string }) => `${p.name} 로고`,
  intro:
    '로고를 내가 고른 이미지로 바꿀 수 있어요. 이 기기에만 저장되고, 공유 이미지와 다른 사람 화면에는 기본 로고가 보여요.',
  where: '설정 → 대회·수상 이름 · 로고 바꾸기에서 리그·대회 로고를 한곳에 모아 볼 수 있어요.',
  pick: '이미지 고르기',
  reset: '기본 로고로',
  close: '닫기',
  logoLabel: (p: { name: string }) => `${p.name} 로고 바꾸기`,
  hint: '리그·대회 로고가 생겼어요. 로고를 누르면 내 이미지로 바꿀 수 있어요.',
  hintClose: '알겠어요',
  custom: '내 이미지',
  saved: '로고를 바꿨어요',
  restored: '기본 로고로 돌렸어요',
  big: '이미지를 줄이지 못했어요. 더 단순한 이미지를 골라 주세요',
  tooLarge: '10MB보다 작은 이미지를 골라 주세요',
  readFail: '이미지를 읽지 못했어요',
  full: '로고 이미지를 더 저장할 공간이 없어요. 안 쓰는 로고를 기본 로고로 돌려 주세요',
  noSpace: '저장 공간이 부족해 저장하지 못했어요',
  changed: (p: { n: number }) => `바꾼 로고 ${p.n}개`,
  imported: (p: { n: number }) => `로고 ${p.n}개를 불러왔어요`,
};

export type CompIconsMsgs = typeof ko;
export const compIconsText = ns('compIcons', ko);
