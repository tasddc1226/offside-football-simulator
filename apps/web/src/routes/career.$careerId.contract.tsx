// SCR-010 첫 계약 상세와 SCR-017 시장 결정 상세를 같은 URL에서 처리한다.
// 첫 계약은 기존 사인 흐름을 보존하고, 시장 제안은 협상·개별 거절·수락을 제공한다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import type { NegotiationAsk, Offer } from '@offside/domain';
import { Button, Card, ErrorState, ScreenIntro, TeamBadge } from '@offside/ui';
import { recordFunnelReached } from '../engine/funnel.js';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { platform } from '../platform/index.js';
import {
  LEAGUE_TIER_LABEL_KO,
  ROLE_PROMISE_SENTENCE,
  SQUAD_ROLE_LABELS,
} from '../shared/labels.js';
import { formatKrw } from '../shared/format.js';
import { useCommittingExitGuard } from '../shared/use-committing-exit-guard.js';
import { committedTransferRevision, resolveTransferResultView } from '../shared/transfer-result.js';
import { getTeamIdentity } from '../shared/team-identity.js';
import {
  actionableRevision,
  buildNegotiationResultView,
  canAcceptOffer,
  canNegotiateOffer,
  MARKET_REASON_LABEL_KO,
  offerDetailRows,
  offerProjectionNotice,
  offerStatus,
  type NegotiationResultView,
} from '../shared/transfer-view.js';
import { ContractSignature } from '../shared/ContractSignature.js';

