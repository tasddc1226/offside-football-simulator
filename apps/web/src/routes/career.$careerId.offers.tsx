// SCR-009 첫 프로 제안 결과 자리표시. 실제 구현은 T-1-009.
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/offers')({
  component: PlaceholderScreen,
});
