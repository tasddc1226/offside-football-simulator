// SCR-020: 시장 계약 성공 결과와 LOAN_RETURN 결정을 분리해 표시한다.
// pending이 있으면 임대 복귀 선택 UI, pending이 닫혔으면 timeline revision 결과 UI다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { Button, buttonClassName, buttonStyle, Card, ErrorState, ScreenIntro } from '@offside/ui';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { screenForCareer } from '../shared/career-route.js';
import {
  committedTransferRevision,
  isCurrentTransferResultRevision,
  latestTransferRevision,
  resolveTransferResultView,
  transferResultNextScreen,
  type TransferResultView,
} from '../shared/transfer-result.js';
import { formatKrw } from '../shared/format.js';
import { platform } from '../platform/index.js';
import { useCommittingExitGuard } from '../shared/use-committing-exit-guard.js';

type TransferResultSearch = { rev?: number; interested?: number };

function parseRevision(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

/** STAY 전용 "관심을 보인 구단 N곳" 표시값. 음수·비정수는 무시하고 카드는 개수 없이 그대로 렌더한다. */
function parseInterestedClubCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

export const Route = createFileRoute('/career/$careerId/transfer-result')({
  validateSearch: (search: Record<string, unknown>): TransferResultSearch => {
    const rev = parseRevision(search.rev);
    const interested = parseInterestedClubCount(search.interested);
    return { ...(rev === undefined ? {} : { rev }), ...(interested === undefined ? {} : { interested }) };
  },
  loaderDeps: ({ search }) => ({ rev: search.rev }),
  loader: async ({ params, deps }) => {
    const { record, state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    if (state.pending?.kind === 'LOAN_RETURN') return;
    const revision = deps.rev ?? latestTransferRevision(state);
    if (
      revision === null ||
      revision === undefined ||
      !isCurrentTransferResultRevision(state, record.revision, revision)
    ) {
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: TransferResultScreen,
});

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

function LoanReturnDecision({ careerId }: { careerId: string }) {
  const query = useCareer(careerId);
  const mutation = useCareerMutation('resolveLoanReturn');
  const navigate = useNavigate();
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useCommittingExitGuard(mutation.isPending);

  if (query.data === undefined) return null;
  const { state } = query.data;
  const pending = state.pending;
  if (pending === null || pending.kind !== 'LOAN_RETURN') return null;
  const loanPending = pending;

  async function recoverAfterResponseLoss(): Promise<number | null> {
    const refreshed = await query.refetch();
    if (refreshed.data === undefined) return null;
    return committedTransferRevision(refreshed.data.state, refreshed.data.record.revision);
  }

  async function refreshDecisionState() {
    try {
      const refreshed = await query.refetch();
      if (refreshed.data?.state.pending?.kind !== 'LOAN_RETURN') {
        const committedRevision = refreshed.data === undefined ? null : committedTransferRevision(refreshed.data.state, refreshed.data.record.revision);
        if (committedRevision !== null) {
          void navigate({ to: '/career/$careerId/transfer-result', params: { careerId }, search: { rev: committedRevision }, replace: true });
          return;
        }
      }
      setErrorMessage('아직 임대 복귀 결정이 열려 있습니다. 원하는 선택을 직접 다시 눌러 주세요.');
    } catch {
      setErrorMessage('저장 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  async function decide(decision: 'RETURN' | 'PERMANENT') {
    if (submittingRef.current || !loanPending.options.includes(decision)) return;
    submittingRef.current = true;
    setErrorMessage(null);
    setAnnouncement('임대 복귀 결정을 저장하는 중');
    try {
      const result = await mutation.mutateAsync({ careerId, decision });
      if (!result.ok) {
        setErrorMessage('선택할 수 없는 임대 복귀 결정입니다. 현재 조건을 확인해 주세요.');
        setAnnouncement('임대 복귀 결정에 실패했습니다');
        return;
      }
      // 성공 응답이 오지 않은 경우에도 catch에서 refetch만 수행한다. decision을 바꿔 재전송하지 않는다.
      void navigate({ to: '/career/$careerId/transfer-result', params: { careerId }, search: { rev: result.domainSnapshot.revision }, replace: true });
    } catch {
      const committedRevision = await recoverAfterResponseLoss().catch(() => null);
      if (committedRevision !== null) {
        void navigate({ to: '/career/$careerId/transfer-result', params: { careerId }, search: { rev: committedRevision }, replace: true });
        return;
      }
      setErrorMessage('응답을 확인하지 못했습니다. 저장 상태를 확인해 주세요.');
      setAnnouncement('응답을 확인하지 못했습니다');
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div className="os-screen">
      <p className="sr-only" aria-live="polite" data-testid="transfer-result-announcement">
        {announcement}
      </p>
      <ScreenIntro
        eyebrow="임대 복귀"
        title="임대 복귀 결정"
        description="임대 시즌 결과를 저장했습니다. 원소속으로 돌아가거나, 조건을 충족했다면 임대 구단에 남을 수 있습니다."
      />
      <Card className="flex flex-col gap-os-2">
        <p className="font-os text-os-text" style={BODY_STYLE}>
          매입 옵션
        </p>
        <p className="os-num font-os text-os-text-2" style={CAPTION_STYLE}>
          {loanPending.buyOptionMinor === null ? '없음' : formatKrw(loanPending.buyOptionMinor)}
        </p>
      </Card>
      {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void refreshDecisionState()} retryLabel="저장 상태 다시 확인" /> : null}
      <div className="os-action-dock">
        <Button variant="secondary" onClick={() => void decide('RETURN')} disabled={mutation.isPending}>
          원소속으로 복귀
        </Button>
        {loanPending.options.includes('PERMANENT') ? (
          <Button variant="primary" onClick={() => void decide('PERMANENT')} disabled={mutation.isPending}>
            임대 구단에 남기
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ContractResult({ view, careerId, state }: { view: TransferResultView; careerId: string; state: Parameters<typeof transferResultNextScreen>[0] }) {
  const ctaToPreseason = view.contract !== null && transferResultNextScreen(state) === 'PRESEASON';
  return (
    <div
      className="os-screen"
      data-testid="transfer-result"
      data-result-kind={view.kind}
      data-result-revision={view.revision}
      data-base-ovr-before={view.baseOvr.before}
      data-base-ovr-after={view.baseOvr.after}
    >
      <ScreenIntro eyebrow={view.kindLabel} title={view.title} description={view.body} />

      <Card className="flex flex-col gap-os-3">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          소속 변화
        </h2>
        <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
          <div>
            <dt>이전 소속</dt>
            <dd className="text-os-text">{view.previousTeam}</dd>
          </div>
          <div>
            <dt>새 소속</dt>
            <dd className="text-os-text">{view.newTeam}</dd>
          </div>
          <div>
            <dt>Base OVR</dt>
            <dd className="os-num text-os-text">{view.baseOvr.before} → {view.baseOvr.after}</dd>
          </div>
        </dl>
      </Card>

      {view.contract !== null ? (
        <Card className="flex flex-col gap-os-3">
          <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
            {view.kind === 'STAY' ? '현재 계약' : '새 계약'}
          </h2>
          <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
            <div>
              <dt>기간</dt>
              <dd className="os-num text-os-text">{view.contract.lengthSeasons}시즌</dd>
            </div>
            <div>
              <dt>리그</dt>
              <dd className="text-os-text">{view.contract.league}</dd>
            </div>
            <div>
              <dt>주급</dt>
              <dd className="os-num text-os-text">{formatKrw(view.contract.wageMinorPerWeek)}</dd>
            </div>
            <div>
              <dt>역할</dt>
              <dd className="text-os-text">{view.contract.role}</dd>
            </div>
            <div>
              <dt>출전 약속</dt>
              <dd className="os-num text-os-text">{view.contract.appearanceSharePercent}%</dd>
            </div>
            <div>
              <dt>포지션 계획</dt>
              <dd className="text-os-text">{view.contract.position}</dd>
            </div>
            <div>
              <dt>전술 적합도</dt>
              <dd className="os-num text-os-text">{view.contract.tacticalFit}</dd>
            </div>
            <div>
              <dt>경쟁 상태</dt>
              <dd className="text-os-text">{view.contract.competition}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          결과 사유
        </h2>
        <p className="font-os text-os-text" style={BODY_STYLE}>
          {view.reasonTag}
        </p>
      </Card>

      <div className="os-action-dock">
        <Link
          to={ctaToPreseason ? '/career/$careerId/preseason' : '/career/$careerId'}
          params={{ careerId }}
          className={buttonClassName('primary')}
          style={buttonStyle}
        >
          {ctaToPreseason ? '새 시즌 준비' : '대시보드로'}
        </Link>
      </div>
    </div>
  );
}

function TransferResultScreen() {
  const { careerId } = Route.useParams();
  const { rev, interested } = Route.useSearch();
  const query = useCareer(careerId);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-020', careerPhase: query.data?.state.seasonPhase ?? 'NONE' });
  }, []);

  const state = query.data?.state;
  const revision = state === undefined ? null : rev ?? latestTransferRevision(state);
  const view =
    state === undefined || revision === null || query.data === undefined || !isCurrentTransferResultRevision(state, query.data.record.revision, revision)
      ? null
      : resolveTransferResultView(state, revision, interested);

  useEffect(() => {
    if (view === null) return;
    setAnnouncement(`${view.kindLabel}: ${view.title}`);
  }, [view?.kindLabel, view?.title]);

  if (query.data === undefined) {
    return (
      <p className="font-os text-os-text-2" style={BODY_STYLE} aria-label="불러오는 중">
        불러오는 중
      </p>
    );
  }
  const loadedState = query.data.state;
  if (loadedState.pending?.kind === 'LOAN_RETURN') return <LoanReturnDecision careerId={careerId} />;
  if (view === null) return null;

  return (
    <>
      <p className="sr-only" aria-live="polite" data-testid="transfer-result-live">
        {announcement}
      </p>
      <ContractResult view={view} careerId={careerId} state={loadedState} />
    </>
  );
}
