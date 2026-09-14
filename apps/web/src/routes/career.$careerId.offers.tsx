// SCR-009 첫 프로 제안과 SCR-017 시장 제안을 같은 URL에서 분기한다.
// market.reason이 FIRST_CONTRACT이면 기존 첫 계약 흐름을 보존하고, 그 외에는 T-3-005의
// 비교·협상·거절 화면으로 투영한다. 모든 값은 저장된 domain snapshot에서 읽는다.
import { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import type { CareerState, Offer } from '@offside/domain';
import {
  Button,
  buttonClassName,
  buttonStyle,
  Card,
  EmptyState,
  ErrorState,
  ScreenIntro,
} from '@offside/ui';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { committedTransferRevision } from '../shared/transfer-result.js';
import { platform } from '../platform/index.js';
import { useCommittingExitGuard } from '../shared/use-committing-exit-guard.js';
import { MARKET_REASON_LABEL_KO } from '../shared/transfer-view.js';
import { buildCurrentContractSummary } from '../shared/transfer-view.js';
import { CompactOfferCard } from '../shared/contract-presentation.js';
import { rulesetForCareer } from '../engine/content.js';
import { buildCareerFollowUpReceipts, CareerFollowUpReceipts } from '../shared/career-followup.js';

type OffersTarget = 'SCR-009' | 'SCR-017';

export const Route = createFileRoute('/career/$careerId/offers')({
  loader: async ({ params }) => {
    const { record, state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const target = screenForCareer(state);
    if (target.screenId !== 'SCR-009' && target.screenId !== 'SCR-017') {
      const committedRevision = committedTransferRevision(state, record.revision);
      if (committedRevision !== null) {
        throw redirect({
          to: SCREEN_ROUTES['SCR-020'],
          params: target.params,
          search: { rev: committedRevision },
          replace: true,
        });
      }
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: OffersScreen,
});

const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

export function shouldShowRecoveryOpportunityNotice(
  state: CareerState,
  offers: readonly Offer[],
): boolean {
  const policy = rulesetForCareer(state).transferRules.recovery;
  if (policy === undefined || state.seasonHistory.length < policy.zeroMinutesConsecutiveSeasons) {
    return false;
  }
  const recent = state.seasonHistory.slice(-policy.zeroMinutesConsecutiveSeasons);
  const hasConsecutiveZeroMinutes = recent.every(
    (season) => season.result.playerStats.minutes === 0,
  );
  const hasActualOpportunity = offers.some(
    (offer) =>
      offer.leagueTier === policy.opportunityTier && offer.teamId !== state.contract?.teamId,
  );
  return hasConsecutiveZeroMinutes && hasActualOpportunity;
}

/**
 * D-69(이슈 141): "최근 두 시즌 출전이 없었습니다"가 룰셋 값(1.3.0 = 2시즌)과 무관하게 하드코딩돼
 * 있었다. 1이면 "지난 시즌", 2 이상이면 실제 시즌 수를 문장에 넣는다.
 */
export function recoveryOpportunityHeadline(zeroMinutesConsecutiveSeasons: number): string {
  return zeroMinutesConsecutiveSeasons === 1
    ? '지난 시즌 출전이 없었습니다.'
    : `최근 ${zeroMinutesConsecutiveSeasons}시즌 출전이 없었습니다.`;
}

/**
 * 이슈 159: 제안이 1건이면 "비교"가 아니다. 첫 계약은 "받은 제안", 시장은 "이적시장 제안"으로
 * 갈리고(e2e 헬퍼가 두 화면을 표제로 구분하므로 시장 쪽 접두는 유지), 2건 이상은 기존 표제 그대로.
 */
export function offersScreenTitle(firstContract: boolean, offerCount: number): string {
  if (firstContract) return offerCount <= 1 ? '받은 제안' : '제안 비교';
  return offerCount <= 1 ? '이적시장 제안' : '이적시장 제안 비교';
}

function MarketSummary({ state, offers }: { state: CareerState; offers: readonly Offer[] }) {
  const pending = state.pending;
  if (pending === null || (pending.kind !== 'OFFERS' && pending.kind !== 'CONTRACT')) return null;
  const values = buildCurrentContractSummary(state);
  return (
    <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
      {values.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className="text-os-text">{item.value}</dd>
        </div>
      ))}
      <div>
        <dt>시장 이유</dt>
        <dd className="text-os-text">{MARKET_REASON_LABEL_KO[pending.market.reason]}</dd>
      </div>
      <div>
        <dt>제안 수</dt>
        <dd className="os-num text-os-text">{offers.length}건</dd>
      </div>
    </dl>
  );
}

function RejectAllButton({ careerId, kind }: { careerId: string; kind: 'OFFERS' | 'CONTRACT' }) {
  const navigate = useNavigate();
  const query = useCareer(careerId);
  const mutation = useCareerMutation('rejectOffer');
  const submittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useCommittingExitGuard(mutation.isPending);

  async function handleRejectAll() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    try {
      const result = await mutation.mutateAsync({ careerId, offerId: null });
      if (!result.ok) {
        setErrorMessage('제안을 모두 거절하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      const target = screenForCareer(result.domainSnapshot.state);
      void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params, replace: true });
    } catch {
      setErrorMessage('응답을 확인하지 못했습니다. 저장 상태를 확인해 주세요.');
    } finally {
      submittingRef.current = false;
    }
  }

  async function refreshAfterResponseLoss() {
    try {
      const refreshed = await query.refetch();
      if (refreshed.data === undefined) {
        setErrorMessage('저장 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      if (refreshed.data.state.pending === null) {
        const target = screenForCareer(refreshed.data.state);
        void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params, replace: true });
        return;
      }
      setErrorMessage('제안이 아직 열려 있습니다. 목록에서 다음 결정을 직접 선택해 주세요.');
    } catch {
      setErrorMessage('저장 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  // C9: step 7 PRE_NEGOTIATION(CONTRACT pending)의 전부 거절은 "잔류"가 아니라 계약 만료로
  // 이어진다(도메인 REJECT_OFFER(null) CONTRACT 분기는 pending만 닫고 계약 잔여는 그대로 0이라,
  // 결산 시 market.ts가 EXPIRED를 판정해 강제 이적시장을 연다). OFFERS 시장(INTEREST/EXPIRED)의
  // 전부 거절 문구·동작은 그대로 둔다.
  const buttonLabel =
    kind === 'CONTRACT' ? '재계약 제안 거절 — 시즌 뒤 이적시장에서 결정' : '제안 모두 거절하고 잔류';

  return (
    <div className="flex flex-col gap-os-2">
      <Button variant="secondary" onClick={() => void handleRejectAll()} disabled={mutation.isPending}>
        {buttonLabel}
      </Button>
      {kind === 'CONTRACT' ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          거절하면 계약이 만료돼 시즌 결산 뒤 이적시장이 열립니다. 잔류 제안은 그때 다시 나옵니다.
        </p>
      ) : null}
      {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void refreshAfterResponseLoss()} retryLabel="저장 상태 다시 확인" /> : null}
    </div>
  );
}

function FirstContractOffers({
  careerId,
  state,
  revision,
  offers,
}: {
  careerId: string;
  state: CareerState;
  revision: number;
  offers: readonly Offer[];
}) {
  if (offers.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        reason="제안이 없습니다"
        action={
          <Link to="/" className={buttonClassName('primary')} style={buttonStyle}>
            허브로
          </Link>
        }
      />
    );
  }

  return (
    <>
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        결정 기한이 지난 제안은 자동으로 철회됩니다.
      </p>
      <div className="os-offer-grid">
        {offers.map((offer) => <CompactOfferCard key={offer.id} careerId={careerId} offer={offer} state={state} recordRevision={revision} safeOfferId={null} parentTeamName={null} />)}
      </div>
    </>
  );
}

