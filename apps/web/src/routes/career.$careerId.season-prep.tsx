// SCR-011 시즌 준비: SCR-005에서 넘어온 선택(모드·훈련 계획)을 확인하고 START_SEASON을 보낸다.
// search 파라미터가 없거나 잘못되면 SCR-005로 돌려보내고, 시즌이 이미 있으면(뒤로 가기 등)
// screenForCareer로 보내 시즌을 두 번 시작하지 않는다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Button, ErrorState, ScreenIntro } from '@offside/ui';
import { buildSeasonSteps, type SimulationMode } from '@offside/domain';
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
  SIMULATION_MODE_LABEL_KO,
  canPlanNextSeason,
  TRAINING_FOCUS_LABEL_KO,
  TRAINING_FOCUS_OPTIONS,
  type TrainingFocus,
} from '../shared/start-season.js';
import { platform } from '../platform/index.js';
import { GamePending } from '../shared/game-presentation.js';

type SeasonPrepSearch = { mode?: SimulationMode; focus?: TrainingFocus };

function parseMode(value: unknown): SimulationMode | undefined {
  return value === 'FAST' || value === 'CHAPTER' ? value : undefined;
}

function parseFocus(value: unknown): TrainingFocus | undefined {
  return typeof value === 'string' && (TRAINING_FOCUS_OPTIONS as readonly string[]).includes(value)
    ? (value as TrainingFocus)
    : undefined;
}

export const Route = createFileRoute('/career/$careerId/season-prep')({
  validateSearch: (search: Record<string, unknown>): SeasonPrepSearch => {
    const mode = parseMode(search.mode);
    const focus = parseFocus(search.focus);
    return { ...(mode !== undefined ? { mode } : {}), ...(focus !== undefined ? { focus } : {}) };
  },
  loaderDeps: ({ search }) => ({ mode: search.mode, focus: search.focus }),
  loader: async ({ params, deps }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const seasonNotStarted = canPlanNextSeason(state);
    if (!seasonNotStarted) {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
    if (deps.mode === undefined || deps.focus === undefined) {
      throw redirect({ to: SCREEN_ROUTES['SCR-005'], params });
    }
  },
  component: SeasonPrepScreen,
});

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

function SeasonPrepScreen() {
  const { careerId } = Route.useParams();
  const { mode, focus } = Route.useSearch();
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const startSeasonMutation = useCareerMutation('startSeason');
  const resolveRoleMutation = useCareerMutation('resolveRole');
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmingKeep, setConfirmingKeep] = useState(false);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-011',
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.data === undefined || mode === undefined || focus === undefined) return null;
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
  const previewSteps = buildSeasonSteps(ruleset.leagueCalendar, mode);

  async function handleStart() {
    if (submittingRef.current || mode === undefined || focus === undefined) return;
    submittingRef.current = true;
    setErrorMessage(null);
    try {
      const result = await startSeasonMutation.mutateAsync({
        careerId,
        choice: { simulationMode: mode, trainingFocus: focus },
      });
      if (!result.ok) {
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
          const latest = await queryClient.fetchQuery({ ...careerQueryOptions(careerId), staleTime: 0 });
          const target = screenForCareer(latest.state);
          void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params, replace: true });
          return;
        }
        setErrorMessage('시즌을 시작하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      platform.analytics.track('season_started', { simulationMode: mode, trainingFocus: focus });
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
      const target = screenForCareer(nextState);
      void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
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
      search: { mode, focus },
    });
  }

  const committing = startSeasonMutation.isPending || resolveRoleMutation.isPending;

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

      <section className="os-panel flex flex-col gap-os-3">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          시즌 일정(12 step)
        </h2>
        <SeasonTimeline steps={previewSteps} currentStep={0} />
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          컵 일정:{' '}
          {ruleset.leagueCalendar.cupRounds
            .map((round) => `${CUP_ROUND_LABEL_KO[round.round]} step ${round.step}`)
            .join(' · ')}
        </p>
      </section>

      <section className="os-panel flex flex-col gap-os-3">
        <h2 className="os-section-title">선택한 계획</h2>
        <p className="font-os text-os-text" style={BODY_STYLE}>
          모드: {SIMULATION_MODE_LABEL_KO[mode]} (시즌 중 적용)
        </p>
        <p className="font-os text-os-text" style={BODY_STYLE}>
          훈련 계획: {TRAINING_FOCUS_LABEL_KO[focus]} (시즌 결산 때 능력에 반영, 다음 시즌부터 체감)
        </p>
      </section>

      {errorMessage ? <ErrorState message={errorMessage} onRetry={handleStart} /> : null}

      {committing ? (
        <GamePending
          title={confirmingKeep ? '변경 없는 역할은 유지하고 시작합니다' : `${SIMULATION_MODE_LABEL_KO[mode]} 모드로 시즌을 시작하고 있습니다`}
          detail={confirmingKeep ? '현재 포지션과 역할을 확인해 시즌 준비를 마칩니다.' : `${TRAINING_FOCUS_LABEL_KO[focus]} 계획과 시즌 일정을 저장하고 있습니다.`}
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
