// SCR-007 졸업 후 진로 선택 자리표시. 실제 구현은 T-1-009.
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/path')({
  component: PlaceholderScreen,
});
