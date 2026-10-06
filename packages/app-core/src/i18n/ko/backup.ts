// 진행 중 커리어 백업 카드 — 웹 BackupSettings.svelte · 앱 screens/settings/BackupSettings.tsx.
import { ns } from '../core';

const ko = {
  title: '진행 중 커리어 백업',
  bodyWeb:
    '기기를 바꾸거나 카톡 등 앱 안 브라우저에서 옮길 때 쓰세요. 백업 코드는 다른 사람에게 보내지 마세요.',
  bodyApp: '기기를 바꿀 때 쓰세요. 백업 코드는 다른 사람에게 보내지 마세요.',
  copyCode: '코드 복사',
  saveFile: '파일로 저장',
  shareFile: '공유로 내보내기',
  manualLabel: '백업 코드 (직접 복사)',
  importLabel: '백업 불러오기',
  pastePlaceholder: '백업 코드를 여기에 붙여넣어요',
  importBtn: '불러오기',
  pickFile: '파일에서 불러오기',
  pasteClipboard: '클립보드에서 붙여넣기',
  pasteHint: '백업 코드나 내보낸 백업 글을 붙여넣으면 돼요.',
  shareTitle: 'OFFSIDE 커리어 백업',
  copied: '백업 코드를 복사했어요',
  copyManual: '아래 코드를 길게 눌러 직접 복사해 주세요',
  fileSaved: '백업 파일을 저장했어요',
  shareFail: '공유하지 못했어요. 코드를 복사해 주세요',
  replaceConfirm: (p: { name: string }) =>
    `지금 진행 중인 ${p.name} 선수의 커리어를 백업으로 바꿀까요? 되돌릴 수 없어요.`,
  replaceOk: '바꾸기',
  cancel: '취소',
  noSpace: '저장 공간이 부족해 백업을 불러오지 못했어요. 현재 커리어는 그대로예요',
  restored: '백업을 불러왔어요',
  fileReadFail: '파일을 읽지 못했어요',
  clipEmpty: '클립보드가 비어 있어요',
  clipFail: '클립보드를 읽지 못했어요',
  failEmptyWeb: '백업 코드를 붙여넣거나 백업 파일을 골라 주세요',
  failEmptyApp: '백업 코드나 내보낸 백업 글을 붙여넣어 주세요',
  failFormat: '백업 코드가 올바르지 않아요. 코드를 끝까지 복사했는지 확인해 주세요',
  failVersion: '이 백업은 지금 게임과 형식이 맞지 않아 불러올 수 없어요',
  failSaveVersion: '이 백업은 지금 게임 버전과 맞지 않아 불러올 수 없어요',
  failSave: '백업 안의 커리어 데이터가 올바르지 않아 불러올 수 없어요',
  failTooLarge: '백업 코드가 너무 커서 불러올 수 없어요',
};

export type BackupMsgs = typeof ko;
export const backupText = ns('backup', ko);
