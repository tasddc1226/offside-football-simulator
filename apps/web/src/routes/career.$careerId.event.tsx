// SCR-013 범용 커리어 선택 이벤트. EVT-CON-002·EVT-CON-003처럼 전용 변형(SCR-007·008)이 있는
// 이벤트는 그 라우트로 보낸다(EVENT_SCREEN_OVERRIDES).
import { createFileRoute, redirect } from '@tanstack/react-router';
import { careerQueryOptions } from '../engine/use-career.js';
import { EventDecisionScreen } from '../shared/event-screen.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';

export const Route = createFileRoute('/career/$careerId/event')({
  loader: async ({ params }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const target = screenForCareer(state);
    if (target.screenId !== 'SCR-013') {
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: EventScreen,
});

function EventScreen() {
  const { careerId } = Route.useParams();
  return <EventDecisionScreen careerId={careerId} screenId="SCR-013" />;
}
