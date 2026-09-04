// SCR-010 첫 계약 상세와 SCR-017 시장 결정 상세를 같은 URL에서 처리한다.
// 첫 계약은 기존 사인 흐름을 보존하고, 시장 제안은 협상·개별 거절·수락을 제공한다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import type { NegotiationAsk, Offer } from '@offside/domain';
import { Button, Card, ErrorState } from '@offside/ui';
import { recordFunnelReached } from '../engine/funnel.js';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { platform } from '../platform/index.js';
import { LEAGUE_TIER_LABEL_KO, ROLE_PROMISE_SENTENCE, SQUAD_ROLE_LABELS } from '../shared/labels.js';
import { formatKrw } from '../shared/format.js';
import { useCommittingExitGuard } from '../shared/use-committing-exit-guard.js';
import { committedTransferRevision } from '../shared/transfer-result.js';
import {
  actionableRevision,
  buildNegotiationResultView,
  canAcceptOffer,
  canNegotiateOffer,
  offerDetailRows,
  offerStatus,
  type NegotiationResultView,
} from '../shared/transfer-view.js';

type ContractSearch = { offerId: string };
type PendingOperation = {
  kind: 'accept' | 'negotiate' | 'reject';
  offerId: string;
  beforeNegotiationState: string;
  beforeOffer?: Offer;
};

