// SCR-013 범용 이벤트 화면과 그 변형(SCR-007 진로 선택, SCR-008 입단 테스트)이 공유하는 본문.
// 서사·선택지·확정 흐름은 셋이 동일하고, renderAbove(추가 비교 카드)·onResolved(확정 후 동작)만
// 화면마다 다르다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { CareerState } from '@offside/domain';
import type { EventDefinition } from '@offside/content';
import type { ExecuteSuccess } from '@offside/engine-client';
import { Button, ChoiceCard, ErrorState, PlayerHeader, RadioGroup, Skeleton, StatusStrip } from '@offside/ui';
import { activeContentPack, activeRuleset } from '../engine/content.js';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { platform } from '../platform/index.js';
import { SCREEN_ROUTES } from '../routes.js';
import { archetypeName } from './current-team.js';
import { positionHeaderField, POSITION_LABELS, RISK_LABEL_KO } from './labels.js';
import { buildNarrativeTokens, renderNarrative, type NarrativeTokenValues } from './narrative.js';
import { u18StatusStripItems } from './status-strip.js';
import { useCommittingExitGuard } from './use-committing-exit-guard.js';

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;

export type EventScreenId = 'SCR-007' | 'SCR-008' | 'SCR-013';

export interface EventDecisionContext {
  state: CareerState;
  definition: EventDefinition;
  tokens: NarrativeTokenValues;
}

export interface EventDecisionScreenProps {
  careerId: string;
  screenId: EventScreenId;
  /** SCR-007의 정찰 범위·CompareCards처럼 서사 위에 덧붙일 내용. */
  renderAbove?: (ctx: EventDecisionContext) => ReactNode;
  /** 확정 성공 뒤 동작. 기본은 SCR-014로 곧장 이동한다(navigateToResult). SCR-008은 연출을 먼저 보여준 뒤 이걸 호출한다. */
  onResolved?: (result: ExecuteSuccess, navigateToResult: () => void) => void;
}

export function EventDecisionScreen({ careerId, screenId, renderAbove, onResolved }: EventDecisionScreenProps) {
  const query = useCareer(careerId);
  const resolveMutation = useCareerMutation('resolveEvent');
  const navigate = useNavigate();
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useCommittingExitGuard(resolveMutation.isPending);

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId, careerPhase: query.data?.state.seasonPhase ?? 'NONE' });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-os-4" aria-label="불러오는 중">
        <Skeleton className="h-os-8 w-full" />
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
  const pending = state.pending;
  if (pending === null || pending.kind !== 'EVENT') {
    // 라우트 loader가 이미 screenForCareer로 redirect했어야 한다. 방어적 fallback.
    return null;
  }

  const definition = activeContentPack.eventsById.get(pending.eventId);
  if (definition === undefined) {
    return <ErrorState message={`이벤트 정의를 찾을 수 없습니다: ${pending.eventId}`} />;
  }

  const tokens = buildNarrativeTokens(state, activeContentPack, activeRuleset);
  const profile = state.player.profile;
  const positionField = profile
    ? positionHeaderField(profile.primaryPosition, profile.preferredPosition)
    : { label: '포지션', value: state.player.draft.position ? POSITION_LABELS[state.player.draft.position] : '—' };

  function handleSelect(choiceId: string) {
    setSelectedChoiceId(choiceId);
    setErrorMessage(null);
    // definition은 위에서 undefined 체크를 거친 const지만, TS는 뒤에서 정의되는 이벤트 핸들러
    // 클로저까지 그 좁힘을 전파하지 않는다.
    platform.analytics.track('choice_previewed', { eventId: definition!.id, choiceId });
  }

  async function handleConfirm() {
    if (selectedChoiceId === null || submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    // definition은 위에서 undefined 체크를 거친 const지만, TS는 뒤에서 정의되는 이벤트 핸들러
    // 클로저까지 그 좁힘을 전파하지 않는다.
    const choice = definition!.choices.find((candidate) => candidate.id === selectedChoiceId);
    if (choice !== undefined) {
      platform.analytics.track('choice_selected', { eventId: definition!.id, choiceId: choice.id, riskLabel: choice.riskLabel });
    }
    try {
      const result = await resolveMutation.mutateAsync({ careerId, choiceId: selectedChoiceId });
      if (!result.ok) {
        setErrorMessage('선택을 확정하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      const navigateToResult = () => {
        void navigate({
          to: SCREEN_ROUTES['SCR-014'],
          params: { careerId },
          search: { rev: result.domainSnapshot.revision },
        });
      };
      if (onResolved) {
        onResolved(result, navigateToResult);
      } else {
        navigateToResult();
      }
    } catch {
      setErrorMessage('선택을 확정하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-os-6">
      <PlayerHeader
        name={tokens.name}
        team={tokens.team}
        position={positionField}
        archetype={{ label: '아키타입', value: archetypeName(activeRuleset, profile?.archetypeId ?? state.player.draft.archetypeId) }}
        shirtNumber={{ label: '등번호', value: state.contract ? String(state.contract.shirtNumber) : '—' }}
      />
      <StatusStrip items={u18StatusStripItems(state)} />

      {renderAbove?.({ state, definition, tokens })}

      <p className="font-os text-os-text" style={BODY_STYLE}>
        {renderNarrative(definition.narrative.situation, tokens)}
      </p>

      <RadioGroup
        aria-label="선택지"
        value={selectedChoiceId}
        onValueChange={handleSelect}
        className="flex flex-col gap-os-3"
      >
        {definition.choices.map((choice) => (
          <ChoiceCard
            key={choice.id}
            value={choice.id}
            label={choice.label}
            riskLevel={choice.riskLabel}
            riskLabel={RISK_LABEL_KO[choice.riskLabel]}
            effects={choice.previewEffects.map((preview) => preview.label)}
            selectedLabel="선택됨"
            disabled={resolveMutation.isPending}
          />
        ))}
      </RadioGroup>

      {errorMessage ? <ErrorState message={errorMessage} onRetry={handleConfirm} /> : null}

      <Button
        variant="primary"
        onClick={handleConfirm}
        disabled={selectedChoiceId === null || resolveMutation.isPending}
      >
        확정
      </Button>
    </div>
  );
}

export { H1_STYLE, BODY_STYLE };
