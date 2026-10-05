// club 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  syncLocal: '이 기기에만 저장돼요. 구글 계정으로 로그인하면 다른 기기와 동기화돼요.',
  syncSyncing: '계정과 동기화하는 중…',
  syncSynced: '계정에 저장됐어요. 같은 계정으로 로그인한 기기에서도 쓰여요.',
  syncError: '동기화하지 못했어요. 이 기기에는 저장됐고, 다음에 다시 시도해요.',
  syncFull:
    '엠블럼 이미지가 너무 많아 계정과 동기화하지 못해요. 이 기기에는 저장됐어요. 이미지를 몇 개 지우면 다시 동기화돼요.',
};

export type ClubSyncMsgs = typeof ko;
export const clubSyncText = ns('clubSync', ko);