function MarketOffers({
  careerId,
  state,
  revision,
  offers,
}: {
  careerId: string;
  state: CareerState;
  revision: number;
  offers: readonly Offer[];
}) {
  const pending = state.pending;
  const safeOfferId = pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT' ? pending.market.safeOfferId : null;
  const rejectAllKind: 'OFFERS' | 'CONTRACT' = pending?.kind === 'CONTRACT' ? 'CONTRACT' : 'OFFERS';
  const parentTeamName = state.contract?.teamName ?? state.clubHistory.at(-1)?.teamName ?? null;
  const showRecoveryNotice = shouldShowRecoveryOpportunityNotice(state, offers);
  const recoveryPolicy = rulesetForCareer(state).transferRules.recovery;
  const meetingReceipts = buildCareerFollowUpReceipts(state).filter((receipt) => receipt.kind === 'CLUB_MEETING');
  return (
    <>
      {meetingReceipts.length > 0 ? (
        <section className="os-panel flex flex-col gap-os-2" aria-labelledby="meeting-followup-title">
          <h2 id="meeting-followup-title" className="font-os font-semibold text-os-text" style={BODY_STYLE}>이 시장이 열린 이전 요청</h2>
          <CareerFollowUpReceipts receipts={meetingReceipts} limit={1} />
        </section>
      ) : null}
      <details className="os-panel">
        <summary className="cursor-pointer font-os font-semibold text-os-text">현재 계약과 시장 기준</summary>
        <div className="mt-os-3">
          <MarketSummary state={state} offers={offers} />
        </div>
      </details>
      {showRecoveryNotice && recoveryPolicy !== undefined ? (
        <Card className="font-os text-os-text-2" style={BODY_STYLE}>
          {recoveryOpportunityHeadline(recoveryPolicy.zeroMinutesConsecutiveSeasons)} 현재 계약 유지와
          하부리그 기회를 비교해 보세요. 역할 약속은 출전 보장이 아니며 경쟁 상황도 함께 확인하세요.
        </Card>
      ) : null}
      {offers.length === 0 ? (
        <EmptyState
          headingLevel={2}
          reason="현재 유효한 제안이 없습니다"
          action={
            <Link to="/career/$careerId" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
              허브로
            </Link>
          }
        />
      ) : (
        <>
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            결정 기한이 지난 제안은 자동으로 철회됩니다.
          </p>
          <div className="os-offer-grid">
            {offers.map((offer) => <CompactOfferCard key={offer.id} careerId={careerId} offer={offer} state={state} recordRevision={revision} safeOfferId={safeOfferId} parentTeamName={parentTeamName} />)}
          </div>
        </>
      )}
      {offers.length > 0 ? <RejectAllButton careerId={careerId} kind={rejectAllKind} /> : null}
    </>
  );
}

