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
    <div className="grid grid-cols-1 gap-os-3 md:grid-cols-2">
      {offers.map((offer) => <CompactOfferCard key={offer.id} careerId={careerId} offer={offer} state={state} recordRevision={revision} safeOfferId={null} parentTeamName={null} />)}
    </div>
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
  return (
    <>
      <Card className="flex flex-col gap-os-3">
        <h2 className="font-os font-semibold text-os-text" style={BODY_STYLE}>
          현재 계약
        </h2>
        <MarketSummary state={state} offers={offers} />
      </Card>
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
        <div className="grid grid-cols-1 gap-os-3 md:grid-cols-2">
          {offers.map((offer) => <CompactOfferCard key={offer.id} careerId={careerId} offer={offer} state={state} recordRevision={revision} safeOfferId={safeOfferId} parentTeamName={parentTeamName} />)}
        </div>
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
          title="제안 비교"
          description="리그의 높이만큼, 내가 뛸 수 있는 자리도 중요해요. 다음 팀의 조건을 살펴보세요."
        />
      ) : (
        <ScreenIntro
          eyebrow={MARKET_REASON_LABEL_KO[pending.market.reason]}
          title="이적시장 제안 비교"
          description="현재 계약과 시장 상황을 비교해 다음 소속을 결정하세요."
        />
      )}
      {firstContract ? (
        <FirstContractOffers careerId={careerId} state={state} revision={record.revision} offers={offers} />
      ) : (
        <MarketOffers careerId={careerId} state={state} revision={record.revision} offers={offers} />
      )}
    </div>
  );
}
