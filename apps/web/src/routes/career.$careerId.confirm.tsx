// SCR-004 생성 완료 확인 + 복구 코드 발급 단계. KICKOFF는 로컬 CONFIRM_PLAYER → ADVANCE(EVT-CON-002
// pending 계산)를 순서대로 실행한다. 확정 직후 DSN-LINE-001의 세 허용 순간 중 하나(오프사이드 라인 +
// KICKOFF)를 보여준다. 복구 코드 단계는 같은 라우트의 ?step=recovery로 남아 새로고침해도 유지된다.
import { useEffect, useState } from 'react';
import { Button, DisplayWord, ErrorState, OffsideLine, PlayerHeader, Skeleton, Toast } from '@offside/ui';
import { RETRYABLE_BY_CODE } from '@offside/contracts';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { getProfile, issueRecoveryCode } from '../api/client.js';
import { activeRuleset as ruleset } from '../engine/content.js';
import { useCareer, useCareerMutation } from '../engine/use-career.js';
import { ACTIVE_CONTENT_PACK_VERSION } from '../engine/versions.js';
import { platform } from '../platform/index.js';
import { POSITION_LABELS, PREFERRED_FOOT_LABELS } from '../shared/labels.js';
import { attributeLabelList, topAttributeKeys } from '../shared/player-draft.js';
import { screenForCareer } from '../shared/career-route.js';
import { useScreenState } from '../shared/screen-state.js';
import { useCareerStepGuard } from '../shared/use-career-guard.js';
import { SCREEN_ROUTES } from '../routes.js';

export const Route = createFileRoute('/career/$careerId/confirm')({
  validateSearch: (search: Record<string, unknown>): { step?: 'recovery' } =>
    search.step === 'recovery' ? { step: 'recovery' } : {},
  component: ConfirmScreen,
});

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

type RecoveryPhase = { kind: 'CHECKING' } | { kind: 'ISSUED'; code: string } | { kind: 'UNAVAILABLE' };

function ConfirmScreen() {
  const { careerId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const query = useCareer(careerId);

  const [postConfirmInFlight, setPostConfirmInFlight] = useState(false);
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

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-004', careerPhase: 'YOUTH' });
  }, []);

  useEffect(() => {
    if (blocked || showRecoveryStep || query.data === undefined || screenState.kind === 'COMMITTING') return;
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
    setPostConfirmInFlight(true);
    const commandId = crypto.randomUUID();
    toCommitting(commandId);

    try {
      const confirmed = await confirmMutation.mutateAsync({ careerId });
      if (!confirmed.ok) {
        toError({
          code: confirmed.error.code,
          message: confirmed.error.message,
          retryable: RETRYABLE_BY_CODE[confirmed.error.code],
        });
        setPostConfirmInFlight(false);
        return;
      }

      const advanced = await advanceMutation.mutateAsync({ careerId });
      if (!advanced.ok) {
        // 확정은 성공했지만 다음 결정 계산이 실패했다. 되돌릴 수 없으므로(확정은 이미 반영됨) 오류를
        // 보여주고, postConfirmInFlight를 유지해 가드가 이 화면 밖으로 보내지 않게 한다.
        toError({
          code: advanced.error.code,
          message: advanced.error.message,
          retryable: RETRYABLE_BY_CODE[advanced.error.code],
        });
        return;
      }

      await navigate({
        to: '/career/$careerId/confirm',
        params: { careerId },
        search: { step: 'recovery' },
        replace: true,
      });
    } catch {
      toError({ code: 'UNKNOWN', message: '확정하지 못했습니다. 다시 시도해 주세요.', retryable: true });
      setPostConfirmInFlight(false);
    }
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
      <div className="flex flex-col items-center gap-os-6 text-center">
        <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
          복구 코드를 저장하세요
        </h1>

        {recoveryPhase.kind === 'CHECKING' ? (
          <Skeleton className="h-os-8 w-full" />
        ) : recoveryPhase.kind === 'ISSUED' ? (
          <>
            <p className="font-mono font-bold text-os-text" style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)', letterSpacing: '0.05em' }}>
              {recoveryPhase.code}
            </p>
            <Button variant="secondary" onClick={() => void handleCopyCode(recoveryPhase.code)}>
              코드 복사
            </Button>
            <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
              이 코드가 없으면 다른 기기에서 복구할 수 없습니다.
            </p>
            <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
              설정에서 다시 발급할 수 있습니다.
            </p>
            <div className="flex gap-os-3">
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

        {copyToast !== null ? <Toast variant="success" message={copyToast} onDismiss={() => setCopyToast(null)} /> : null}
      </div>
    );
  }

  if (screenState.kind === 'COMMITTING') {
    return (
      <div className="flex flex-col items-center gap-os-6 text-center">
        <OffsideLine />
        <DisplayWord word="KICKOFF" caption="커리어를 확정하는 중입니다" />
      </div>
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
  const draft = state.player.draft;
  const archetype = ruleset.archetypes.find((candidate) => candidate.id === draft.archetypeId);
  const background = ruleset.backgrounds.find((candidate) => candidate.id === draft.backgroundId);
  const startTeam = background ? ruleset.teams.find((team) => team.id === background.startTeamId) : undefined;

  if (draft.name === null || draft.position === null || archetype === undefined || background === undefined || draft.preferredFoot === null) {
    return null;
  }

  return (
    <div className="flex flex-col gap-os-6">
      <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
        확정 전 정보를 확인하세요
      </h1>

      <PlayerHeader
        name={draft.name}
        team={startTeam?.name ?? background.startTeamId}
        position={{ label: '포지션', value: POSITION_LABELS[draft.position] }}
        archetype={{ label: '아키타입', value: archetype.name }}
        shirtNumber={{ label: '등번호', value: '-' }}
      />

      <dl className="flex flex-col gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
        <div className="flex justify-between gap-os-2">
          <dt>주발</dt>
          <dd className="text-os-text">{PREFERRED_FOOT_LABELS[draft.preferredFoot]}</dd>
        </div>
        <div className="flex justify-between gap-os-2">
          <dt>배경</dt>
          <dd className="text-os-text">{background.name}</dd>
        </div>
        <div className="flex justify-between gap-os-2">
          <dt>예상 강점</dt>
          <dd className="text-os-text">{attributeLabelList(topAttributeKeys(archetype, 3))}</dd>
        </div>
        <div className="flex justify-between gap-os-2">
          <dt>룰셋 · 콘텐츠 팩</dt>
          <dd className="os-num text-os-text">
            {ruleset.version} / {ACTIVE_CONTENT_PACK_VERSION}
          </dd>
        </div>
      </dl>

      <div className="flex justify-between gap-os-3">
        <Button
          variant="secondary"
          onClick={() => void navigate({ to: '/career/$careerId/create', params: { careerId } })}
        >
          수정
        </Button>
        <Button variant="primary" onClick={() => void handleKickoff()}>
          KICKOFF
        </Button>
      </div>
    </div>
  );
}
