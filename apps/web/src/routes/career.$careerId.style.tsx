// SCR-003 플레이 스타일·아키타입 자리표시. 실제 구현은 T-1-008.
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/style')({
  component: PlaceholderScreen,
});
