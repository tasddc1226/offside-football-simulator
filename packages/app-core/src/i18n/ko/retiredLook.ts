import { ns } from '../core';

const ko = {
  title: '은퇴 선수 꾸미기',
  /** T-11-439 은퇴 리포트의 꾸미기 버튼(B5): 남은 횟수 · 막힌 이유. */
  button: '꾸미기 (1회)',
  buttonUsed: '꾸미기 (사용함)',
  buttonTransferred: '꾸미기 불가',
  intro: '기본 꾸미기는 무료예요. 기록·능력치·선수 자금은 그대로 유지돼요.',
  policy:
    '은퇴한 선수의 외형은 한 번 무료로 바꿀 수 있어요. 이적시장에서 거래된 적 있는 선수는 바꿀 수 없어요.',
  used: '새 선수 그림에서 외형 변경 기회를 이미 사용했어요.',
  transferred: '이적시장에서 거래된 적 있는 선수라 외형을 바꿀 수 없어요.',
  checking: '변경 가능 여부 확인 중',
  checkFailed: '변경 가능 여부를 확인하지 못했어요. 닫았다가 다시 열어 주세요.',
  localPartial:
    '이 기기에 외형과 변경 횟수를 저장했지만 기록 화면 갱신에 실패했어요. 다시 열어 확인해 주세요.',
  recordNote: '기록 아이템은 저장된 칭호 조건을 충족하면 고를 수 있어요.',
  retiredPreview: '은퇴 모습',
  kitPreview: '선수 카드 모습',
  confirm: '외형 확정',
  confirmTitle: '이 외형으로 확정할까요?',
  confirmNote: '확정하면 이 선수의 외형은 다시 바꿀 수 없어요. 기록과 능력치는 그대로예요.',
  back: '계속 꾸미기',
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
