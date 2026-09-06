// SCR-004 생성 완료 확인 + 복구 코드 발급 단계. KICKOFF는 로컬 CONFIRM_PLAYER → ADVANCE(EVT-CON-002
// pending 계산)를 순서대로 실행한다. 확정 직후 DSN-LINE-001의 세 허용 순간 중 하나(오프사이드 라인 +
// KICKOFF)를 보여준다. 복구 코드 단계는 같은 라우트의 ?step=recovery로 남아 새로고침해도 유지된다.
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  DisplayWord,
  ErrorState,
  OffsideLine,
  ScreenIntro,
  Skeleton,
  Stepper,
  Toast,
} from '@offside/ui';
import { RETRYABLE_BY_CODE } from '@offside/contracts';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { getProfile, issueRecoveryCode } from '../api/client.js';
import { rulesetForCareer } from '../engine/content.js';
import { recordFunnelReached } from '../engine/funnel.js';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { platform } from '../platform/index.js';
import { GENDER_LABELS, POSITION_LABELS, PREFERRED_FOOT_LABELS } from '../shared/labels.js';
import { currentTeamName } from '../shared/current-team.js';
import {
  attributeLabelList,
  backgroundOpening,
  PLAYER_CREATION_CAREER_PHASE,
  PLAYER_CREATION_STEPS,
  topAttributeKeys,
} from '../shared/player-draft.js';
import { screenForCareer } from '../shared/career-route.js';
import { useScreenState } from '../shared/screen-state.js';
import { useCareerStepGuard } from '../shared/use-career-guard.js';
import { useCommittingExitGuard } from '../shared/use-committing-exit-guard.js';
import { CreationCard } from '../shared/player-creation-ui.js';
import { GameCompletionTransition, GamePending } from '../shared/game-presentation.js';
import { SCREEN_ROUTES } from '../routes.js';

export const Route = createFileRoute('/career/$careerId/confirm')({
  validateSearch: (search: Record<string, unknown>): { step?: 'recovery' } =>
    search.step === 'recovery' ? { step: 'recovery' } : {},
  component: ConfirmScreen,
});

const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

type RecoveryPhase =
  { kind: 'CHECKING' } | { kind: 'ISSUED'; code: string } | { kind: 'UNAVAILABLE' };

