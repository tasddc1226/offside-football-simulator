// SCR-014 선택 결과 카드. `rev` 검색 파라미터가 가리키는 EVENT_RESOLVED 타임라인 항목만으로
// 결과를 재구성한다(event-result.ts) — appliedEffects를 쓰지 않으므로 새로고침·뒤로 가기가
// roll을 다시 소비하지 않는다. "다음"은 advance를 실행하고 결과 상태를 screenForCareer로 해석해
// 이동한다(정산 단계에서 더 진행할 게 없으면 advance는 실패하고 현재 상태 그대로 SCR-029로 간다).
import { useEffect, useRef } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Button, ErrorState, ResultCard, Skeleton } from '@offside/ui';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { activeContentPack } from '../engine/content.js';
import { screenForCareer } from '../shared/career-route.js';
import { resolveEventResultView } from '../shared/event-result.js';
import { platform } from '../platform/index.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';

type EventResultSearch = { rev: number };

export const Route = createFileRoute('/career/$careerId/event_/result')({
  validateSearch: (search: Record<string, unknown>): EventResultSearch => ({ rev: Number(search.rev) }),
  loaderDeps: ({ search }) => ({ rev: search.rev }),
  loader: async ({ params, deps }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const view = resolveEventResultView(state, activeContentPack, deps.rev);
    if (view === null) {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: EventResultScreen,
});

function EventResultScreen() {
  const { careerId } = Route.useParams();
  const { rev } = Route.useSearch();
  const query = useCareer(careerId);
  const advanceMutation = useCareerMutation('advance');
  const navigate = useNavigate();
  const submittingRef = useRef(false);

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-014', careerPhase: query.data?.state.seasonPhase ?? 'NONE' });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-os-4" aria-label="불러오는 중">
        <Skeleton className="h-os-8 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : '커리어를 불러오지 못했습니다'}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { state } = query.data;
  const view = resolveEventResultView(state, activeContentPack, rev);
  if (view === null) {
    // 라우트 loader가 이미 screenForCareer로 redirect했어야 한다. 방어적 fallback.
    return null;
  }

  async function handleNext() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const result = await advanceMutation.mutateAsync({ careerId });
      const targetState = result.ok ? result.domainSnapshot.state : state;
      const target = screenForCareer(targetState);
      void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-os-6">
      <ResultCard kind={view.kind} kindLabel={view.kindLabel} title={view.title} body={view.body} effects={view.effects} tags={view.tags} />
      <Button variant="primary" onClick={handleNext} disabled={advanceMutation.isPending}>
        다음
      </Button>
    </div>
  );
}
