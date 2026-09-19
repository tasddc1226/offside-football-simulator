// SCR-004 생성 완료 확인 + 첫 계약 뒤 복구 코드 안내 단계. KICKOFF는 로컬 CONFIRM_PLAYER →
// ADVANCE(EVT-CON-002 pending 계산)를 순서대로 실행한 뒤 첫 이야기로 바로 이동한다. 확정 직후
// DSN-LINE-001의 세 허용 순간 중 하나(오프사이드 라인 + KICKOFF)를 보여주며, 복구 코드 단계는 첫
// 계약 뒤 같은 라우트의 ?step=recovery&milestone=first-contract로 남아 새로고침해도 유지된다.
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  DisplayWord,
  ErrorState,
  OffsideLine,
  ScreenIntro,
  Skeleton,
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
import { PLAYER_CREATION_CAREER_PHASE } from '../shared/player-draft.js';
import { screenForCareer } from '../shared/career-route.js';
import { useScreenState } from '../shared/screen-state.js';
import { useCareerStepGuard } from '../shared/use-career-guard.js';
import { useCommittingExitGuard } from '../shared/use-committing-exit-guard.js';
import { creationCandidates } from '../shared/creation-candidates.js';
import '../shared/creation-flow.css';
import { GameCompletionTransition } from '../shared/game-presentation.js';
import { SCREEN_ROUTES } from '../routes.js';

type ConfirmSearch = { step?: 'recovery'; milestone?: 'first-contract' };

export const Route = createFileRoute('/career/$careerId/confirm')({
  validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({
    ...(search.step === 'recovery' ? { step: 'recovery' as const } : {}),
    ...(search.milestone === 'first-contract' ? { milestone: 'first-contract' as const } : {}),
  }),
  component: ConfirmScreen,
});

const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

type RecoveryPhase =
  { kind: 'CHECKING' } | { kind: 'ISSUED'; code: string } | { kind: 'UNAVAILABLE' };

/** UX-012: CONFIRM_PLAYER·ADVANCE 중 실패한 단계를 ScreenTransition의 onError로 그대로
 * 넘기기 위한 캐리어. 재시도(handleKickoff 재호출)는 confirmCompletedRef로 이미 끝난 단계를
 * 건너뛰므로 여기엔 실패한 단계의 코드만 담는다. */
class KickoffError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

