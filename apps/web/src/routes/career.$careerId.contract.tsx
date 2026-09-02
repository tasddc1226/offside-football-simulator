// SCR-010 신인 계약 사인 자리표시. 실제 구현은 T-1-009.
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/contract')({
  component: PlaceholderScreen,
});
