// SCR-011 시즌 준비: SCR-005에서 넘어온 훈련 계획 선택을 확인하고 START_SEASON을 보낸다. search
// 파라미터가 없거나 잘못되면 SCR-005로 돌려보내고, 시즌이 이미 있으면(뒤로 가기 등) screenForCareer로
// 보내 시즌을 두 번 시작하지 않는다. 시뮬레이션 모드는 더 이상 고르지 않는다(사용자 결정 2026-09-13,
// D-77) — START_SEASON은 항상 FIXED_SIMULATION_MODE(FAST)로 보낸다. 과거 딥링크·북마크에 남은
// `mode` search 파라미터는 있어도 무시한다(validateSearch가 걸러낸다).
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Button, ErrorState, ScreenIntro } from '@offside/ui';
import { buildSeasonSteps } from '@offside/domain';
import { rulesetForCareer } from '../engine/content.js';
import { shouldAutoAcceptUnchangedRole } from '../engine/career-actions.js';
import { recordFunnelReached, recordSeasonStart } from '../engine/funnel.js';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import {
  CUP_ROUND_LABEL_KO,
  LEAGUE_TIER_LABEL_KO,
  ROLE_PROMISE_SENTENCE,
} from '../shared/labels.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { SeasonTimeline } from '../shared/season-timeline.js';
import {
  FIXED_SIMULATION_MODE,
  canPlanNextSeason,
  isRetirementDecisionRequiredError,
  TRAINING_FOCUS_LABEL_KO,
  TRAINING_FOCUS_OPTIONS,
  type TrainingFocus,
} from '../shared/start-season.js';
import { platform } from '../platform/index.js';
import { GameCompletionTransition, GamePending } from '../shared/game-presentation.js';

type SeasonPrepSearch = { focus?: TrainingFocus };

function parseFocus(value: unknown): TrainingFocus | undefined {
  return typeof value === 'string' && (TRAINING_FOCUS_OPTIONS as readonly string[]).includes(value)
    ? (value as TrainingFocus)
    : undefined;
}

