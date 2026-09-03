// SCR-008 입단 테스트 진행. EVT-CON-003 전용 변형: 선택 확정 시 결과가 먼저 저장되고(취소 불가),
// 그 뒤 "테스트 진행" 연출(Stepper 3단계, 총 1.5초)을 보여준 다음 SCR-014로 이동한다. 모션 감소면
// 연출 없이 즉시 이동하고, 일반 모드에서는 "건너뛰기"로 바로 이동할 수 있다. 새로고침·건너뛰기가
// 결과를 바꾸지 않는다: 결과는 이미 커밋된 뒤라 연출은 화면 연출일 뿐이다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Button, Stepper, type StepperStep } from '@offside/ui';
import { careerQueryOptions } from '../engine/use-career.js';
import { EventDecisionScreen } from '../shared/event-screen.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { useReducedMotion } from '../shared/ui-store.js';

export const Route = createFileRoute('/career/$careerId/tryout')({
  loader: async ({ params }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const target = screenForCareer(state);
    if (target.screenId !== 'SCR-008') {
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: TryoutScreen,
});

const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

const TRYOUT_STEPS: StepperStep[] = [
  { id: 'warmup', label: '몸풀기' },
  { id: 'match', label: '실전' },
  { id: 'evaluation', label: '평가' },
];
const STEP_DURATION_MS = 500;

function TryoutAnimation({ reducedMotion, onDone }: { reducedMotion: boolean; onDone: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (reducedMotion) {
      onDoneRef.current();
      return;
    }
    const timers = [
      setTimeout(() => setStepIndex(1), STEP_DURATION_MS),
      setTimeout(() => setStepIndex(2), STEP_DURATION_MS * 2),
      setTimeout(() => onDoneRef.current(), STEP_DURATION_MS * 3),
    ];
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div className="flex flex-col items-center gap-os-6">
      <Stepper steps={TRYOUT_STEPS} currentStepId={TRYOUT_STEPS[stepIndex]!.id} />
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        평가는 자동으로 진행되며 다시 볼 수 없습니다.
      </p>
      <Button variant="secondary" onClick={onDone}>
        건너뛰기
      </Button>
    </div>
  );
}

function TryoutScreen() {
  const { careerId } = Route.useParams();
  const reducedMotion = useReducedMotion();
  const [navigateToResult, setNavigateToResult] = useState<(() => void) | null>(null);

  if (navigateToResult !== null) {
    return <TryoutAnimation reducedMotion={reducedMotion} onDone={navigateToResult} />;
  }

  return (
    <EventDecisionScreen
      careerId={careerId}
      screenId="SCR-008"
      onResolved={(_result, navigate) => setNavigateToResult(() => navigate)}
    />
  );
}
