// 구단 이름·엠블럼 변경 카드 — 웹 ClubCustomSettings.svelte · 앱 screens/settings/ClubCustomSettings.tsx · app-core clubCustom.ts.
import { ns } from '../core';

const ko = {
  title: '구단 이름·엠블럼 변경',
  intro:
    '클럽 이름과 엠블럼을 원하는 대로 바꿀 수 있어요. 바꾼 뒤부터 생기는 오퍼·기록에 새 이름이 쓰여요.',
  league: '리그',
  leagueOption: (p: { name: string; n: number }) => `${p.name} (${p.n}개 클럽)`,
  nameLabel: (p: { name: string }) => `${p.name} 이름`,
  emblem: '엠블럼',
  emblemLabel: (p: { name: string }) => `${p.name} 엠블럼`,
  logoText: '글자',
  logoTextLabel: '엠블럼 글자',
  bg: '바탕',
  fg: '글자색',
  pickColor: (p: { label: string }) => `${p.label} 색 고르기`,
  colorValue: (p: { label: string }) => `${p.label} 색 값`,
  uploadImage: '이미지 올리기',
  dropImage: '이미지 빼기',
  reset: '기본값',
  resetLeague: '이 리그 초기화',
  exportFile: '에디트 파일 내보내기',
  importFile: '에디트 파일 가져오기',
  resetAll: '전체 초기화',
  importPlaceholder: '내보낸 에디트 파일 내용을 여기에 붙여넣어요',
  importPasteLabel: '에디트 파일 붙여넣기',
  importBtn: '가져오기',
  pasteClipboard: '클립보드에서 붙여넣기',
  cancel: '취소',
  revert: '되돌리기',
  noSpace: '저장 공간이 부족해 저장하지 못했어요',
  imgComplex: '이미지가 너무 복잡해 저장할 수 없어요',
  imgFull: '엠블럼 이미지를 더 저장할 공간이 없어요. 다른 클럽 이미지를 지운 뒤 올려 주세요',
  imgReadFail: '이미지를 읽지 못했어요',
  badFile: '에디트 파일 형식이 올바르지 않아요',
  imported: (p: { n: number }) => `클럽 ${p.n}개 설정을 불러왔어요`,
  leagueReset: '이 리그를 기본값으로 되돌렸어요',
  resetAllConfirm: '모든 리그의 클럽 이름·엠블럼을 기본값으로 되돌릴까요?',
  allReset: '모든 클럽을 기본값으로 되돌렸어요',
  shareFail: '공유하지 못했어요',
  clipEmpty: '클립보드가 비어 있어요',
  clipFail: '클립보드를 읽지 못했어요',
};

export type ClubMsgs = typeof ko;
export const clubText = ns('club', ko);
