import { ns } from '../core';
export const cupPush = ns('cupPush', {
  title: '컵 종료 알림',
  policy: '컵당 계정별 한 번 · 참가자 안내 우선 · 최근 7·30·90일',
  empty: '이 기간에 생성된 컵 종료 알림이 없어요. 컵이 끝나면 표시돼요.',
  help: '알림 생성일 기준이에요. 대상 계정에는 앱 푸시 미등록도 포함해요. 전달 확인은 APNs·FCM 접수이며, 화면 표시나 열람을 뜻하지 않아요.',
  dedupeHelp:
    '중복으로 합친 건수는 참가 이력과 경기별 예측 이력을 계정당 한 번으로 묶으며 줄어든 알림 수예요. 실제 중복 전송이나 Queue 재시도 수가 아니에요.',
  notQueuedHelp:
    '푸시 미등록은 종료 시 유효한 기기가 없거나 팀 알림이 꺼져 발송 원장이 만들어지지 않은 계정이에요.',
  cupName: (p: { season: number; edition: number }) =>
    `시즌 ${p.season} 제${p.edition}회 오프사이드 컵`,
  expand: '상세 보기',
  collapse: '접기',
  recipients: '대상 계정',
  participants: '컵 참가자',
  predictors: '예측 참여자',
  overlap: '참가·예측 모두 참여',
  predictionOnly: '예측만 참여',
  predictionEntries: '경기별 예측 건수',
  duplicatesRemoved: '중복으로 합친 건수',
  notQueued: '푸시 미등록',
  queued: '발송 대상 기기',
  acceptedRecipients: '접수된 계정',
  confirmed: '전달 확인',
  clicked: '클릭한 계정',
  targetOpened: '연결 화면 이동',
  pending: '진행 중',
  failed: '실패',
  unknown: '결과 불명',
  cancelled: '취소',
  clickRate: '클릭률',
});
