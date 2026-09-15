// SCR-013 범용 커리어 선택 이벤트. EVT-CON-002·EVT-CON-003처럼 전용 변형(SCR-007·008)이 있는
// 이벤트는 그 라우트로 보낸다(EVENT_SCREEN_OVERRIDES).
import { createFileRoute, redirect } from '@tanstack/react-router';
import { careerQueryOptions, useCareer } from '../engine/use-career.js';
import { EventDecisionScreen, type EventScreenId } from '../shared/event-screen.js';
import { Phase4Context } from './-phase4/bodies.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';

export const Route = createFileRoute('/career/$careerId/event')({
  loader: async ({ params }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const target = screenForCareer(state);
    if (SCREEN_ROUTES[target.screenId] !== SCREEN_ROUTES['SCR-013']) {
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: EventScreen,
});

function EventScreen() {
  const { careerId } = Route.useParams();
  const query = useCareer(careerId);
  const screenId = query.data ? screenForCareer(query.data.state).screenId : 'SCR-013';
  return (
    <EventDecisionScreen
      key={
        query.data?.state.pending && 'eventId' in query.data.state.pending
          ? `${careerId}:${query.data.state.pending.eventId}:${query.data.state.currentStep}`
          : careerId
      }
      careerId={careerId}
      screenId={screenId as EventScreenId}
      modal
      renderAbove={(context) => <Phase4Context {...context} />}
    />
  );
}
