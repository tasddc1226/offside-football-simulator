// T-11-145 오프사이드 컵 앱 화면에서만 쓰는 문구. 웹과 함께 쓰는 문구는 ko/cup.ts(cupText)에 있다.
import { ns } from '../core';

const ko = {
  cancel: '취소',
  withdrawAskTitle: '신청을 취소할까요?',
  withdrawKeep: '그대로 두기',
  actionFail: '처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
  groupToggle: (p: { name: string }) => `${p.name} 펼치기·접기`,
  roundToggle: (p: { name: string }) => `${p.name} 펼치기·접기`,
  rerollAskTitle: '후보를 다시 뽑을까요?',
  rerollAction: '다시 뽑기',
  shopAskTitle: '리롤권을 살까요?',
  shopAction: '사기',
};

export type CupAppMsgs = typeof ko;
export const cupAppText = ns('cupApp', ko);
