// SCR-014 선택 결과 카드. `rev` 검색 파라미터가 가리키는 EVENT_RESOLVED 타임라인 항목만으로
// 결과를 재구성한다(event-result.ts) — appliedEffects를 쓰지 않으므로 새로고침·뒤로 가기가
// roll을 다시 소비하지 않는다. "다음"은 advance를 실행하고 결과 상태를 screenForCareer로 해석해
// 이동한다 — NOTHING_TO_ADVANCE(정산 단계에서 더 진행할 게 없음)만 그렇게 처리하고, 그 외 실패는
// 결과 화면에 남아 오류를 보여준다(오류를 조용히 삼키고 이동하지 않는다).
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { decodeSnapshot } from '@offside/engine-client';
import { Button, ErrorState, ResultCard, ScreenIntro, Skeleton } from '@offside/ui';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { contentForCareer } from '../engine/content.js';
import { getAppEngine } from '../engine/engine.js';
import { screenForCareer } from '../shared/career-route.js';
import { actualEventEffects, eventResultTagLabel, resolveEventResultView } from '../shared/event-result.js';
import { INJURY_BODY_PART_LABELS, INJURY_SEVERITY_LABELS, REHAB_PLAN_LABELS } from '../shared/labels.js';
import { platform } from '../platform/index.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { GameResultReveal } from '../shared/game-presentation.js';

type EventResultSearch = { rev: number };

export const Route = createFileRoute('/career/$careerId/event_/result')({
  validateSearch: (search: Record<string, unknown>): EventResultSearch => ({
    rev: Number(search.rev),
  }),
  loaderDeps: ({ search }) => ({ rev: search.rev }),
  loader: async ({ params, deps }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const view = resolveEventResultView(state, contentForCareer(state), deps.rev);
    if (view === null) {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
    // 읽기만 한다. 과거 결과에 현재 상태를 섞거나 결과 RNG를 다시 실행하지 않는다.
    const engine = await getAppEngine();
    const records = await engine.store.transaction('readonly', async (tx) =>
      Promise.all([tx.snapshots.get(params.careerId, deps.rev - 1), tx.snapshots.get(params.careerId, deps.rev)]),
    );
    const [before, after] = records.map((record) => record ? decodeSnapshot(record) : null);
    const historical = after?.ok ? after.snapshot.state : null;
    const rehab = historical?.timeline.find((entry) => entry.revision === deps.rev && entry.kind === 'REHAB_CHOSEN');
    return {
      actualEffects: before?.ok && historical ? actualEventEffects(before.snapshot.state, historical) : null,
      episode: historical?.health.episodes.find((entry) => entry.id === rehab?.refId) ?? null,
      nextKind: historical?.pending?.kind ?? null,
    };
  },
  component: EventResultScreen,
});

function EventResultScreen() {
  const { careerId } = Route.useParams();
  const { rev } = Route.useSearch();
  const details = Route.useLoaderData();
  const query = useCareer(careerId);
  const advanceMutation = useCareerMutation('advance');
  const navigate = useNavigate();
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const view =
    query.data === undefined
      ? null
      : resolveEventResultView(query.data.state, contentForCareer(query.data.state), rev);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-014',
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
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
        message={
          query.error instanceof Error ? query.error.message : '커리어를 불러오지 못했습니다'
        }
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { state } = query.data;
  if (view === null) {
    // 라우트 loader가 이미 screenForCareer로 redirect했어야 한다. 방어적 fallback.
    return null;
  }
  const eventEntry = state.timeline.find((candidate) => candidate.revision === rev && candidate.kind === 'EVENT_RESOLVED');
  const eventDefinition = eventEntry?.refId ? contentForCareer(state).eventsById.get(eventEntry.refId.split(':')[0] ?? '') : undefined;

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
      const reason =
        typeof details === 'object' && details !== null && 'reason' in details
          ? (details as { reason?: unknown }).reason
          : undefined;
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
    <div className="os-screen">
      <ScreenIntro
        eyebrow="이어지는 이야기"
        title="선택의 결과"
        description="당신의 결정이 커리어에 남긴 변화를 확인하세요."
      />
      <GameResultReveal
        fast={state.simulationMode === 'FAST'}
        announcement={`${view.kindLabel}: ${view.title}`}
        announcementTestId="event-result-announcement"
      >
        <ResultCard
          kind={view.kind}
          kindLabel={view.kindLabel}
          title={view.title}
          body={view.body}
          effects={details.actualEffects ?? view.effects}
          tags={view.tags.map(eventResultTagLabel).filter((label): label is string => label !== null)}
        />
      </GameResultReveal>
      <p className="os-muted">{details.actualEffects === null
        ? '이 기기에는 당시의 상세 저장 기록이 없어 선택의 기본 효과를 표시합니다. 상한과 중복 적용에 따라 실제 변화는 달라질 수 있습니다.'
        : '선택 직전과 직후의 저장값을 비교한 실제 변화입니다. 이후 적용될 효과는 선택 안내를 참고하세요.'}</p>
      {details.episode !== null || eventDefinition?.presentation === 'NATIONAL_TEAM' || details.nextKind !== null ? (
        <section className="os-panel flex flex-col gap-os-2" aria-label="결과 상세">
          <h2 className="font-os font-semibold text-os-text">이어지는 영향</h2>
          {eventDefinition?.presentation === 'INJURY' && details.episode ? (
            <p className="font-os text-os-text-2">{INJURY_BODY_PART_LABELS[details.episode.bodyPart]} · {INJURY_SEVERITY_LABELS[details.episode.severity]} · {details.episode.diagnosisRange.minMatches}~{details.episode.diagnosisRange.maxMatches}경기 · {details.episode.rehab ? REHAB_PLAN_LABELS[details.episode.rehab] : '진단 대기'}</p>
          ) : null}
          {eventDefinition?.presentation === 'NATIONAL_TEAM' ? <p className="font-os text-os-text-2">대표팀 결과 · 감독 신뢰는 변하지 않습니다 · 에이전트 관계는 협회 관계의 대리값입니다</p> : null}
          {details.nextKind !== null ? <p className="font-os text-os-text-2">이 선택에 이어진 이야기: {details.nextKind === 'EVENT' ? '새 이벤트 선택' : details.nextKind === 'NATIONAL_TEAM' ? '대표팀 선택' : details.nextKind === 'INJURY' ? '재활 계획 선택' : '다음 결정'}</p> : null}
        </section>
      ) : null}
      {errorMessage ? <ErrorState message={errorMessage} onRetry={handleNext} /> : null}
      <div className="os-action-dock">
        <Button variant="primary" onClick={handleNext} disabled={advanceMutation.isPending}>
          다음
        </Button>
      </div>
    </div>
  );
}
