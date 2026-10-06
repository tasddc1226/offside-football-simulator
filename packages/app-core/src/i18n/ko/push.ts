// 새 소식 푸시 알림 — 앱 screens/settings/PushSettings.tsx · platform/push.ts · app-core pushRegistration.ts.
import { ns } from '../core';

const ko = {
  title: '앱 알림 받기',
  body: '이 기기의 전체 알림을 켜고 꺼요.',
  tokenNote:
    '알림 연결을 위해 푸시 토큰과 기기 종류·앱 버전을 저장해요. 발송 결과·알림 클릭·연결 화면 이동은 서비스 운영을 위해 서버에 90일간 보관해요.',
  busy: '알림 설정 중…',
  openSettings: '기기 알림 설정 열기',
  reconnect: '다시 연결',
  testNote:
    '테스트 알림은 이 기기에만 보내요. 기기·계정마다 10분에 한 번, 하루 3회까지 요청할 수 있어요.',
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
  prefsNote: '종류별 선택은 계정에 저장돼요. 전체 알림을 꺼도 아래 선택은 유지돼요.',
  prefsLoading: '알림 종류를 불러오는 중…',
  prefsReload: '알림 종류 다시 불러오기',
  catNotice: '공지',
  catNoticeBody: '운영 공지와 이벤트 안내',
  catRelease: '업데이트',
  catReleaseBody: '새 버전과 기능 업데이트',
  catTeam: '내 팀',
  catTeamBody: '상대가 건 경기 결과',
  catMarket: '이적시장',
  catMarketBody: '등록한 선수의 판매 완료',
  catSocial: '친구',
  catSocialBody: '친구 신청·수락과 친선전 결과',
  catAria: (p: { title: string }) => `${p.title} 알림`,
  prefsConnectFailed: '알림 설정에 연결하지 못했어요. 다시 시도해 주세요.',
  prefsLoadFailed: '알림 설정을 불러오지 못했어요.',
  prefsSaveFailed: '알림 설정을 저장하지 못했어요.',
};

export type PushMsgs = typeof ko;
export const pushText = ns('push', ko);
