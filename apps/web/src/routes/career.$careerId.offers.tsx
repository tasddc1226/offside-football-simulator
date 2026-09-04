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
  CompareCards,
  EmptyState,
  ErrorState,
  type CompareCardItem,
  type CompareRow,
} from '@offside/ui';
import { careerQueryOptions, useCareer, useCareerMutation } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { committedTransferRevision } from '../shared/transfer-result.js';
import { platform } from '../platform/index.js';
import { useCommittingExitGuard } from '../shared/use-committing-exit-guard.js';
import {
  buildOfferRows as buildMarketOfferRows,
  OFFER_KIND_LABEL_KO,
  MARKET_REASON_LABEL_KO,
} from '../shared/transfer-view.js';
import { LEAGUE_TIER_LABEL_KO, SQUAD_ROLE_LABELS } from '../shared/labels.js';
import { formatKrw } from '../shared/format.js';
import { buildCurrentContractSummary } from '../shared/transfer-view.js';

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

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

function ViewOfferLink({ careerId, offerId, layout, label = '이 제안 보기' }: { careerId: string; offerId: string; layout: string; label?: string }) {
  return (
    <Link
      key={`${offerId}-${layout}`}
      to="/career/$careerId/contract"
      params={{ careerId }}
      search={{ offerId }}
      className={buttonClassName('primary', 'w-full justify-center')}
      style={buttonStyle}
    >
      {label}
    </Link>
  );
}

function MarketSummary({ state, offers }: { state: CareerState; offers: readonly Offer[] }) {
  const pending = state.pending;
  if (pending === null || (pending.kind !== 'OFFERS' && pending.kind !== 'CONTRACT')) return null;
  const values = buildCurrentContractSummary(state);
  return (
    <div className="flex flex-col gap-os-3">
      <p className="font-os text-os-text-2" style={BODY_STYLE}>
        현재 계약과 시장 상황을 비교해 다음 소속을 결정하세요.
      </p>
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
    </div>
  );
}

function RejectAllButton({ careerId }: { careerId: string }) {
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

  return (
    <div className="flex flex-col gap-os-2">
      <Button variant="secondary" onClick={() => void handleRejectAll()} disabled={mutation.isPending}>
        제안 모두 거절하고 잔류
      </Button>
      {errorMessage ? <ErrorState message={errorMessage} onRetry={() => void refreshAfterResponseLoss()} retryLabel="저장 상태 다시 확인" /> : null}
    </div>
  );
}

