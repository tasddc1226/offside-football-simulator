// SCR-031 핵심 경기 챕터. 한 라우트 안에서 경기 전 맥락(상단 고정) → 판단 1~3개(ChoiceCard,
// RESOLVE_CHAPTER) → 경기 결과까지 이동 없이 이어진다. 서버 상태(pending.resolved · season.chapters ·
// timeline)만으로 화면을 그리므로(chapter-state.ts) 새로고침·뒤로 가기는 확정된 판단까지만 재생하고
// roll을 다시 소비하지 않는다 — "다음 판단"을 누르기 전 새로고침하면 그 판단은 접힌 카드로 다시
// 열리지 않는다(로컬 cursor가 서버 값으로 재초기화된다).
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  deriveTacticalRoom,
  positionGroupOf,
  type MatchAppearance,
  type PositionStats,
  type SelectionRanking,
} from '@offside/domain';
import {
  Button,
  ChoiceCard,
  ErrorState,
  RadioGroup,
  ResultCard,
  ScreenIntro,
  Skeleton,
  StatusStrip,
} from '@offside/ui';
import type { ChapterDefinition } from '@offside/content';
import { contentForCareer, rulesetForCareer } from '../engine/content.js';
import { opponentDisplayName } from '../shared/competition-labels.js';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import { archetypeName, currentTeamName } from '../shared/current-team.js';
import {
  deriveChapterView,
  type ChapterView,
  type ResolvedChapterDecision,
} from '../shared/chapter-state.js';
import {
  ChapterScoreboard,
  decisionMinute,
  decisionTimeLabel,
  scoreAtDecision,
} from '../shared/chapter-scoreboard.js';
import { formatEffectSummary } from '../shared/effect-summary.js';
import { buildNarrativeTokens, renderNarrative } from '../shared/narrative.js';
import {
  chapterTriggerLabel,
  CUP_ROUND_LABEL_KO,
  EFFECT_TARGET_LABEL_KO,
  OUTCOME_KIND_LABEL_KO,
  positionHeaderField,
  POSITION_GROUP_LABELS,
  resultTagLabels,
  RISK_LABEL_KO,
  SELECTION_REASON_LABEL_KO,
} from '../shared/labels.js';
import { ratingText } from '../shared/season-schedule.js';
import { proStatusStripItems } from '../shared/status-strip.js';
import type { TeamNameOverrides } from '../shared/team-names.js';
import { useUiStore } from '../shared/ui-store.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { platform } from '../platform/index.js';
import { useCommittingExitGuard } from '../shared/use-committing-exit-guard.js';
import { GamePending, GameResultReveal } from '../shared/game-presentation.js';

type ChapterSearch = { d: number };