type ContractSearch = { offerId: string };
type PendingOperation = {
  kind: 'accept' | 'negotiate' | 'reject';
  offerId: string;
  beforeNegotiationState: string;
  beforeOffer?: Offer;
};
type FirstContractCommit = {
  teamId: string;
  teamName: string;
  league: string;
  role: string;
  wage: string;
  seasons: number;
  playerName: string;
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
      pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT'
        ? pending.offers.find((candidate) => candidate.id === deps.offerId)
        : undefined;
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

const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

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
  const [firstContractCommit, setFirstContractCommit] = useState<FirstContractCommit | null>(null);
  const [readySignatureFingerprint, setReadySignatureFingerprint] = useState<string | null>(null);
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
  if (firstContractCommit !== null) {
    const committedIdentity = getTeamIdentity(firstContractCommit.teamId);
    return (
      <div className="os-screen" aria-live="polite">
        <ScreenIntro eyebrow="계약 체결 완료" title="프로의 첫 유니폼" description={`${firstContractCommit.playerName} 선수의 첫 프로 계약이 저장되었습니다.`} />
        <section className="os-panel flex flex-col gap-os-5" aria-labelledby="signed-contract-heading">
          <div>
            <p className="os-eyebrow">WELCOME TO</p>
            <h2 id="signed-contract-heading" className="os-section-title flex items-center gap-os-2">
              <TeamBadge initials={committedIdentity.initials} colorVar={committedIdentity.colorVar} size="m" />
              {firstContractCommit.teamName}
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-os-3 font-os text-os-text-2" style={CAPTION_STYLE}>
            <div><dt>리그</dt><dd className="font-semibold text-os-text">{firstContractCommit.league}</dd></div>
            <div><dt>역할</dt><dd className="font-semibold text-os-text">{firstContractCommit.role}</dd></div>
            <div><dt>주급</dt><dd className="os-num font-semibold text-os-text">{firstContractCommit.wage}</dd></div>
            <div><dt>기간</dt><dd className="os-num font-semibold text-os-text">{firstContractCommit.seasons}시즌</dd></div>
          </dl>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>확정된 계약 내용은 커리어 기록에 그대로 남습니다.</p>
        </section>
        <div className="os-action-dock">
          <Button variant="primary" onClick={() => void navigate({ to: '/career/$careerId', params: { careerId }, search: { signed: true }, replace: true })}>커리어 시작</Button>
        </div>
      </div>
    );
  }
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
  // INTEREST 시장 안전 잔류 결과에 "관심을 보인 구단 N곳"을 보여주려는 값. 닫힌 함수(handleAccept) 안에서는
  // TS가 pending의 null 좁힘을 유지하지 않으므로 여기서(narrowing이 되는 최상위 스코프) 미리 센다.
  const marketOfferCount = pending.offers.length;
  const firstContract = pending.market.reason === 'FIRST_CONTRACT';
  const requiresSignature = !(pending.market.reason === 'INTEREST' && offer.id === pending.market.safeOfferId);
  const signatureFingerprint = JSON.stringify({ careerId, revision: record.revision, offer });
  const signatureReady = readySignatureFingerprint === signatureFingerprint;
  const projectionNotice = offerProjectionNotice(state.rulesetVersion, pending.market.reason);
  const parentTeamName = state.contract?.teamName ?? state.clubHistory.at(-1)?.teamName ?? null;
  const actionRevision = actionableRevision(record.revision);
  const status = offerStatus(offer, actionRevision);
  const detailRows = offerDetailRows(offer, record.revision, safeOfferId, parentTeamName);
  const firstContractDetailRows = detailRows.filter(
    (row) => !['리그', '기간', '주급', '계약금', '역할 약속'].includes(row.label),
  );

  function goToResult(revision: number, interestedClubCount?: number) {
    void navigate({
      to: '/career/$careerId/transfer-result',
      params: { careerId },
      search: interestedClubCount === undefined ? { rev: revision } : { rev: revision, interested: interestedClubCount },
      replace: true,
    });
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
    if (submittingRef.current || !canAcceptOffer(selectedOffer, record.revision) || (requiresSignature && !signatureReady)) return;
    submittingRef.current = true;
    operationRef.current = { kind: 'accept', offerId, beforeNegotiationState: selectedOffer.negotiationState };
    // INTEREST 시장 안전 잔류(안전 offerId 수락)는 결과 화면에 "관심을 보인 구단 N곳"을 보여준다.
    // buildStayState가 pending을 지워 도메인이 이 개수를 저장하지 않으므로, 수락 전 이 렌더의
    // pending에서 직접 센다(mutation 응답이 아니라 이미 로드된 조회 데이터라 유실 걱정이 없다).
    const interestedClubCount = selectedOffer.id === safeOfferId ? marketOfferCount - 1 : undefined;
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
        const committed = result.domainSnapshot.state.contract;
        if (committed === null) {
          setErrorMessage('계약은 처리됐지만 확정 내용을 불러오지 못했습니다. 저장 상태를 확인해 주세요.');
          return;
        }
        setFirstContractCommit({
          teamId: committed.teamId,
          teamName: committed.teamName,
          league: LEAGUE_TIER_LABEL_KO[committed.leagueTier],
          role: SQUAD_ROLE_LABELS[committed.rolePromise],
          wage: formatKrw(committed.wageMinorPerWeek),
          seasons: committed.lengthSeasons,
          playerName: result.domainSnapshot.state.player.profile?.name ?? '선수',
        });
      } else {
        operationRef.current = null;
        const { state: nextState, revision: nextRevision } = result.domainSnapshot;
        if (resolveTransferResultView(nextState, nextRevision, interestedClubCount) !== null) {
          goToResult(nextRevision, interestedClubCount);
        } else {
          // 결과로 재구성할 수 없는 전환(도메인이 timeline에 남기지 않는 케이스)이면 transfer-result의
          // loader가 다시 튕겨내기 전에 여기서 바로 현재 결정 화면으로 보낸다.
          navigateToCurrentDecision(nextState);
        }
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
    const identity = getTeamIdentity(offer.teamId);
    return (
      <div className="os-screen">
        <ScreenIntro
          eyebrow="나의 다음 팀"
          title={`${offer.teamName} 계약`}
          description="함께 뛸 팀과 약속할 조건을 마지막으로 확인하세요."
        />

        <section className="os-panel flex flex-col gap-os-5" aria-labelledby="contract-terms-heading">
          <div className="flex items-center justify-between gap-os-3 border-b border-os-border pb-os-4">
            <div className="flex flex-col gap-os-1">
              <p className="os-eyebrow">계약 조건</p>
              <h2 id="contract-terms-heading" className="os-section-title flex items-center gap-os-2">
                <TeamBadge initials={identity.initials} colorVar={identity.colorVar} size="m" />
                {offer.teamName}
              </h2>
            </div>
            <span
              className="os-num rounded-os-m bg-os-surface-2 px-os-3 py-os-2 font-bold text-os-text-2"
              aria-label={`등번호 ${offer.shirtNumber}`}
            >
              #{offer.shirtNumber}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-os-4 font-os text-os-text-2" style={CAPTION_STYLE}>
            <div className="flex flex-col gap-os-1">
              <dt>리그</dt>
              <dd className="font-semibold text-os-text">{LEAGUE_TIER_LABEL_KO[offer.leagueTier]}</dd>
            </div>
            <div className="flex flex-col gap-os-1">
              <dt>기간</dt>
              <dd className="os-num font-semibold text-os-text">{offer.lengthSeasons}시즌</dd>
            </div>
            <div className="flex flex-col gap-os-1">
              <dt>주급</dt>
              <dd className="os-num font-semibold text-os-text">
                {formatKrw(offer.wageMinorPerWeek)}
              </dd>
            </div>
            <div className="flex flex-col gap-os-1">
              <dt>계약금</dt>
              <dd className="os-num font-semibold text-os-text">
                {formatKrw(offer.signingBonusMinor)}
              </dd>
            </div>
            <div className="flex flex-col gap-os-1">
              <dt>역할 약속</dt>
              <dd className="font-semibold text-os-text">{SQUAD_ROLE_LABELS[offer.rolePromise]}</dd>
            </div>
            <div className="flex flex-col gap-os-1">
              <dt>등번호</dt>
              <dd className="os-num font-semibold text-os-text">{offer.shirtNumber}</dd>
            </div>
          </dl>
        </section>

        <section className="os-story-card" aria-labelledby="contract-promise-heading">
          <h2 id="contract-promise-heading" className="os-eyebrow">
            구단의 약속
          </h2>
          <p className="font-os text-os-text" style={BODY_STYLE}>
            {ROLE_PROMISE_SENTENCE[offer.rolePromise]}
          </p>
          {projectionNotice ? <p className="mt-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>{projectionNotice}</p> : null}
        </section>

        <details className="os-panel">
          <summary className="cursor-pointer font-os font-semibold text-os-text">전체 제안 조건 확인</summary>
          <dl className="mt-os-3 grid grid-cols-2 gap-os-3 font-os text-os-text-2" style={CAPTION_STYLE}>
            {firstContractDetailRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd className="font-semibold text-os-text">{row.value}</dd>
              </div>
            ))}
          </dl>
          {state.rulesetVersion === '1.0.0' ? (
            <p className="mt-os-3 font-os text-os-text-2" style={CAPTION_STYLE}>
              전술 적합도와 경쟁자 정보는 1.0 커리어의 기존 산정값을 보여 주는 참고 정보이며, 실제 출전 선택을 예측하지 않습니다.
            </p>
          ) : null}
        </details>

        <ContractSignature
          key={signatureFingerprint}
          signerName={playerName}
          fingerprint={signatureFingerprint}
          disabled={acceptMutation.isPending}
          onReadyChange={(ready) => setReadySignatureFingerprint(ready ? signatureFingerprint : null)}
        />

        {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void recoverFromError()} /> : null}

        <div className="os-action-dock os-action-row">
          <Button
            variant="secondary"
            className="basis-1/3"
            onClick={handleBack}
            disabled={acceptMutation.isPending}
          >
            뒤로
          </Button>
          <Button
            variant="primary"
            className="basis-2/3"
            onClick={() => void handleAccept()}
            disabled={acceptMutation.isPending || !canAcceptOffer(offer, record.revision) || !signatureReady}
          >
            서명하고 계약 확정
          </Button>
        </div>
      </div>
    );
  }

  const marketOfferIdentity = getTeamIdentity(offer.teamId);
  return (
    <div className="os-screen">
      <p className="sr-only" aria-live="polite" data-testid="contract-announcement">
        {announcement}
      </p>

      <ScreenIntro
        eyebrow={MARKET_REASON_LABEL_KO[pending.market.reason]}
        title={
          <span className="inline-flex items-center gap-os-2">
            <TeamBadge initials={marketOfferIdentity.initials} colorVar={marketOfferIdentity.colorVar} size="s" />
            {offer.teamName} 제안 상세
          </span>
        }
        description="비교한 조건을 협상하거나 결정하세요."
      />

      {negotiationResult !== null ? (
        <NegotiationResultPanel
          view={negotiationResult}
          onBack={() => void navigate({ to: '/career/$careerId/offers', params: { careerId }, replace: true })}
        />
      ) : null}

      <Card className="flex flex-col gap-os-3">
        <p className="os-eyebrow">핵심 조건</p>
        <h2 className="os-section-title">
          {SQUAD_ROLE_LABELS[offer.rolePromise]} · 주급 {formatKrw(offer.wageMinorPerWeek)}
        </h2>
        <p className="font-os text-os-text" style={BODY_STYLE}>
          {offer.lengthSeasons}시즌 · {LEAGUE_TIER_LABEL_KO[offer.leagueTier]} · 등번호 {offer.shirtNumber}
        </p>
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>{ROLE_PROMISE_SENTENCE[offer.rolePromise]}</p>
        {projectionNotice ? <p className="font-os text-os-text-2" style={CAPTION_STYLE}>{projectionNotice}</p> : null}
        <details className="border-t border-os-border pt-os-3">
          <summary className="cursor-pointer font-os font-semibold text-os-text">전체 공개 조건</summary>
          <dl className="mt-os-3 grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
            {detailRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd className="text-os-text">{row.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </Card>

      {requiresSignature ? (
        <ContractSignature
          key={signatureFingerprint}
          signerName={state.player.profile?.name ?? state.player.draft.name ?? '선수'}
          fingerprint={signatureFingerprint}
          disabled={committing}
          onReadyChange={(ready) => setReadySignatureFingerprint(ready ? signatureFingerprint : null)}
        />
      ) : (
        <p className="os-muted">현재 팀 잔류 선택에는 별도 서명이 필요하지 않습니다.</p>
      )}

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

      <div className="os-action-dock flex flex-col gap-os-2">
        <div className="grid grid-cols-2 gap-os-2">
          <Button variant="secondary" onClick={handleBack} disabled={committing}>목록으로</Button>
          <Button variant="secondary" onClick={() => void handleReject()} disabled={committing || offer.id === safeOfferId || status === 'EXPIRED' || status === 'WITHDRAWN'}>
            제안 거절
          </Button>
        </div>
        <Button variant="primary" onClick={() => void handleAccept()} disabled={committing || !canAcceptOffer(offer, record.revision) || (requiresSignature && !signatureReady)}>
          {requiresSignature ? '서명하고 계약 확정' : '현재 팀 잔류 확정'}
        </Button>
      </div>
    </div>
  );
}