function FirstContractOffers({
  careerId,
  offers,
}: {
  careerId: string;
  offers: readonly Offer[];
}) {
  function computeBadges(offer: Offer): string {
    const badges: string[] = [];
    const leagueRank = (tier: Offer['leagueTier']) => (tier === 'YOUTH' ? 4 : tier);
    const bestLeagueRank = Math.min(...offers.map((candidate) => leagueRank(candidate.leagueTier)));
    if (leagueRank(offer.leagueTier) === bestLeagueRank) badges.push('가장 높은 리그');
    const roleRank: Record<Offer['rolePromise'], number> = { STARTER: 0, ROTATION: 1, BENCH: 2, RESERVE: 3 };
    const bestRoleRank = Math.min(...offers.map((candidate) => roleRank[candidate.rolePromise]));
    if (roleRank[offer.rolePromise] === bestRoleRank) badges.push('출전 기회 높음');
    return badges.length > 0 ? badges.join(' · ') : '—';
  }

  function buildFirstContractRows(): CompareRow[] {
    return [
      { id: 'badge', label: '특징', cells: offers.map((offer) => ({ value: computeBadges(offer), highlighted: computeBadges(offer) !== '—' })) },
      { id: 'team', label: '팀', cells: offers.map((offer) => ({ value: offer.teamName })) },
      { id: 'league', label: '리그', cells: offers.map((offer) => ({ value: LEAGUE_TIER_LABEL_KO[offer.leagueTier] })) },
      { id: 'length', label: '기간', cells: offers.map((offer) => ({ value: `${offer.lengthSeasons}시즌` })) },
      { id: 'wage', label: '주급', cells: offers.map((offer) => ({ value: formatKrw(offer.wageMinorPerWeek) })) },
      { id: 'bonus', label: '계약금', cells: offers.map((offer) => ({ value: formatKrw(offer.signingBonusMinor) })) },
      { id: 'role', label: '역할 약속', cells: offers.map((offer) => ({ value: SQUAD_ROLE_LABELS[offer.rolePromise] })) },
      { id: 'shirt', label: '등번호', cells: offers.map((offer) => ({ value: String(offer.shirtNumber) })) },
      { id: 'fit', label: '전술 적합도', cells: offers.map((offer) => ({ value: String(offer.tacticalFitEstimate) })) },
    ];
  }

  return (
    <>
      <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
        제안 비교
      </h1>
      {offers.length === 0 ? (
        <EmptyState
          reason="제안이 없습니다"
          action={
            <Link to="/" className={buttonClassName('primary')} style={buttonStyle}>
              허브로
            </Link>
          }
        />
      ) : offers.length === 1 ? (
          <Card className="flex flex-col gap-os-3">
            <h2 className="font-os font-bold text-os-text" style={{ fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' }}>
              {offers[0]!.teamName}
            </h2>
            <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
              <div><dt>리그</dt><dd className="text-os-text">{LEAGUE_TIER_LABEL_KO[offers[0]!.leagueTier]}</dd></div>
              <div><dt>기간</dt><dd className="os-num text-os-text">{offers[0]!.lengthSeasons}시즌</dd></div>
              <div><dt>주급</dt><dd className="os-num text-os-text">{formatKrw(offers[0]!.wageMinorPerWeek)}</dd></div>
              <div><dt>계약금</dt><dd className="os-num text-os-text">{formatKrw(offers[0]!.signingBonusMinor)}</dd></div>
              <div><dt>역할 약속</dt><dd className="text-os-text">{SQUAD_ROLE_LABELS[offers[0]!.rolePromise]}</dd></div>
              <div><dt>등번호</dt><dd className="os-num text-os-text">{offers[0]!.shirtNumber}</dd></div>
              <div><dt>전술 적합도</dt><dd className="os-num text-os-text">{offers[0]!.tacticalFitEstimate}</dd></div>
            </dl>
            <Link to="/career/$careerId/contract" params={{ careerId }} search={{ offerId: offers[0]!.id }} className={buttonClassName('primary')} style={buttonStyle}>
              이 제안 보기
            </Link>
          </Card>
        ) : (
          <CompareCards
            cards={offers.map((offer): CompareCardItem => ({
              id: offer.id,
              title: offer.teamName,
              renderAction: (layout) => <ViewOfferLink careerId={careerId} offerId={offer.id} layout={layout} />,
            }))}
            rows={buildFirstContractRows()}
          />
        )}
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
  const parentTeamName = state.contract?.teamName ?? state.clubHistory.at(-1)?.teamName ?? null;
  return (
    <>
      <div className="flex flex-col gap-os-2">
        <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
          이적시장 제안 비교
        </h1>
        <MarketSummary state={state} offers={offers} />
      </div>
      {offers.length === 0 ? (
        <EmptyState
          reason="현재 유효한 제안이 없습니다"
          action={
            <Link to="/career/$careerId" params={{ careerId }} className={buttonClassName('primary')} style={buttonStyle}>
              허브로
            </Link>
          }
        />
      ) : (
        <CompareCards
          cards={offers.map((offer): CompareCardItem => ({
            id: offer.id,
            title: `${offer.teamName} · ${OFFER_KIND_LABEL_KO[offer.kind]}`,
            renderAction: (layout) => <ViewOfferLink careerId={careerId} offerId={offer.id} layout={layout} label="제안 상세·결정" />,
          }))}
          rows={buildMarketOfferRows(offers, revision, safeOfferId, parentTeamName)}
        />
      )}
      {offers.length > 0 ? <RejectAllButton careerId={careerId} /> : null}
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
    <div className="flex flex-col gap-os-6">
      {firstContract ? <FirstContractOffers careerId={careerId} offers={offers} /> : <MarketOffers careerId={careerId} state={state} revision={record.revision} offers={offers} />}
    </div>
  );
}
