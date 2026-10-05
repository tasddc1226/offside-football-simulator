// 새 소식 푸시 알림 — 앱 screens/settings/PushSettings.tsx · platform/push.ts · app-core pushRegistration.ts.
import { ns } from '../core';

const ko = {
  title: '새 소식 알림',
  body: '공지·릴리즈 노트의 새 글을 알려 드려요. 게시판마다 하루 한 번 보내요.',
  tokenNote: '알림 연결을 위해 푸시 토큰과 기기 종류·앱 버전을 저장해요.',
  offLabel: '이 기기의 새 소식 알림 끄기',
  onLabel: '이 기기의 새 소식 알림 받기',
  busy: '알림 설정 중…',
  turnOff: '알림 끄기',
  turnOn: '알림 받기',
  openSettings: '기기 알림 설정 열기',
  reconnect: '다시 연결',
  testNote:
    '테스트 알림은 이 기기에만 보내요. 기기·계정마다 10분에 한 번, 하루 3회까지 요청할 수 있어요.',
  engagementTitle: '재방문 안내 (선택)',
  engagementBody:
    '7일 이상 방문하지 않았을 때 다시 시작할 안내를 받아요. 오전 9시부터 오후 8시 사이에만 보내요.',
  engagementOff: '재방문 안내 끄기',
  engagementOn: '재방문 안내 받기',
  openInbox: '알림함 열기',
  testBusy: '요청 중…',
  testBtn: '내 기기로 테스트 알림 보내기',
  nextTest: '다음 테스트:',
  testRequested: '테스트 알림을 요청했어요. 기기 알림센터에서 수신을 확인해 주세요.',
  testFailed: '테스트 요청을 보내지 못했어요.',
  privacy: '알림 정보 처리 안내',
  channelName: '공지·릴리즈 노트',
  errTurnOnFirst: '먼저 알림 받기를 켜 주세요.',
  errTestWait: '테스트 알림은 잠시 뒤 다시 보낼 수 있어요.',
  offDone: '이 기기의 새 소식 알림을 껐어요.',
  needSettings: '기기 설정에서 알림을 허용해 주세요.',
  denied: '알림을 허용하지 않았어요.',
  onDone: '이 기기의 새 소식 알림을 켰어요.',
  offLocal: '이 기기에서는 껐어요. 서버 연결 해제는 연결이 돌아오면 다시 시도해요.',
  connectFail: '알림을 연결하지 못했어요. 잠시 뒤 다시 연결해 주세요.',
};

export type PushMsgs = typeof ko;
export const pushText = ns('push', ko);