function OffersScreen() {
  const { careerId } = Route.useParams();
  const query = useCareer(careerId);

  useEffect(() => {
    if (query.data === undefined) return;
    const target: OffersTarget =
      screenForCareer(query.data.state).screenId === 'SCR-009' ? 'SCR-009' : 'SCR-017';
    platform.analytics.track('screen_viewed', { screenId: target, careerPhase: query.data.state.seasonPhase });
  }, [query.data?.record.revision, query.data?.state.pending?.kind]);

  if (query.data === undefined) return null;
  const { record, state } = query.data;
  const pending = state.pending;
  if (pending === null || (pending.kind !== 'OFFERS' && pending.kind !== 'CONTRACT')) return null;

  const offers = pending.offers;
  const firstContract = pending.market.reason === 'FIRST_CONTRACT';
  return (
    <div className="os-screen">
      {firstContract ? (
        <ScreenIntro
          eyebrow="새로운 유니폼"
          title={offersScreenTitle(true, offers.length)}
          description="리그의 높이만큼, 내가 뛸 수 있는 자리도 중요해요. 다음 팀의 조건을 살펴보세요."
        />
      ) : (
        <ScreenIntro
          eyebrow={MARKET_REASON_LABEL_KO[pending.market.reason]}
          title={offersScreenTitle(false, offers.length)}
          description={
            offers.length > 1
              ? '현재 계약과 시장 상황을 비교해 다음 소속을 결정하세요.'
              : '현재 계약과 시장 상황을 살펴보고 다음 소속을 결정하세요.'
          }
        />
      )}
      {offers.length > 1 ? (
        <p className="os-comparison-note">리그 · 역할 · 주급 · 계약 기간을 같은 순서로 비교하세요. 카드를 열면 협상 가능 여부와 전체 조건을 확인할 수 있습니다.</p>
      ) : null}
      {firstContract ? (
        <FirstContractOffers careerId={careerId} state={state} revision={record.revision} offers={offers} />
      ) : (
        <MarketOffers careerId={careerId} state={state} revision={record.revision} offers={offers} />
      )}
    </div>
  );
}
