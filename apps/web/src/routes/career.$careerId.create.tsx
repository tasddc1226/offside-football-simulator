// SCR-002 선수 생성 자리표시. 실제 구현은 T-1-008.
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/create')({
  component: PlaceholderScreen,
});
