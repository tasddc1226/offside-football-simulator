// SCR-013 범용 이벤트 화면과 그 변형(SCR-007 진로 선택, SCR-008 입단 테스트)이 공유하는 본문.
// 서사·선택지·확정 흐름은 셋이 동일하고, renderAbove(추가 비교 카드)·onResolved(확정 후 동작)만
// 화면마다 다르다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { CareerState } from '@offside/domain';
import type { EventDefinition } from '@offside/content';
import type { ExecuteSuccess } from '@offside/engine-client';
import {
  Button,
  ChoiceCard,
  ErrorState,
  PlayerHeader,
  RadioGroup,
  ScreenIntro,
  Skeleton,
  StatusStrip,
} from '@offside/ui';
import { contentForCareer, rulesetForCareer } from '../engine/content.js';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { platform } from '../platform/index.js';
import { SCREEN_ROUTES } from '../routes.js';
import { archetypeName } from './current-team.js';
import { positionHeaderField, POSITION_LABELS, RISK_LABEL_KO } from './labels.js';
import { buildNarrativeTokens, renderNarrative, type NarrativeTokenValues } from './narrative.js';
import { eventSituation } from './legacy-event-copy.js';
import { u18StatusStripItems } from './status-strip.js';
import { useCommittingExitGuard } from './use-committing-exit-guard.js';
import { GamePending } from './game-presentation.js';

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;

export type EventScreenId = 'SCR-007' | 'SCR-008' | 'SCR-013' | 'SCR-016' | 'SCR-018' | 'SCR-019' | 'SCR-021' | 'SCR-022' | 'SCR-024' | 'SCR-032';

const EVENT_INTRO: Record<EventScreenId, { eyebrow: string; title: string }> = {
  'SCR-007': { eyebrow: '다음 무대', title: '어떤 길을 걸어갈까요?' },
  'SCR-008': { eyebrow: '기회를 잡을 시간', title: '입단 테스트' },
  'SCR-013': { eyebrow: '나의 축구 인생', title: '커리어의 갈림길' },
  'SCR-016': { eyebrow: '흔들리는 순간', title: '나의 원칙을 지킬 시간' },
  'SCR-018': { eyebrow: '함께 뛰는 사람들', title: '라커룸의 온도' },
  'SCR-019': { eyebrow: '다음 무대의 관심', title: '이적 이야기가 들려옵니다' },
  'SCR-021': { eyebrow: '다시 나의 리듬으로', title: '슬럼프를 마주하다' },
  'SCR-022': { eyebrow: '복귀를 준비하며', title: '지금은 회복할 시간' },
  'SCR-024': { eyebrow: '그라운드 밖의 목소리', title: '어떤 말을 남길까요?' },
  'SCR-032': { eyebrow: '더 큰 무대의 부름', title: '대표팀 소집 통보' },
};

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

export function EventDecisionScreen({
  careerId,
  screenId,
  renderAbove,
  onResolved,
}: EventDecisionScreenProps) {
  const query = useCareer(careerId);
  const resolveMutation = useCareerMutation('resolveEvent');
  const navigate = useNavigate();
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useCommittingExitGuard(resolveMutation.isPending);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId,
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
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
        message={
          query.error instanceof Error ? query.error.message : '커리어를 불러오지 못했습니다'
        }
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { state } = query.data;
  const pending = state.pending;
  if (pending === null || (pending.kind !== 'EVENT' && pending.kind !== 'INJURY' && pending.kind !== 'NATIONAL_TEAM')) {
    // 라우트 loader가 이미 screenForCareer로 redirect했어야 한다. 방어적 fallback.
    return null;
  }

  const pack = contentForCareer(state);
  const ruleset = rulesetForCareer(state);
  const definition = pack.eventsById.get(pending.eventId);
  if (definition === undefined) {
    return <ErrorState message={`이벤트 정의를 찾을 수 없습니다: ${pending.eventId}`} />;
  }

  const tokens = buildNarrativeTokens(state, pack, ruleset);
  const profile = state.player.profile;
  const positionField = profile
    ? positionHeaderField(profile.primaryPosition, profile.preferredPosition)
    : {
        label: '포지션',
        value: state.player.draft.position ? POSITION_LABELS[state.player.draft.position] : '—',
      };

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
      platform.analytics.track('choice_selected', {
        eventId: definition!.id,
        choiceId: choice.id,
        riskLabel: choice.riskLabel,
      });
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
    <div className="os-screen">
      <ScreenIntro {...EVENT_INTRO[screenId]} />

      <section className="os-story-card" aria-label="현재 상황">
        <p className="os-eyebrow">
          {tokens.name} · {tokens.team}
        </p>
        <p className="font-os text-os-text" style={BODY_STYLE}>
          {renderNarrative(eventSituation(definition), tokens)}
        </p>
      </section>

      <details className="os-panel">
        <summary className="cursor-pointer font-os font-semibold text-os-text">
          선수 상태 보기
        </summary>
        <div className="mt-os-4 flex flex-col gap-os-3">
          <PlayerHeader
            name={tokens.name}
            team={tokens.team}
            position={positionField}
            archetype={{
              label: '아키타입',
              value: archetypeName(
                ruleset,
                profile?.archetypeId ?? state.player.draft.archetypeId,
              ),
            }}
            shirtNumber={{
              label: '등번호',
              value: state.contract ? String(state.contract.shirtNumber) : '—',
            }}
          />
          <StatusStrip items={u18StatusStripItems(state)} />
        </div>
      </details>

      {renderAbove?.({ state, definition, tokens })}

      <section className="flex flex-col gap-os-3" aria-labelledby="event-choice-heading">
        <div className="flex items-center justify-between gap-os-3">
          <h2 id="event-choice-heading" className="os-section-title">
            어떻게 행동할까요?
          </h2>
          <span className="os-muted" style={{ fontSize: 'var(--os-fs-caption)' }}>
            하나를 선택하세요
          </span>
        </div>
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
              effects={choice.previewEffects
                .filter((preview) => pending.kind !== 'NATIONAL_TEAM' || !preview.label.startsWith('특례 규칙:'))
                .map((preview) => preview.label)}
              selectedLabel="선택됨"
              disabled={resolveMutation.isPending}
            />
          ))}
        </RadioGroup>
      </section>

      {errorMessage ? <ErrorState message={errorMessage} onRetry={handleConfirm} /> : null}

      {resolveMutation.isPending ? (
        <GamePending
          title="선택을 확정하고 있습니다"
          detail="결과가 저장되면 실제 변화와 함께 공개됩니다."
        />
      ) : null}

      <div className="os-action-dock">
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={selectedChoiceId === null || resolveMutation.isPending}
        >
          {resolveMutation.isPending ? '확정 중' : '확정'}
        </Button>
      </div>
    </div>
  );
}

export { H1_STYLE, BODY_STYLE };