export const Route = createFileRoute('/career/$careerId/contract')({
  validateSearch: (search: Record<string, unknown>): ContractSearch => ({
    offerId: typeof search.offerId === 'string' ? search.offerId : '',
  }),
  loaderDeps: ({ search }) => ({ offerId: search.offerId }),
  loader: async ({ params, deps }) => {
    const { record, state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const pending = state.pending;
    const offer =
      pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT' ? pending.offers.find((candidate) => candidate.id === deps.offerId) : undefined;
    if (offer === undefined) {
      const committedRevision = committedTransferRevision(state, record.revision, deps.offerId);
      if (committedRevision !== null) {
        throw redirect({
          to: SCREEN_ROUTES['SCR-020'],
          params: { careerId: params.careerId },
          search: { rev: committedRevision },
          replace: true,
        });
      }
      const target = screenForCareer(state);
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: ContractScreen,
});

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

const ASK_LABELS: Record<NegotiationAsk, string> = { WAGE: '주급', ROLE: '역할', LENGTH: '기간' };

function NegotiationResultPanel({ view, onBack }: { view: NegotiationResultView; onBack: () => void }) {
  return (
    <Card className="flex flex-col gap-os-3" data-testid="negotiation-result">
      <h2 className="font-os font-semibold text-os-text" style={BODY_STYLE}>
        협상 결과
      </h2>
      <p className="font-os text-os-text" style={BODY_STYLE} aria-live="polite" data-testid="negotiation-result-live">
        {view.reason}
      </p>
      <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
        <div>
          <dt>협상 항목</dt>
          <dd className="text-os-text">{view.askLabel}</dd>
        </div>
        <div>
          <dt>변경 전</dt>
          <dd className="text-os-text">{view.before}</dd>
        </div>
        <div>
          <dt>변경 후</dt>
          <dd className="text-os-text">{view.after}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd className="text-os-text">{view.outcome === 'COUNTERED' ? '협상된 제안' : '철회됨'}</dd>
        </div>
      </dl>
      <div>
        <h3 className="font-os font-semibold text-os-text" style={CAPTION_STYLE}>
          남은 대안
        </h3>
        {view.remainingOffers.length > 0 ? (
          <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={CAPTION_STYLE} aria-label="남은 대안">
            {view.remainingOffers.map((candidate) => (
              <li key={candidate.id}>
                {candidate.teamName} · {candidate.kind}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            남은 대안이 없습니다.
          </p>
        )}
      </div>
      <Button variant="secondary" onClick={onBack}>
        제안 목록으로
      </Button>
    </Card>
  );
}

function recoverCommittedRevision(
  state: Parameters<typeof committedTransferRevision>[0],
  currentRevision: number,
  offerId: string,
): number | null {
  return committedTransferRevision(state, currentRevision, offerId);
}

function ContractScreen() {
  const { careerId } = Route.useParams();
  const { offerId } = Route.useSearch();
  const query = useCareer(careerId);
  const acceptMutation = useCareerMutation('acceptOffer');
  const negotiateMutation = useCareerMutation('negotiateOffer');
  const rejectMutation = useCareerMutation('rejectOffer');
  const navigate = useNavigate();
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [negotiationResult, setNegotiationResult] = useState<NegotiationResultView | null>(null);
  const operationRef = useRef<PendingOperation | null>(null);
  const committing = acceptMutation.isPending || negotiateMutation.isPending || rejectMutation.isPending;

  useCommittingExitGuard(committing);

  useEffect(() => {
    if (query.data === undefined) return;
    const pending = query.data.state.pending;
    const screenId =
      (pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT') && pending.market.reason === 'FIRST_CONTRACT' ? 'SCR-010' : 'SCR-017';
    platform.analytics.track('screen_viewed', { screenId, careerPhase: query.data.state.seasonPhase });
  }, [query.data?.record.revision, query.data?.state.pending?.kind]);

  if (query.data === undefined) return null;

  const { record, state } = query.data;
  const pending = state.pending;
  if (pending === null || (pending.kind !== 'OFFERS' && pending.kind !== 'CONTRACT')) return null;
  const offer = pending.offers.find((candidate) => candidate.id === offerId);
  if (offer === undefined) {
    if (negotiationResult === null) return null;
    return (
      <div className="flex flex-col gap-os-6">
        <NegotiationResultPanel
          view={negotiationResult}
          onBack={() => void navigate({ to: '/career/$careerId/offers', params: { careerId }, replace: true })}
        />
      </div>
    );
  }
  const selectedOffer: Offer = offer;

  const safeOfferId = pending.market.safeOfferId;
  const firstContract = pending.market.reason === 'FIRST_CONTRACT';
  const parentTeamName = state.contract?.teamName ?? state.clubHistory.at(-1)?.teamName ?? null;
  const actionRevision = actionableRevision(record.revision);
  const status = offerStatus(offer, actionRevision);
  const detailRows = offerDetailRows(offer, record.revision, safeOfferId, parentTeamName);

  function goToResult(revision: number) {
    void navigate({ to: '/career/$careerId/transfer-result', params: { careerId }, search: { rev: revision }, replace: true });
  }

  function navigateToCurrentDecision(nextState: typeof state) {
    const target = screenForCareer(nextState);
    if (target.screenId === 'SCR-009' || target.screenId === 'SCR-017') {
      void navigate({ to: '/career/$careerId/offers', params: { careerId }, replace: true });
      return;
    }
    void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params, replace: true });
  }

  /** 응답 유실·네트워크 오류 복구는 항상 refetch만 한다. 여기서 어떤 domain command도 재전송하지 않는다. */
  async function recoverFromError() {
    const operation = operationRef.current;
    try {
      const refreshed = await query.refetch();
      if (refreshed.data === undefined || operation === null) return;
      const refreshedState = refreshed.data.state;
      if (operation.kind === 'accept') {
        const firstContractCommitted =
          firstContract &&
          refreshedState.pending === null &&
          refreshedState.contract?.offerId === operation.offerId &&
          refreshedState.contract.signedAtRevision === refreshed.data.record.revision &&
          refreshedState.timeline.some(
            (entry) => entry.revision === refreshed.data.record.revision && entry.kind === 'CONTRACT_SIGNED' && entry.refId === refreshedState.contract?.id,
          );
        if (firstContractCommitted) {
          // recordFunnelReached is idempotent; a lost response can safely retry only
          // this analytics write before restoring the original signed dashboard.
          await recordFunnelReached(careerId, 'CONTRACT_SIGNED');
          operationRef.current = null;
          void navigate({ to: '/career/$careerId', params: { careerId }, search: { signed: true }, replace: true });
          return;
        }
        const committedRevision = recoverCommittedRevision(refreshedState, refreshed.data.record.revision, operation.offerId);
        if (committedRevision !== null && !firstContract) {
          goToResult(committedRevision);
          return;
        }
        if (refreshedState.pending === null) {
          navigateToCurrentDecision(refreshedState);
          return;
        }
      }
      if (operation.kind === 'negotiate') {
        const latestOffer =
          refreshedState.pending?.kind === 'OFFERS' || refreshedState.pending?.kind === 'CONTRACT'
            ? refreshedState.pending.offers.find((candidate) => candidate.id === operation.offerId)
            : undefined;
        if (latestOffer === undefined || latestOffer.negotiationState !== operation.beforeNegotiationState) {
          const resultView =
            operation.beforeOffer === undefined
              ? null
              : buildNegotiationResultView(operation.beforeOffer, { revision: refreshed.data.record.revision, state: refreshedState });
          if (resultView !== null) {
            setNegotiationResult(resultView);
            setAnnouncement(`${resultView.teamName} ${resultView.askLabel} 협상 결과: ${resultView.before} → ${resultView.after}`);
            operationRef.current = null;
            setErrorMessage(null);
            return;
          }
          navigateToCurrentDecision(refreshedState);
          return;
        }
      }
      if (operation.kind === 'reject') {
        const latestOffer =
          refreshedState.pending?.kind === 'OFFERS' || refreshedState.pending?.kind === 'CONTRACT'
            ? refreshedState.pending.offers.find((candidate) => candidate.id === operation.offerId)
            : undefined;
        if (latestOffer === undefined) {
          navigateToCurrentDecision(refreshedState);
          return;
        }
      }
      setErrorMessage('저장 상태를 확인했지만 아직 결정이 반영되지 않았습니다. 제안 목록에서 다시 확인해 주세요.');
    } catch {
      setErrorMessage('저장 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  async function handleAccept() {
    if (submittingRef.current || !canAcceptOffer(selectedOffer, record.revision)) return;
    submittingRef.current = true;
    operationRef.current = { kind: 'accept', offerId, beforeNegotiationState: selectedOffer.negotiationState };
    setErrorMessage(null);
    setAnnouncement('처리 중');
    try {
      const result = await acceptMutation.mutateAsync({ careerId, offerId });
      if (!result.ok) {
        operationRef.current = null;
        setErrorMessage('계약을 확정하지 못했습니다. 제안 상태를 확인해 주세요.');
        setAnnouncement('계약 확정에 실패했습니다');
        return;
      }
      if (firstContract) {
        await recordFunnelReached(careerId, 'CONTRACT_SIGNED');
        void navigate({ to: '/career/$careerId', params: { careerId }, search: { signed: true }, replace: true });
      } else {
        operationRef.current = null;
        goToResult(result.domainSnapshot.revision);
      }
    } catch {
      setErrorMessage('응답을 확인하지 못했습니다. 저장 상태를 새로 확인해 주세요.');
      setAnnouncement('응답을 확인하지 못했습니다');
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleNegotiate(ask: NegotiationAsk) {
    if (submittingRef.current || !canNegotiateOffer(selectedOffer, record.revision, ask)) return;
    submittingRef.current = true;
    operationRef.current = {
      kind: 'negotiate',
      offerId,
      beforeNegotiationState: selectedOffer.negotiationState,
      beforeOffer: selectedOffer,
    };
    setErrorMessage(null);
    setAnnouncement('협상 처리 중');
    try {
      const result = await negotiateMutation.mutateAsync({ careerId, offerId, ask });
      if (!result.ok) {
        operationRef.current = null;
        setErrorMessage('이 항목은 지금 협상할 수 없습니다. 제안 상태를 확인해 주세요.');
        setAnnouncement('협상할 수 없습니다');
        return;
      }
      const resultView = buildNegotiationResultView(selectedOffer, result.domainSnapshot);
      if (resultView === null) {
        operationRef.current = null;
        setErrorMessage('협상 결과를 확인하지 못했습니다. 저장 상태를 다시 확인해 주세요.');
        setAnnouncement('협상 결과를 확인하지 못했습니다');
        return;
      }
      setNegotiationResult(resultView);
      setAnnouncement(`${resultView.teamName} ${resultView.askLabel} 협상 결과: ${resultView.before} → ${resultView.after}`);
      operationRef.current = null;
    } catch {
      setErrorMessage('협상 응답을 확인하지 못했습니다. 새로고침 후 상태를 확인해 주세요.');
      setAnnouncement('협상 응답을 확인하지 못했습니다');
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleReject() {
    if (submittingRef.current || selectedOffer.id === safeOfferId || status === 'EXPIRED' || status === 'WITHDRAWN') return;
    submittingRef.current = true;
    operationRef.current = { kind: 'reject', offerId, beforeNegotiationState: selectedOffer.negotiationState };
    setErrorMessage(null);
    setAnnouncement('거절 처리 중');
    try {
      const result = await rejectMutation.mutateAsync({ careerId, offerId });
      if (!result.ok) {
        operationRef.current = null;
        setErrorMessage('제안을 거절하지 못했습니다. 안전 잔류 제안은 개별 거절할 수 없습니다.');
        setAnnouncement('제안 거절에 실패했습니다');
        return;
      }
      const nextState = result.domainSnapshot.state;
      operationRef.current = null;
      const target = screenForCareer(nextState);
      void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params, replace: true });
    } catch {
      setErrorMessage('거절 응답을 확인하지 못했습니다. 새로고침 후 상태를 확인해 주세요.');
      setAnnouncement('거절 응답을 확인하지 못했습니다');
    } finally {
      submittingRef.current = false;
    }
  }

  function handleBack() {
    void navigate({ to: '/career/$careerId/offers', params: { careerId } });
  }

  if (firstContract) {
    const playerName = state.player.profile?.name ?? state.player.draft.name ?? '선수';
    return (
      <div className="flex flex-col gap-os-6">
        <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
          {offer.teamName} 계약
        </h1>

        <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
          <div>
            <dt>리그</dt>
            <dd className="text-os-text">{LEAGUE_TIER_LABEL_KO[offer.leagueTier]}</dd>
          </div>
          <div>
            <dt>기간</dt>
            <dd className="os-num text-os-text">{offer.lengthSeasons}시즌</dd>
          </div>
          <div>
            <dt>주급</dt>
            <dd className="os-num text-os-text">{formatKrw(offer.wageMinorPerWeek)}</dd>
          </div>
          <div>
            <dt>계약금</dt>
            <dd className="os-num text-os-text">{formatKrw(offer.signingBonusMinor)}</dd>
          </div>
          <div>
            <dt>역할 약속</dt>
            <dd className="text-os-text">{SQUAD_ROLE_LABELS[offer.rolePromise]}</dd>
          </div>
          <div>
            <dt>등번호</dt>
            <dd className="os-num text-os-text">{offer.shirtNumber}</dd>
          </div>
        </dl>

        <p className="font-os text-os-text" style={BODY_STYLE}>
          {ROLE_PROMISE_SENTENCE[offer.rolePromise]}
        </p>

        <div className="flex flex-col gap-os-1">
          <p className="font-os font-bold text-os-text" style={BODY_STYLE}>
            {playerName}
          </p>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            자동 서명으로 처리됩니다. 손글씨 서명은 이후 지원됩니다.
          </p>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void recoverFromError()} /> : null}

        <div className="flex gap-os-3">
          <Button variant="secondary" onClick={handleBack}>
            뒤로
          </Button>
          <Button variant="primary" onClick={() => void handleAccept()} disabled={acceptMutation.isPending}>
            사인
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-os-6">
      <p className="sr-only" aria-live="polite" data-testid="contract-announcement">
        {announcement}
      </p>
      <div className="flex flex-col gap-os-2">
        <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
          {offer.teamName} 제안 상세
        </h1>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          비교한 조건을 협상하거나 결정하세요.
        </p>
      </div>

      {negotiationResult !== null ? (
        <NegotiationResultPanel
          view={negotiationResult}
          onBack={() => void navigate({ to: '/career/$careerId/offers', params: { careerId }, replace: true })}
        />
      ) : null}

      <Card className="flex flex-col gap-os-3">
        <h2 className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          공개 조건
        </h2>
        <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
          {detailRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd className="text-os-text">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="font-os text-os-text" style={BODY_STYLE}>
          {ROLE_PROMISE_SENTENCE[offer.rolePromise]}
        </p>
      </Card>

      <Card className="flex flex-col gap-os-3">
        <h2 className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          한 번 협상하기
        </h2>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          협상은 제안마다 한 번만 가능합니다. 철회된 제안은 다시 협상할 수 없습니다.
        </p>
        <div className="grid grid-cols-1 gap-os-2 sm:grid-cols-3">
          {(Object.keys(ASK_LABELS) as NegotiationAsk[]).map((ask) => (
            <Button
              key={ask}
              variant="secondary"
              onClick={() => void handleNegotiate(ask)}
              disabled={committing || !canNegotiateOffer(offer, record.revision, ask)}
              aria-label={`${ASK_LABELS[ask]} 협상`}
            >
              {ASK_LABELS[ask]} 협상
            </Button>
          ))}
        </div>
      </Card>

      {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void recoverFromError()} retryLabel="저장 상태 다시 확인" /> : null}

      <div className="flex flex-wrap gap-os-3">
        <Button variant="secondary" onClick={handleBack} disabled={committing}>
          뒤로
        </Button>
        <Button variant="secondary" onClick={() => void handleReject()} disabled={committing || offer.id === safeOfferId || status === 'EXPIRED' || status === 'WITHDRAWN'}>
          이 제안 거절
        </Button>
        <Button variant="primary" onClick={() => void handleAccept()} disabled={committing || !canAcceptOffer(offer, record.revision)}>
          이 조건 수락
        </Button>
      </div>
    </div>
  );
}