export const Route = createFileRoute('/career/$careerId/chapter')({
  validateSearch: (search: Record<string, unknown>): ChapterSearch => ({ d: Number(search.d) }),
  loaderDeps: ({ search }) => ({ d: search.d }),
  loader: async ({ params, deps }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const view = deriveChapterView(state, contentForCareer(state));
    if (view === null) {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
    // 뒤로 가기·딥링크로 지금 상태와 다른 d가 오면 현재 판단 인덱스로 바로잡는다(이전 판단을
    // 다시 열지 않는다) — 컴포넌트는 이 URL을 읽지 않고 항상 서버 상태에서 다시 계산한다.
    if (deps.d !== view.currentDecisionIndex) {
      throw redirect({
        to: '/career/$careerId/chapter',
        params,
        search: { d: view.currentDecisionIndex },
        replace: true,
      });
    }
  },
  component: ChapterScreen,
});

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;
const NUM_STYLE = { fontSize: 'var(--os-fs-num-xl)', lineHeight: 'var(--os-lh-num-xl)' } as const;

const APPEARANCE_CONTEXT_LABEL: Record<MatchAppearance, string> = {
  START: '선발 출전',
  SUB: '교체 투입',
  OUT: '결장',
};

const POSITION_STAT_LABEL_KO: Record<string, string> = {
  goals: '득점',
  assists: '도움',
  xgCenti: '기대 득점',
  shots: '슈팅',
  offsides: '오프사이드',
  chancesCreated: '찬스 메이킹',
  progressivePasses: '전진 패스',
  passesAttempted: '시도 패스',
  passesCompleted: '성공 패스',
  ballRecoveries: '볼 리커버리',
  tackles: '태클',
  interceptions: '인터셉트',
  aerialsWon: '공중볼 경합 승리',
  goalsConcededInvolved: '실점 관여',
  cleanSheet: '무실점',
  saves: '선방',
  psxgMinusGoalsCenti: 'PSxG-실점',
  crossesClaimed: '크로스 캐치',
  buildUpPasses: '빌드업 패스',
};

function formatStatValue(key: string, value: number | boolean): string {
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (key === 'xgCenti' || key === 'psxgMinusGoalsCenti') return (value / 100).toFixed(2);
  return String(value);
}

function positionStatEntries(
  stats: PositionStats,
): Array<{ key: string; label: string; value: string }> {
  return Object.entries(stats)
    .filter(([key]) => key !== 'group')
    .map(([key, value]) => ({
      key,
      label: POSITION_STAT_LABEL_KO[key] ?? key,
      value: formatStatValue(key, value as number | boolean),
    }));
}

function chapterCompetitionLabel(view: ChapterView): string {
  if (view.context.kind === 'NATIONAL_TEAM') return '대표팀';
  const match = view.match;
  if (match.kind === 'LEAGUE') return '리그';
  if (match.round === null) return '컵';
  const label = (CUP_ROUND_LABEL_KO as Record<string, string | undefined>)[match.round];
  return label === undefined ? '컵' : `컵 · ${label}`;
}

function chapterContextLabel(
  view: ChapterView,
  ruleset: ReturnType<typeof rulesetForCareer>,
  teamNameOverrides: TeamNameOverrides,
): string {
  if (view.context.kind === 'NATIONAL_TEAM') {
    return `${chapterCompetitionLabel(view)} · ${view.context.opponent.opponentName}`;
  }
  return `${chapterCompetitionLabel(view)} · ${view.context.home ? '홈' : '원정'} · ${opponentDisplayName(view.context.opponent, ruleset, teamNameOverrides)}`;
}

function playerReasonText(reason: SelectionRanking['playerReason']): string | null {
  if (reason === null) return null;
  const sign = reason.delta > 0 ? '+' : '';
  return `${SELECTION_REASON_LABEL_KO[reason.component]} 차이 ${sign}${reason.delta}`;
}

function formatSignedTenths(tenths: number): string {
  const sign = tenths > 0 ? '+' : '';
  return `${sign}${(tenths / 10).toFixed(1)}`;
}

function aggregateEffectDeltas(
  resolved: ResolvedChapterDecision[],
): Array<{ target: string; delta: number }> {
  const totals = new Map<string, number>();
  for (const { outcome } of resolved) {
    for (const effect of outcome.effects) {
      totals.set(effect.target, (totals.get(effect.target) ?? 0) + effect.delta);
    }
  }
  return Array.from(totals.entries()).map(([target, delta]) => ({ target, delta }));
}

function collectedAddedTags(resolved: ResolvedChapterDecision[]): string[] {
  return Array.from(new Set(resolved.flatMap(({ outcome }) => outcome.addTags ?? [])));
}

interface DecisionInputProps {
  decision: ChapterDefinition['decisions'][number];
  submitting: boolean;
  errorMessage: string | null;
  onConfirm: (optionId: string) => void;
}

function DecisionInput({ decision, submitting, errorMessage, onConfirm }: DecisionInputProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  function confirmSelected() {
    if (selectedOptionId !== null) onConfirm(selectedOptionId);
  }

  return (
    <div className="flex flex-col gap-os-4">
      <div className="os-story-card flex flex-col gap-os-3">
        <p className="os-eyebrow">당신의 판단</p>
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          {decision.prompt}
        </p>
      </div>
      <RadioGroup
        aria-label="판단 선택지"
        value={selectedOptionId}
        onValueChange={setSelectedOptionId}
        className="flex flex-col gap-os-3"
      >
        {decision.options.map((option) => {
          const effects = [
            ...(option.priorProbability !== null
              ? [`성공 확률 약 ${Math.round(option.priorProbability.successBp / 100)}%`]
              : []),
            ...option.previewEffects.map((preview) => preview.label),
          ];
          return (
            <ChoiceCard
              key={option.id}
              value={option.id}
              label={option.label}
              riskLevel={option.riskLabel}
              riskLabel={RISK_LABEL_KO[option.riskLabel]}
              effects={effects}
              selectedLabel="선택됨"
              disabled={submitting}
            />
          );
        })}
      </RadioGroup>
      {errorMessage ? <ErrorState message={errorMessage} onRetry={confirmSelected} /> : null}
      <div className="os-action-dock">
        <Button
          variant="primary"
          disabled={selectedOptionId === null || submitting}
          onClick={confirmSelected}
        >
          확정
        </Button>
      </div>
    </div>
  );
}

interface DecisionResultProps {
  resolved: ResolvedChapterDecision;
  tokens: ReturnType<typeof buildNarrativeTokens>;
}

function decisionResultCardProps(
  resolved: DecisionResultProps['resolved'],
  tokens: DecisionResultProps['tokens'],
) {
  const { option, outcome } = resolved;
  return {
    kind: outcome.kind,
    kindLabel: OUTCOME_KIND_LABEL_KO[outcome.kind],
    title: outcome.title,
    body: `${option.label} — ${renderNarrative(outcome.narrative.situation, tokens)}`,
    effects: outcome.effects.map(formatEffectSummary),
    tags: resultTagLabels(outcome.addTags ?? []),
  };
}

/** 확정 직후(아직 "다음 판단"을 누르지 않은) 판단은 항상 펼쳐진 상태로, 그 이전 판단들은 접힌
 * 요약 한 줄 + 펼치기 토글로 보여준다(브리프 "재생"). */
function CollapsibleDecisionResult({
  index,
  resolved,
  tokens,
}: DecisionResultProps & { index: number }) {
  const [expanded, setExpanded] = useState(false);
  const { option, outcome } = resolved;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between gap-os-2 rounded-os-m border border-os-border bg-os-surface-2 px-os-3 py-os-3 text-left font-os text-os-text-2"
        style={{ ...CAPTION_STYLE, minHeight: 'var(--os-touch-min)' }}
        aria-expanded={false}
      >
        <span>
          {decisionTimeLabel(index + 1)} · {option.label} → {outcome.title}
        </span>
        <span className="shrink-0" aria-hidden="true">
          펼치기 +
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-os-1">
      <ResultCard {...decisionResultCardProps(resolved, tokens)} />
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="self-start font-os text-os-text-2 underline"
        style={{ ...CAPTION_STYLE, minHeight: 'var(--os-touch-min)' }}
        aria-expanded={true}
      >
        접기 · {decisionTimeLabel(index + 1)}
      </button>
    </div>
  );
}