function ConfirmScreen() {
  const { careerId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const query = useCareer(careerId);

  const [postConfirmInFlight, setPostConfirmInFlight] = useState(false);
  const [kickoffWaitFor, setKickoffWaitFor] = useState<Promise<void> | null>(null);
  const kickoffInFlightRef = useRef(false);
  const confirmCompletedRef = useRef(false);
  const advanceCompletedRef = useRef(false);
  const postKickoffTargetRef = useRef<ReturnType<typeof screenForCareer> | null>(null);
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
    if (search.milestone === 'first-contract') {
      void navigate({
        to: '/career/$careerId',
        params: { careerId },
        search: { signed: true },
        replace: true,
      });
      return;
    }
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
        if (search.milestone === 'first-contract') {
          void navigate({
            to: '/career/$careerId',
            params: { careerId },
            search: { signed: true },
            replace: true,
          });
          return;
        }
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
  }, [showRecoveryStep, careerId, search.milestone]);

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopyToast('복구 코드를 복사했습니다');
    } catch {
      setCopyToast('복사하지 못했습니다. 코드를 직접 선택해 복사해 주세요');
    }
  }

  /** CONFIRM_PLAYER → ADVANCE를 순서대로 실행한다. 이미 끝난 단계는 각자의 ref로 건너뛰어
   * 재시도가 확정 명령을 반복하지 않는다. 실패는 KickoffError로 던져 ScreenTransition의
   * onError(handleKickoffError)가 기존 오류 UI로 넘긴다 — 3초 연출은 이 프라미스를 기다린다. */
  async function performKickoff(): Promise<void> {
    if (!confirmCompletedRef.current) {
      const confirmed = await confirmMutation.mutateAsync({ careerId });
      if (!confirmed.ok) {
        throw new KickoffError(
          confirmed.error.code,
          confirmed.error.message,
          RETRYABLE_BY_CODE[confirmed.error.code],
        );
      }
      confirmCompletedRef.current = true;
      await recordFunnelReached(careerId, 'PLAYER_CONFIRMED');
    }

    if (!advanceCompletedRef.current) {
      const advanced = await advanceMutation.mutateAsync({ careerId });
      if (!advanced.ok) {
        // 확정은 성공했지만 다음 결정 계산이 실패했다. 재시도는 확정 명령을 반복하지 않고
        // ADVANCE부터 이어 간다.
        throw new KickoffError(
          advanced.error.code,
          advanced.error.message,
          RETRYABLE_BY_CODE[advanced.error.code],
        );
      }
      advanceCompletedRef.current = true;
      postKickoffTargetRef.current = screenForCareer(advanced.domainSnapshot.state);
    }
  }

  function handleKickoff() {
    if (kickoffInFlightRef.current) return;
    kickoffInFlightRef.current = true;
    setPostConfirmInFlight(true);
    const commandId = crypto.randomUUID();
    toCommitting(commandId);
    setKickoffWaitFor(performKickoff());
  }

  function handleKickoffError(error: unknown) {
    kickoffInFlightRef.current = false;
    setKickoffWaitFor(null);
    if (error instanceof KickoffError) {
      toError({ code: error.code, message: error.message, retryable: error.retryable });
    } else {
      toError({
        code: 'UNKNOWN',
        message: '확정하지 못했습니다. 다시 시도해 주세요.',
        retryable: true,
      });
    }
    if (!confirmCompletedRef.current) setPostConfirmInFlight(false);
  }

  async function continueAfterCeremony() {
    const target = postKickoffTargetRef.current;
    if (target === null) return;
    await navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params, replace: true });
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
    // toCommitting과 setKickoffWaitFor는 handleKickoff 안에서 항상 같은 이벤트 핸들러 틱에
    // 함께 설정된다 — null인 채로 COMMITTING만 보일 일은 없다.
    if (kickoffWaitFor === null) return null;
    return (
      <GameCompletionTransition
        title="선수 등록을 완료합니다"
        detail="선수 카드와 첫 번째 이야기를 저장하고 있습니다."
        onComplete={() => void continueAfterCeremony()}
        onError={handleKickoffError}
        waitFor={kickoffWaitFor}
        visual={<OffsideLine />}
        stages={['선수 정보 확정 중', '첫 이야기 준비 중', '피치 입장']}
      >
        <div className="flex flex-col items-center gap-os-3 text-center">
          <DisplayWord word="KICKOFF" caption="선수가 피치에 들어섭니다" />
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            복구 코드는 설정에서 언제든 발급할 수 있습니다.
          </p>
        </div>
      </GameCompletionTransition>
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

  const { state } = query.data;
  const ruleset = rulesetForCareer(state);
  const draft = state.player.draft;
  const archetype = ruleset.archetypes.find((candidate) => candidate.id === draft.archetypeId);
  const background = ruleset.backgrounds.find((candidate) => candidate.id === draft.backgroundId);

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

  const candidate = creationCandidates(state, ruleset).find(
    (item) => item.id === draft.archetypeId,
  );
  return (
    <div className="creation-flow">
      <header className="creation-heading">
        <div>
          <p>MY PLAYER · 03</p>
          <h1>이번 생의 주인공</h1>
        </div>
        <span className="creation-ready">READY</span>
      </header>
      <p className="creation-lead">이제, 그라운드에서 이름을 남길 차례.</p>
      <section className="creation-final-card" aria-label={`${draft.name} 선수 카드`}>
        <div className="creation-final-top">
          <span>{POSITION_LABELS[draft.position]}</span>
          <span>
            OVR <b>{candidate?.ovr ?? '—'}</b>
          </span>
        </div>
        <div className="creation-final-jersey" aria-hidden="true">
          {state.age}
          <small>AGE</small>
        </div>
        <p>{archetype.name}</p>
        <h2>{draft.name}</h2>
        <div className="creation-final-facts">
          <span>
            {ruleset.nationalities.find((item) => item.code === draft.nationalityCode)?.name}
          </span>
          <span>{PREFERRED_FOOT_LABELS[draft.preferredFoot]}</span>
          {draft.gender !== 'UNSPECIFIED' && <span>{GENDER_LABELS[draft.gender]}</span>}
        </div>
      </section>
      <div className="creation-final-origin">
        <span>나의 출발</span>
        <strong>{background.name}</strong>
        <p>{background.blurb}</p>
      </div>
      <p className="creation-note">시작하면 선수 정보와 능력치가 확정됩니다.</p>
      <div className="creation-action creation-final-actions">
        <Button
          variant="secondary"
          onClick={() => void navigate({ to: '/career/$careerId/style', params: { careerId } })}
        >
          후보 다시 보기
        </Button>
        <Button
          aria-label="이 선수로 시작"
          onClick={() => void handleKickoff()}
          disabled={postConfirmInFlight}
        >
          {postConfirmInFlight ? '시작하는 중…' : '이 선수로 시작 →'}
        </Button>
      </div>
    </div>
  );
}
