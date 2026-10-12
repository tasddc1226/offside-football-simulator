import { ns } from '../core';

const ko = {
  title: '은퇴 선수 꾸미기',
  intro: '기본 꾸미기는 무료예요. 기록·능력치·선수 자금은 그대로 유지돼요.',
  recordNote: '기록 아이템은 저장된 칭호 조건을 충족하면 고를 수 있어요.',
  retiredPreview: '은퇴 모습',
  kitPreview: '선수 카드 모습',
  save: '외형 저장',
  saving: '저장 중',
  cancel: '취소',
  reset: '기본 모습',
  saved: '외형을 저장했어요. 기록과 능력치는 그대로예요.',
  localSaved: '이 기기에 외형을 저장했어요. 서버에 없는 은퇴 기록이에요.',
  serverSaved: '서버에 외형을 저장했지만 기기 저장에 실패했어요. 다시 열어 확인해 주세요.',
  storageFailed: '기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.',
  failed: '외형을 저장하지 못했어요. 다시 시도해 주세요.',
};

export type RetiredLookMsgs = typeof ko;
export const retiredLookText = ns('retiredLook', ko);