function ChapterScreen() {
  const { careerId } = Route.useParams();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const resolveMutation = useCareerMutation('resolveChapter');
  const teamNameOverrides = useUiStore((uiState) => uiState.teamNameOverrides);
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // 서버가 이미 확정한 판단이라도, 사용자가 "다음 판단"/"경기 결과"를 누르기 전까지는 그 결과
  // 카드를 펼친 채로 보여준다 — 이 로컬 진행 커서가 그 경계다. 마운트 시 서버 값으로 한 번만
  // 초기화하고(로더가 이미 최신 상태를 캐시에 채웠다), 새로고침하면 다시 서버 값으로 시작한다.
  const [cursor, setCursor] = useState<number>(() => {
    if (query.data === undefined) return 0;
    return deriveChapterView(query.data.state, contentForCareer(query.data.state))?.currentDecisionIndex ?? 0;
  });

  useCommittingExitGuard(resolveMutation.isPending);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-031',
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
  const contentPack = contentForCareer(state);
  const ruleset = rulesetForCareer(state);
  const view: ChapterView | null = deriveChapterView(state, contentPack);
  const season = state.season;
  const profile = state.player.profile;
  if (view === null || season === null || profile === null) return null; // 라우트 loader가 보장한다. 방어적 fallback.

  const decisionsTotal = view.decisionsTotal;
  const displayDecisionNumber = Math.min(cursor + 1, decisionsTotal);
  const minute = decisionMinute(displayDecisionNumber, decisionsTotal);
  const isNationalTeam = view.context.kind === 'NATIONAL_TEAM';
  const score = scoreAtDecision(view.match.result.goalsFor, view.match.result.goalsAgainst, minute);
  const tokens = buildNarrativeTokens(state, contentPack, ruleset, teamNameOverrides);
  const room = isNationalTeam ? null : deriveTacticalRoom(state, ruleset);
  const reasonText = playerReasonText(season.selection.playerReason);

  async function handleConfirm(decisionId: string, optionId: string) {
    if (view === null || submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    try {
      const result = await resolveMutation.mutateAsync({ careerId, decisionId, optionId });
      if (!result.ok) {
        setErrorMessage('판단을 확정하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      const decision = view.definition.decisions.find((candidate) => candidate.id === decisionId);
      const option = decision?.options.find((candidate) => candidate.id === optionId);
      const outcome = option?.outcomes.find((candidate) => candidate.id === result.outcomeId);
      platform.analytics.track('chapter_decision_resolved', {
        chapterId: view.definition.id,
        decisionId,
        optionId,
        outcomeKind: outcome?.kind ?? '',
      });
      setAnnouncement(
        outcome !== undefined
          ? `${OUTCOME_KIND_LABEL_KO[outcome.kind]}: ${outcome.title}`
          : '판단 결과가 확정되었습니다',
      );
    } catch {
      setErrorMessage('판단을 확정하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
    }
  }

  function handleNext() {
    // 브리프: 여기서는 advance를 부르지 않는다 — pending은 이미 null이라 지금 state 그대로
    // screenForCareer가 대시보드로 보낸다. 진행(advance)은 대시보드의 "진행" 버튼 몫이다.
    const target = screenForCareer(state);
    void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
  }

  const positionField = positionHeaderField(profile.primaryPosition, profile.preferredPosition);

  return (
    <div className="os-screen">
      <p className="sr-only" aria-live="polite" data-testid="chapter-announcement">
        {announcement}
      </p>

      <ScreenIntro
        eyebrow="MATCH DAY"
        title={chapterTriggerLabel(view.definition.trigger)}
        description="중요한 순간, 당신의 플레이를 선택해요."
      />
      {view.definition.positionGroups && view.definition.positionGroups.length > 0 ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          포지션 맥락 · {view.definition.positionGroups.map((group) => ({ GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수' })[group]).join(' · ')} 판단 · 현재 {POSITION_GROUP_LABELS[positionGroupOf(profile.primaryPosition)]}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-os-2 border-y border-os-border py-os-3">
        <div className="min-w-0">
          <p className="truncate font-os font-semibold text-os-text">{profile.name} · {positionField.value}</p>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>{currentTeamName(state, ruleset, teamNameOverrides)} · {archetypeName(ruleset, profile.archetypeId)}</p>
        </div>
        <span className="os-num font-os font-semibold text-os-text-2">#{state.contract?.shirtNumber ?? '—'}</span>
      </div>
      <StatusStrip items={proStatusStripItems(state)} />

      <section className="os-panel flex flex-col gap-os-2" aria-label="경기 맥락">
        <p className="os-eyebrow">오늘의 경기</p>
        <p className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          {chapterContextLabel(view, ruleset, teamNameOverrides)}
        </p>
        {!isNationalTeam && (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {APPEARANCE_CONTEXT_LABEL[view.match.appearance]}
          {reasonText !== null ? ` · ${reasonText}` : ''}
        </p>
        )}
        {room !== null ? (
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            감독 지시: {room.styleName} · {room.formation}
          </p>
        ) : null}
      </section>

      {!isNationalTeam && cursor < decisionsTotal ? (
        <div className="os-panel">
          <ChapterScoreboard
            timeLabel={decisionTimeLabel(displayDecisionNumber)}
            score={score}
            fitness={state.state.fitness}
            tacticalInstruction={room !== null ? room.styleName : '—'}
          />
        </div>
      ) : null}

      {view.resolved.slice(0, cursor).map((resolved, index) => (
        <CollapsibleDecisionResult
          key={resolved.entry.decisionId}
          index={index}
          resolved={resolved}
          tokens={tokens}
        />
      ))}

      {cursor < decisionsTotal ? (
        view.resolved.length > cursor ? (
          <div className="flex flex-col gap-os-3">
            <ResultCard {...decisionResultCardProps(view.resolved[cursor]!, tokens)} />
            <div className="os-action-dock">
              <Button variant="primary" onClick={() => setCursor((current) => current + 1)}>
                {cursor + 1 < decisionsTotal ? '다음 판단' : '경기 결과'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DecisionInput
              decision={view.definition.decisions[cursor]!}
              submitting={resolveMutation.isPending}
              errorMessage={errorMessage}
              onConfirm={(optionId) =>
                void handleConfirm(view.definition.decisions[cursor]!.id, optionId)
              }
            />
            {resolveMutation.isPending ? (
              <GamePending
                title={`${decisionTimeLabel(displayDecisionNumber)} 판단을 확정하고 있습니다`}
                detail="경기 결과에 반영될 실제 판정을 저장하고 있습니다."
              />
            ) : null}
          </>
        )
      ) : (
        <GameResultReveal
          fast={state.simulationMode === 'FAST'}
          announcement={isNationalTeam
            ? '대표팀 데뷔 결과가 확정되었습니다'
            : `경기 결과 ${view.match.result.goalsFor} 대 ${view.match.result.goalsAgainst}, 평점 ${ratingText(view.match.ratingTenths)}`}
        >
          <ChapterResultSection view={view} />
        </GameResultReveal>
      )}

      {cursor >= decisionsTotal ? (
        <div className="os-action-dock">
          <Button variant="primary" onClick={handleNext}>
            다음
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ChapterResultSection({ view }: { view: ChapterView }) {
  const match = view.match;
  const isNationalTeam = view.context.kind === 'NATIONAL_TEAM';
  const stats = positionStatEntries(match.stats);
  const changeLines = aggregateEffectDeltas(view.resolved).map(({ target, delta }) => {
    const label = (EFFECT_TARGET_LABEL_KO as Record<string, string | undefined>)[target] ?? target;
    const sign = delta > 0 ? '+' : '';
    return `${label} ${sign}${delta}`;
  });
  const addedTags = resultTagLabels(collectedAddedTags(view.resolved));

  return (
    <div className="os-panel flex flex-col gap-os-4">
      <h2 className="font-os font-bold text-os-text" style={H1_STYLE}>
        {isNationalTeam ? '대표팀 데뷔 결과' : '경기 결과'}
      </h2>
      {!isNationalTeam && (
      <div className="flex flex-col items-center gap-os-2 rounded-os-m bg-os-surface-2 py-os-4">
        <p className="os-eyebrow">FULL TIME</p>
        <p
          className="os-num font-os font-bold text-os-accent"
          style={NUM_STYLE}
          aria-label={`최종 스코어 ${match.result.goalsFor} 대 ${match.result.goalsAgainst}`}
        >
          {match.result.goalsFor}:{match.result.goalsAgainst}
        </p>
      </div>
      )}

      {!isNationalTeam && (
      <dl
        className="grid grid-cols-2 gap-os-2 font-os text-os-text-2 [&>div]:rounded-os-m [&>div]:bg-os-surface-2 [&>div]:p-os-3 [&_dd]:mt-os-1 [&_dd]:font-semibold"
        style={CAPTION_STYLE}
      >
        <div>
          <dt>출전</dt>
          <dd className="text-os-text">
            {APPEARANCE_CONTEXT_LABEL[match.appearance]} · {match.minutes}분
          </dd>
        </div>
        <div>
          <dt>평점</dt>
          <dd className="os-num text-os-text">{ratingText(match.ratingTenths)}</dd>
        </div>
        <div>
          <dt>카드</dt>
          <dd className="text-os-text">
            경고 {match.cards.yellow}장{match.cards.red ? ' · 퇴장' : ''}
          </dd>
        </div>
        <div>
          <dt>부상</dt>
          <dd className="text-os-text">{match.injuredOff ? '있음' : '없음'}</dd>
        </div>
        {stats.map((stat) => (
          <div key={stat.key}>
            <dt>{stat.label}</dt>
            <dd className="os-num text-os-text">{stat.value}</dd>
          </div>
        ))}
      </dl>
      )}

      {!isNationalTeam && view.chapterRecord !== null ? (
        <p className="font-os text-os-text" style={BODY_STYLE}>
          챕터로 인한 평점 변화 {formatSignedTenths(view.chapterRecord.ratingDeltaTenths)}
        </p>
      ) : null}

      {changeLines.length > 0 ? (
        <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={CAPTION_STYLE}>
          {changeLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {addedTags.length > 0 ? (
        <ul className="flex flex-wrap gap-os-1">
          {addedTags.map((tag) => (
            <li
              key={tag}
              className="rounded-os-s bg-os-surface-2 px-os-2 py-os-1 font-os text-os-text-2"
              style={CAPTION_STYLE}
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