export const Route = createFileRoute('/career/$careerId/season-prep')({
  validateSearch: (search: Record<string, unknown>): SeasonPrepSearch => {
    const focus = parseFocus(search.focus);
    return { ...(focus !== undefined ? { focus } : {}) };
  },
  loaderDeps: ({ search }) => ({ focus: search.focus }),
  loader: async ({ params, deps }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const seasonNotStarted = canPlanNextSeason(state);
    if (!seasonNotStarted) {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
    if (deps.focus === undefined) {
      throw redirect({ to: SCREEN_ROUTES['SCR-005'], params });
    }
  },
  component: SeasonPrepScreen,
});

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function SeasonPrepScreen() {
  const { careerId } = Route.useParams();
  const { focus } = Route.useSearch();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const startSeasonMutation = useCareerMutation('startSeason');
  const resolveRoleMutation = useCareerMutation('resolveRole');
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmingKeep, setConfirmingKeep] = useState(false);
  const [kickoffReady, setKickoffReady] = useState(false);
  const nextStateRef = useRef<NonNullable<typeof query.data>['state'] | null>(null);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-011',
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.data === undefined || focus === undefined) return null;
  const { state } = query.data;
  const contract = state.contract;
  if (contract === null) return null; // 라우트 loader가 보장한다. 방어적 fallback.
  const ruleset = rulesetForCareer(state);

  const team = ruleset.teams.find((candidate) => candidate.id === contract.teamId);
  const league =
    team === undefined
      ? undefined
      : ruleset.leagues.find((candidate) => candidate.id === team.leagueId);
  const style =
    team === undefined
      ? undefined
      : ruleset.tacticalStyles.find((candidate) => candidate.id === team.tacticalStyleId);
  const previewSteps = buildSeasonSteps(ruleset.leagueCalendar, FIXED_SIMULATION_MODE);

  async function handleStart() {
    if (submittingRef.current || focus === undefined) return;
    submittingRef.current = true;
    setErrorMessage(null);
    try {
      const result = await startSeasonMutation.mutateAsync({
        careerId,
        choice: { simulationMode: FIXED_SIMULATION_MODE, trainingFocus: focus },
      });
      if (!result.ok) {
        if (isRetirementDecisionRequiredError(result.error)) {
          void navigate({
            to: '/career/$careerId/retirement',
            params: { careerId },
            replace: true,
          });
          return;
        }
        const details = result.error.details;
        const marketIsOpen =
          result.error.code === 'VALIDATION_FAILED' &&
          typeof details === 'object' &&
          details !== null &&
          'reason' in details &&
          details.reason === 'MARKET_OPEN';
        if (marketIsOpen) {
          // 다른 탭/요청이 먼저 시장을 연 경합이면 stale 화면을 재시도하지 않고,
          // 최신 저장 상태가 가리키는 시장 화면으로 보낸다.
          const latest = await queryClient.fetchQuery({
            ...careerQueryOptions(careerId),
            staleTime: 0,
          });
          const target = screenForCareer(latest.state);
          void navigate({
            to: SCREEN_ROUTES[target.screenId],
            params: target.params,
            replace: true,
          });
          return;
        }
        setErrorMessage('시즌을 시작하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      platform.analytics.track('season_started', {
        simulationMode: FIXED_SIMULATION_MODE,
        trainingFocus: focus,
      });
      await recordFunnelReached(careerId, 'SEASON_STARTED');
      await recordSeasonStart(careerId);
      let nextState = result.domainSnapshot.state;
      if (shouldAutoAcceptUnchangedRole(nextState)) {
        setConfirmingKeep(true);
        try {
          const resolved = await resolveRoleMutation.mutateAsync({ careerId, decision: 'ACCEPT' });
          if (resolved.ok) nextState = resolved.domainSnapshot.state;
        } catch {
          // START_SEASON은 이미 저장됐다. 재전송하지 않고 아래에서 기존 ROLE 복구 화면으로 이동한다.
        }
      }
      nextStateRef.current = nextState;
      setKickoffReady(true);
    } catch {
      setErrorMessage('시즌을 시작하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setConfirmingKeep(false);
      submittingRef.current = false;
    }
  }

  function handleBack() {
    void navigate({
      to: '/career/$careerId/preseason',
      params: { careerId },
      search: { focus },
    });
  }

  const committing = startSeasonMutation.isPending || resolveRoleMutation.isPending;

  function continueToSeason() {
    const nextState = nextStateRef.current;
    if (nextState === null) return;
    const target = screenForCareer(nextState);
    void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
  }

  if (kickoffReady) {
    return (
      <GameCompletionTransition
        title="시즌 준비 완료"
        detail={`${TRAINING_FOCUS_LABEL_KO[focus]} 계획을 저장했습니다.`}
        onComplete={continueToSeason}
        stages={['훈련 계획 저장 중', '일정표 준비 중', '피치 입장']}
      >
        <p className="os-eyebrow">KICKOFF · 새 시즌이 시작됩니다</p>
      </GameCompletionTransition>
    );
  }

  return (
    <div className="os-screen">
      <ScreenIntro
        eyebrow="READY TO KICK OFF"
        title="시즌 준비"
        description="계획을 확인하고 새로운 시즌의 첫발을 내디뎌요."
      />

      <section className="os-panel flex flex-col gap-os-2">
        <p className="os-eyebrow">이번 시즌의 팀</p>
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          {contract.teamName}
        </h2>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {league
            ? `${league.name} · ${LEAGUE_TIER_LABEL_KO[league.tier]} · ${league.teamCount}팀 · 2회전`
            : '—'}
        </p>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          감독 전술: {style ? `${style.name} · ${style.formation}` : '—'}
        </p>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          {ROLE_PROMISE_SENTENCE[contract.rolePromise]}
        </p>
      </section>
      {state.clubMeeting?.seasonIndex === state.seasonHistory.length + 1 ? (
        <section className="os-panel flex flex-col gap-os-2" aria-label="구단 면담 계획">
          <p className="os-eyebrow">구단 면담 계획</p>
          <p>
            {state.clubMeeting.response === 'ACCEPTED' ? '구단 수락' : '구단 거절'} · 시즌 출전 확인
            기준 {state.clubMeeting.goal.targetMinutesShareBp / 100}%
          </p>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            실제 역할과 출전은 프리시즌 경쟁 후 조정될 수 있습니다.
          </p>
        </section>
      ) : null}

      <section className="os-plan-summary" aria-labelledby="selected-plan-title">
        <p className="os-eyebrow">선택한 계획</p>
        <h2 id="selected-plan-title" className="os-section-title">
          {TRAINING_FOCUS_LABEL_KO[focus]}
        </h2>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          훈련 계획은 시즌 결산 때 능력에 반영됩니다.
        </p>
      </section>

      {state.seasonHistory.length === 0 ? (
        <section
          className="os-panel flex flex-col gap-os-1"
          aria-labelledby="first-season-record-title"
        >
          <h2
            id="first-season-record-title"
            className="font-os font-semibold text-os-text"
            style={H2_STYLE}
          >
            첫 시즌 기록을 기다리고 있어요
          </h2>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            시즌을 시작하고 결산하면 출전·성장·우승 기록이 이 커리어에 남습니다.
          </p>
        </section>
      ) : null}

      <details className="os-panel">
        <summary className="cursor-pointer font-os font-semibold text-os-text">
          12 step 일정과 컵 일정 보기
        </summary>
        <div className="mt-os-3 flex flex-col gap-os-3">
          <SeasonTimeline steps={previewSteps} currentStep={0} />
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            컵 일정:{' '}
            {ruleset.leagueCalendar.cupRounds
              .map((round) => `${CUP_ROUND_LABEL_KO[round.round]} step ${round.step}`)
              .join(' · ')}
          </p>
        </div>
      </details>

      {errorMessage ? <ErrorState message={errorMessage} onRetry={handleStart} /> : null}

      {committing ? (
        <GamePending
          title={
            confirmingKeep ? '변경 없는 역할은 유지하고 시작합니다' : '시즌을 시작하고 있습니다'
          }
          detail={
            confirmingKeep
              ? '현재 포지션과 역할을 확인해 시즌 준비를 마칩니다.'
              : `${TRAINING_FOCUS_LABEL_KO[focus]} 계획과 시즌 일정을 저장하고 있습니다.`
          }
        />
      ) : null}

      <div className="os-action-dock">
        <div className="grid grid-cols-3 gap-os-2">
          <Button variant="secondary" disabled={committing} onClick={handleBack}>
            이전
          </Button>
          <Button
            className="col-span-2"
            variant="primary"
            disabled={committing}
            onClick={() => void handleStart()}
          >
            {committing ? '시작하는 중' : '시즌 시작'}
          </Button>
        </div>
      </div>
    </div>
  );
}
