// SCR-008 입단 테스트 진행 자리표시. 실제 구현은 T-1-009.
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/tryout')({
  component: PlaceholderScreen,
});