function ConfirmScreen() {
  const { careerId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const query = useCareer(careerId);

  const [postConfirmInFlight, setPostConfirmInFlight] = useState(false);
  const [ceremonyReady, setCeremonyReady] = useState(false);
  const kickoffInFlightRef = useRef(false);
  const confirmCompletedRef = useRef(false);
  const advanceCompletedRef = useRef(false);
  const isActive = query.data !== undefined && query.data.state.status !== 'DRAFT';
  const recoveryStepActive = search.step === 'recovery' || postConfirmInFlight;
  const blocked = useCareerStepGuard(query.data?.state, 'SCR-004', { recoveryStepActive });
  const showRecoveryStep = isActive && search.step === 'recovery';

  const confirmMutation = useCareerMutation('confirm');
  const advanceMutation = useCareerMutation('advance');

  const screen = useScreenState<never, Record<string, never>>({ kind: 'LOADING' });
  const { state: screenState, toDraft, toCommitting, toError } = screen;
  const [recoveryPhase, setRecoveryPhase] = useState<RecoveryPhase>({ kind: 'CHECKING' });
  const [copyToast, setCopyToast] = useState<string | null>(null);

  useCommittingExitGuard(screenState.kind === 'COMMITTING');

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-004',
      careerPhase: PLAYER_CREATION_CAREER_PHASE,
    });
  }, []);

  useEffect(() => {
    if (
      blocked ||
      showRecoveryStep ||
      query.data === undefined ||
      screenState.kind === 'COMMITTING'
    )
      return;
    toDraft({});
  }, [blocked, showRecoveryStep, query.data, screenState.kind, toDraft]);

  function handleContinueToNext() {
    if (query.data === undefined) return;
    const target = screenForCareer(query.data.state);
    void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
  }

  useEffect(() => {
    if (!showRecoveryStep || query.data === undefined) return;
    let cancelled = false;
    setRecoveryPhase({ kind: 'CHECKING' });
    const activeState = query.data.state;

    (async () => {
      const profileResult = await getProfile();
      if (cancelled) return;
      if (!profileResult.ok) {
        setRecoveryPhase({ kind: 'UNAVAILABLE' });
        return;
      }
      if (profileResult.data.recoveryCodeIssuedAt !== null) {
        // 이미 발급된 프로필이면 이 단계를 건너뛴다 — 화면을 그리지 않고 곧바로 다음으로 넘어간다.
        const target = screenForCareer(activeState);
        void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params, replace: true });
        return;
      }
      const issueResult = await issueRecoveryCode();
      if (cancelled) return;
      if (!issueResult.ok) {
        setRecoveryPhase({ kind: 'UNAVAILABLE' });
        return;
      }
      setRecoveryPhase({ kind: 'ISSUED', code: issueResult.data.code });
    })().catch(() => {
      if (!cancelled) setRecoveryPhase({ kind: 'UNAVAILABLE' });
    });

    return () => {
      cancelled = true;
    };
    // query.data는 activeState로 캡처해 쓴다 — 매 리페치마다 이 검사를 다시 돌 필요는 없다.
  }, [showRecoveryStep, careerId]);

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopyToast('복구 코드를 복사했습니다');
    } catch {
      setCopyToast('복사하지 못했습니다. 코드를 직접 선택해 복사해 주세요');
    }
  }

  async function handleKickoff() {
    if (kickoffInFlightRef.current) return;
    kickoffInFlightRef.current = true;
    setPostConfirmInFlight(true);
    const commandId = crypto.randomUUID();
    toCommitting(commandId);

    try {
      if (!confirmCompletedRef.current) {
        const confirmed = await confirmMutation.mutateAsync({ careerId });
        if (!confirmed.ok) {
          toError({
            code: confirmed.error.code,
            message: confirmed.error.message,
            retryable: RETRYABLE_BY_CODE[confirmed.error.code],
          });
          setPostConfirmInFlight(false);
          kickoffInFlightRef.current = false;
          return;
        }
        confirmCompletedRef.current = true;
        await recordFunnelReached(careerId, 'PLAYER_CONFIRMED');
      }

      if (!advanceCompletedRef.current) {
        const advanced = await advanceMutation.mutateAsync({ careerId });
        if (!advanced.ok) {
          // 확정은 성공했지만 다음 결정 계산이 실패했다. 재시도는 확정 명령을 반복하지 않고
          // ADVANCE부터 이어 간다.
          toError({
            code: advanced.error.code,
            message: advanced.error.message,
            retryable: RETRYABLE_BY_CODE[advanced.error.code],
          });
          kickoffInFlightRef.current = false;
          return;
        }
        advanceCompletedRef.current = true;
      }

      setCeremonyReady(true);
    } catch {
      toError({
        code: 'UNKNOWN',
        message: '확정하지 못했습니다. 다시 시도해 주세요.',
        retryable: true,
      });
      if (!confirmCompletedRef.current) setPostConfirmInFlight(false);
      kickoffInFlightRef.current = false;
    }
  }

  async function continueAfterCeremony() {
    await navigate({
      to: '/career/$careerId/confirm',
      params: { careerId },
      search: { step: 'recovery' },
      replace: true,
    });
  }

  if (blocked) {
    return (
      <div className="flex flex-col gap-os-4" aria-label="불러오는 중">
        <Skeleton className="h-os-8 w-full" />
        <Skeleton className="h-os-8 w-full" />
      </div>
    );
  }

  if (showRecoveryStep) {
    return (
      <div className="os-screen">
        <ScreenIntro
          eyebrow="커리어를 안전하게"
          title="복구 코드를 저장하세요"
          description="기기가 바뀌어도 나의 선수와 다시 만날 수 있도록, 코드를 안전한 곳에 보관해 주세요."
        />

        <div className="os-panel flex flex-col items-center gap-os-4 text-center">
          {recoveryPhase.kind === 'CHECKING' ? (
            <Skeleton className="h-os-8 w-full" />
          ) : recoveryPhase.kind === 'ISSUED' ? (
            <>
              <p
                className="w-full break-all rounded-os-m bg-os-surface-2 p-os-4 font-mono font-bold text-os-text"
                style={{
                  fontSize: 'var(--os-fs-h2)',
                  lineHeight: 'var(--os-lh-h2)',
                  letterSpacing: '0.05em',
                }}
              >
                {recoveryPhase.code}
              </p>
              <Button variant="secondary" onClick={() => void handleCopyCode(recoveryPhase.code)}>
                코드 복사
              </Button>
              <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                이 코드를 보관하거나, 설정에서 Google 계정을 연결하면 다른 기기에서도 프로필을 찾을
                수 있습니다.
              </p>
              <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                설정에서 다시 발급할 수 있습니다.
              </p>
              <div className="flex w-full gap-os-3">
                <Button variant="primary" onClick={handleContinueToNext}>
                  저장했어요
                </Button>
                <Button variant="ghost" onClick={handleContinueToNext}>
                  건너뛰기
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                지금은 발급할 수 없습니다. 설정에서 나중에 발급할 수 있습니다.
              </p>
              <Button variant="primary" onClick={handleContinueToNext}>
                계속
              </Button>
            </>
          )}
        </div>

        {copyToast !== null ? (
          <Toast variant="success" message={copyToast} onDismiss={() => setCopyToast(null)} />
        ) : null}
      </div>
    );
  }

  if (screenState.kind === 'COMMITTING') {
    if (ceremonyReady) {
      return (
        <GameCompletionTransition
          title="선수 등록 완료"
          detail="선수 카드가 저장되었습니다. 첫 번째 이야기로 이동합니다."
          onComplete={() => void continueAfterCeremony()}
          visual={<OffsideLine />}
        >
          <DisplayWord word="KICKOFF" caption="선수가 피치에 들어섭니다" />
        </GameCompletionTransition>
      );
    }
    return (
      <GamePending
        title="선수 카드를 등록하고 있습니다"
        detail="선수 정보와 첫 번째 이야기를 한 번만 저장하고 있어요."
      />
    );
  }

  if (screenState.kind === 'ERROR') {
    return (
      <ErrorState
        message={screenState.message}
        {...(screenState.retryable ? { onRetry: () => void handleKickoff() } : {})}
        recoveryAction={
          postConfirmInFlight ? (
            <Button variant="secondary" onClick={() => void navigate({ to: '/' })}>
              허브로 이동
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setPostConfirmInFlight(false);
                toDraft({});
              }}
            >
              돌아가기
            </Button>
          )
        }
      />
    );
  }

  if (screenState.kind === 'LOADING' || query.data === undefined) {
    return (
      <div className="flex flex-col gap-os-4" aria-label="불러오는 중">
        <Skeleton className="h-os-8 w-full" />
        <Skeleton className="h-os-8 w-full" />
      </div>
    );
  }

  const { record, state } = query.data;
  const ruleset = rulesetForCareer(state);
  const draft = state.player.draft;
  const archetype = ruleset.archetypes.find((candidate) => candidate.id === draft.archetypeId);
  const background = ruleset.backgrounds.find((candidate) => candidate.id === draft.backgroundId);
  const opening = background === undefined
    ? undefined
    : backgroundOpening(background.id, background.name);

  if (
    draft.name === null ||
    draft.gender === null ||
    draft.position === null ||
    archetype === undefined ||
    background === undefined ||
    draft.preferredFoot === null
  ) {
    return null;
  }

  return (
    <div className="os-screen">
      <Stepper steps={PLAYER_CREATION_STEPS} currentStepId="confirm" />
      <ScreenIntro
        eyebrow="선수 등록 · 최종 확인"
        title="확정 전 정보를 확인하세요"
        description="당신이 만든 선수 카드입니다. 준비가 됐다면 첫 휘슬을 울리세요."
      />

      <CreationCard
        name={draft.name}
        team={currentTeamName(state, ruleset)}
        position={POSITION_LABELS[draft.position]}
        archetype={archetype.name}
        foot={PREFERRED_FOOT_LABELS[draft.preferredFoot]}
        nationality={
          ruleset.nationalities.find((item) => item.code === draft.nationalityCode)?.name ??
          draft.nationalityCode ??
          '—'
        }
      >
        <dl className="os-creation-card-details">
          <div className="flex justify-between gap-os-4">
            <dt>성별</dt>
            <dd>{GENDER_LABELS[draft.gender]}</dd>
          </div>
          <div className="flex justify-between gap-os-4">
            <dt>출발 배경</dt>
            <dd>{background.name}</dd>
          </div>
          <div className="flex justify-between gap-os-4">
            <dt>현재 상황</dt>
            <dd>{opening?.title ?? '다음 기회 준비'}</dd>
          </div>
          <div className="flex justify-between gap-os-4">
            <dt>스타일의 주요 무기</dt>
            <dd>{attributeLabelList(topAttributeKeys(archetype, 3))}</dd>
          </div>
          <div className="flex justify-between gap-os-2">
            <dt>룰셋 · 콘텐츠 팩</dt>
            <dd className="os-num">
              {record.rulesetVersion} / {record.contentPackVersion}
            </dd>
          </div>
        </dl>
      </CreationCard>
      <p className="os-creation-note">
        선호 포지션과 플레이 스타일은 고정된 출전 역할이나 결과를 보장하지 않습니다. 시작한 뒤에는
        이 선수 정보를 되돌릴 수 없어요.
      </p>

      <div className="os-action-dock os-action-row">
        <Button
          variant="secondary"
          onClick={() => void navigate({ to: '/career/$careerId/create', params: { careerId } })}
        >
          수정
        </Button>
        <Button
          aria-label="KICKOFF"
          variant="primary"
          onClick={() => void handleKickoff()}
          disabled={postConfirmInFlight}
        >
          {postConfirmInFlight ? '확정하는 중' : 'KICKOFF · 커리어 시작'}
        </Button>
      </div>
    </div>
  );
}
