// SCR-013 포지션 전용 이벤트(경기 판단 변형) 자리표시. 실제 구현은 T-1-009.
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/event')({
  component: PlaceholderScreen,
});
