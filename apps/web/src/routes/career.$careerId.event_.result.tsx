// SCR-014 선택 결과 카드. `rev` 검색 파라미터가 가리키는 EVENT_RESOLVED 타임라인 항목만으로
// 결과를 재구성한다(event-result.ts) — appliedEffects를 쓰지 않으므로 새로고침·뒤로 가기가
// roll을 다시 소비하지 않는다. "다음"은 advance를 실행하고 결과 상태를 screenForCareer로 해석해
// 이동한다 — NOTHING_TO_ADVANCE(정산 단계에서 더 진행할 게 없음)만 그렇게 처리하고, 그 외 실패는
// 결과 화면에 남아 오류를 보여준다(오류를 조용히 삼키고 이동하지 않는다).
import { useEffect, useRef, useState } from 'react';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const view = query.data === undefined ? null : resolveEventResultView(query.data.state, activeContentPack, rev);

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-014', careerPhase: query.data?.state.seasonPhase ?? 'NONE' });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  // 08 접근성 체크리스트: 결과 변화를 aria-live로 한 번만 낭독한다. `ScreenStateView`의 영역은
  // LOADING·COMMITTING 단계 문구 전용이라 재사용하지 않고, 이 화면 전용 영역을 둔다 — 처음엔 빈
  // 문자열로 마운트해 뒀다가 결과가 정해지면 텍스트만 한 번 바꾼다(이미 채워진 채로 새로 마운트되면
  // 스크린리더가 놓칠 수 있다).
  useEffect(() => {
    if (view === null) return;
    setAnnouncement(`${view.kindLabel}: ${view.title}`);
  }, [rev, view?.kindLabel, view?.title]);

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
  if (view === null) {
    // 라우트 loader가 이미 screenForCareer로 redirect했어야 한다. 방어적 fallback.
    return null;
  }

  async function handleNext() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    try {
      const result = await advanceMutation.mutateAsync({ careerId });
      if (result.ok) {
        const target = screenForCareer(result.domainSnapshot.state);
        void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
        return;
      }
      const details = result.error.details;
      const reason = typeof details === 'object' && details !== null && 'reason' in details ? (details as { reason?: unknown }).reason : undefined;
      if (reason === 'NOTHING_TO_ADVANCE') {
        // 정산 단계에서 더 진행할 게 없다 — 결과 화면에 남을 이유가 없으니 현재 상태 그대로
        // screenForCareer로 이동한다(보통 SCR-029).
        const target = screenForCareer(state);
        void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
        return;
      }
      setErrorMessage('다음으로 넘어가지 못했습니다. 다시 시도해 주세요.');
    } catch {
      setErrorMessage('다음으로 넘어가지 못했습니다. 다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-os-6">
      <p className="sr-only" aria-live="polite" data-testid="event-result-announcement">
        {announcement}
      </p>
      <ResultCard kind={view.kind} kindLabel={view.kindLabel} title={view.title} body={view.body} effects={view.effects} tags={view.tags} />
      <Button variant="primary" onClick={handleNext} disabled={advanceMutation.isPending}>
        다음
      </Button>
      {errorMessage ? <ErrorState message={errorMessage} onRetry={handleNext} /> : null}
    </div>
  );
}
