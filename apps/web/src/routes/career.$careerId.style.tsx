// SCR-003 플레이 스타일·아키타입. draft 포지션의 아키타입 3개를 CompareCards로 비교하고
// RadioGroup으로 하나 고른다. 잠재력·최종 OVR은 어디에도 보이지 않는다.
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  CompareCards,
  ErrorState,
  FootballMark,
  RadioGroup,
  RadioGroupItem,
  ScreenIntro,
  Skeleton,
  Stepper,
} from '@offside/ui';
import type { CompareCardItem, CompareRow } from '@offside/ui';
import { RETRYABLE_BY_CODE } from '@offside/contracts';
import type { Position } from '@offside/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { rulesetForCareer } from '../engine/content.js';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { platform } from '../platform/index.js';
import { POSITION_LABELS } from '../shared/labels.js';
import {
  archetypesForPosition,
  attributeLabelList,
  PLAYER_CREATION_CAREER_PHASE,
  PLAYER_CREATION_STEPS,
  topAttributeKeys,
  weakestAttributeKeys,
} from '../shared/player-draft.js';
import { useScreenState } from '../shared/screen-state.js';
import { useCareerStepGuard } from '../shared/use-career-guard.js';

export const Route = createFileRoute('/career/$careerId/style')({
  component: StyleScreen,
});

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function buildCompareData(ruleset: ReturnType<typeof rulesetForCareer>, position: Position): { cards: CompareCardItem[]; rows: CompareRow[] } {
  const archetypes = archetypesForPosition(ruleset, position);
  const cards: CompareCardItem[] = archetypes.map((archetype) => ({
    id: archetype.id,
    title: archetype.name,
  }));
  const rows: CompareRow[] = [
    {
      id: 'strengths',
      label: '핵심 능력',
      cells: archetypes.map((archetype) => ({
        value: attributeLabelList(topAttributeKeys(archetype, 3)),
      })),
    },
    {
      id: 'weaknesses',
      label: '약점',
      cells: archetypes.map((archetype) => ({
        value: attributeLabelList(weakestAttributeKeys(archetype, 2)),
      })),
    },
    {
      id: 'role',
      label: '예상 역할',
      cells: archetypes.map((archetype) => ({ value: archetype.summary })),
    },
  ];
  return { cards, rows };
}

function StyleScreen() {
  const { careerId } = Route.useParams();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const blocked = useCareerStepGuard(query.data?.state, 'SCR-003');
  const updateDraftMutation = useCareerMutation('updateDraft');

  const screen = useScreenState<never, Record<string, never>>({ kind: 'LOADING' });
  const { state: screenState, toDraft, toCommitting, toError } = screen;

  const [archetypeId, setArchetypeId] = useState<string>('');
  const [error, setError] = useState<string | undefined>(undefined);
  const seededRef = useRef(false);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-003',
      careerPhase: PLAYER_CREATION_CAREER_PHASE,
    });
  }, []);

  useEffect(() => {
    if (blocked || query.data === undefined || seededRef.current) return;
    seededRef.current = true;
    setArchetypeId(query.data.state.player.draft.archetypeId ?? '');
    toDraft({});
  }, [blocked, query.data, toDraft]);

  const committing = screenState.kind === 'COMMITTING';
  const position = query.data?.state.player.draft.position;
  const ruleset = query.data === undefined ? null : rulesetForCareer(query.data.state);

  async function handleNext() {
    if (archetypeId === '') {
      setError('스타일을 하나 선택해 주세요.');
      return;
    }
    setError(undefined);

    const commandId = crypto.randomUUID();
    toCommitting(commandId);

    try {
      const result = await updateDraftMutation.mutateAsync({ careerId, draft: { archetypeId } });
      if (result.ok) {
        void navigate({ to: '/career/$careerId/confirm', params: { careerId } });
      } else {
        toError({
          code: result.error.code,
          message: result.error.message,
          retryable: RETRYABLE_BY_CODE[result.error.code],
        });
      }
    } catch {
      toError({
        code: 'UNKNOWN',
        message: '저장하지 못했습니다. 다시 시도해 주세요.',
        retryable: true,
      });
    }
  }

  if (blocked || screenState.kind === 'LOADING' || position === undefined || position === null) {
    return (
      <div className="flex flex-col gap-os-4" aria-label="불러오는 중">
        <Skeleton className="h-os-8 w-full" />
        <Skeleton className="h-os-8 w-full" />
        <Skeleton className="h-os-8 w-full" />
        <Skeleton className="h-os-8 w-full" />
      </div>
    );
  }

  if (screenState.kind === 'ERROR') {
    return (
      <ErrorState
        message={screenState.message}
        {...(screenState.retryable ? { onRetry: () => void handleNext() } : {})}
        recoveryAction={
          <Button variant="secondary" onClick={() => toDraft({})}>
            돌아가기
          </Button>
        }
      />
    );
  }

  if (ruleset === null) return null;
  const { cards, rows } = buildCompareData(ruleset, position);

  return (
    <div className="os-screen">
      <Stepper steps={PLAYER_CREATION_STEPS} currentStepId="style" />
      <ScreenIntro
        eyebrow="선수의 색깔"
        title="플레이 스타일을 고르세요"
        description="잘하는 것과 보완할 것을 비교하고, 경기장에서 보여줄 나만의 무기를 정하세요."
      />
      <div className="os-panel flex items-center gap-os-3">
        <FootballMark className="h-os-6 w-os-6 shrink-0 text-os-accent" />
        <div className="min-w-0 flex-1">
          <p className="font-os font-semibold text-os-text">
            {query.data?.state.player.draft.name}
          </p>
          <p className="os-muted" style={CAPTION_STYLE}>
            선호 포지션 · {POSITION_LABELS[position]}
          </p>
        </div>
      </div>
      <section className="flex flex-col gap-os-3" aria-labelledby="style-compare-heading">
        <h2
          id="style-compare-heading"
          className="font-os font-semibold text-os-text"
          style={H2_STYLE}
        >
          아키타입 비교
        </h2>

        <RadioGroup
          aria-labelledby="style-compare-heading"
          aria-describedby={error !== undefined ? 'style-error' : undefined}
          value={archetypeId}
          onValueChange={setArchetypeId}
        >
          <CompareCards
            cards={cards.map((card) => ({
              ...card,
              renderAction: (layout) => (
                <RadioGroupItem
                  key={`${card.id}-${layout}`}
                  value={card.id}
                  disabled={committing}
                  aria-label={`${card.title} 선택`}
                  className="w-full p-os-3 text-center"
                >
                  {archetypeId === card.id ? '선택됨' : '선택'}
                </RadioGroupItem>
              ),
            }))}
            rows={rows}
          />
        </RadioGroup>
        {error !== undefined ? (
          <p id="style-error" role="alert" className="font-os text-os-danger" style={CAPTION_STYLE}>
            {error}
          </p>
        ) : null}
      </section>

      <div className="os-action-dock os-action-row">
        <Button
          variant="secondary"
          disabled={committing}
          onClick={() => void navigate({ to: '/career/$careerId/create', params: { careerId } })}
        >
          이전
        </Button>
        <Button variant="primary" onClick={() => void handleNext()} disabled={committing}>
          {committing ? '저장하는 중' : '다음'}
        </Button>
      </div>
    </div>
  );
}
