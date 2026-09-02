// SCR-004 생성 완료 확인 자리표시. 실제 구현은 T-1-008.
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/confirm')({
  component: PlaceholderScreen,
});
