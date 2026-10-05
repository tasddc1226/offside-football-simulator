// 다른 계정 소유 커리어 처리 알림(ownerConflict.ts).
import { ns } from '../core';

const ko = {
  otherAccount: '다른 계정의 선수라 서버에 반영하지 못했어요. 그 계정으로 로그인하면 반영돼요.',
  recordedElsewhere: '이 커리어는 다른 계정에 기록돼 있어요. 홈에서 확인해 주세요.',
  adopted: '지금 계정으로 이어서 기록할게요.',
};

export type OwnerConflictMsgs = typeof ko;
export const ownerConflictText = ns('ownerConflict', ko);
