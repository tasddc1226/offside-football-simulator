import type { PushCategory, PushMetrics } from '@offside/contracts';
import { inboxText } from './i18n/ko/inbox';

export const PUSH_CATEGORY_LABELS: Record<PushCategory, string> = {
  notice: '공지',
  release: '릴리즈 노트',
  team: '내 팀 경기',
  market: '선수 판매',
  social: '친구',
  community: inboxText.kindCommunity,
  'friend-request': '친구 신청',
  'friend-accepted': '친구 수락',
  friendly: '친선 경기',
  return: '재방문 안내',
  test: '테스트 푸시',
};
export const pushClickRate = (m: PushMetrics) =>
  m.acceptedRecipients ? `${((m.clicked / m.acceptedRecipients) * 100).toFixed(1)}%` : '—';
export const PUSH_METRIC_LABELS = [
  { key: 'queued', label: '발송 대상 기기' },
  { key: 'accepted', label: '발송 접수' },
  { key: 'confirmed', label: '전달 확인' },
  { key: 'pending', label: '진행 중' },
  { key: 'failed', label: '실패' },
  { key: 'unknown', label: '결과 불명' },
  { key: 'cancelled', label: '취소' },
] as const;
export const PUSH_METRICS_HELP =
  '접수·전달 결과는 기기 수예요. 클릭은 같은 알림을 여러 기기에서 눌러도 한 번만 세요. 클릭률은 접수된 알림 중 클릭한 비율이에요.';
export const PUSH_TARGET_HELP =
  '연결 화면 이동은 푸시 클릭 후 24시간 안에 알림의 이동 버튼을 누른 수예요. 실제 플레이·구매 수와는 달라요.';
export const PUSH_RECEIPT_HELP =
  '전달 확인은 APNs·FCM 접수 결과예요. 기기에 표시됐거나 사용자가 읽었다는 뜻은 아니에요.';
