// SCR-009 첫 프로 제안 결과. pending.offers 1개면 카드 하나, 2~3개면 CompareCards. "경쟁자 수"는
// 도메인에 없어 표시하지 않는다(PR 본문에 명시, 브리프 지시).
import { buttonClassName, buttonStyle, Card, CompareCards, EmptyState, type CompareCardItem, type CompareRow } from '@offside/ui';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import type { Offer, SquadRole } from '@offside/domain';
import { useEffect } from 'react';
import { careerQueryOptions, useCareer } from '../engine/use-career.js';
import { screenForCareer } from '../shared/career-route.js';
import { queryClient } from '../shared/query-client.js';
import { SCREEN_ROUTES } from '../routes.js';
import { LEAGUE_TIER_LABEL_KO, SQUAD_ROLE_LABELS } from '../shared/labels.js';
import { formatKrw } from '../shared/format.js';
import { platform } from '../platform/index.js';

export const Route = createFileRoute('/career/$careerId/offers')({
  loader: async ({ params }) => {
    const { state } = await queryClient.ensureQueryData(careerQueryOptions(params.careerId));
    const target = screenForCareer(state);
    if (target.screenId !== 'SCR-009') {
      throw redirect({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    }
  },
  component: OffersScreen,
});

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

const ROLE_PROMISE_RANK: Record<SquadRole, number> = { STARTER: 0, ROTATION: 1, BENCH: 2, RESERVE: 3 };

function leagueRank(tier: Offer['leagueTier']): number {
  return tier === 'YOUTH' ? 4 : tier;
}

function computeBadges(offer: Offer, offers: Offer[]): string {
  const badges: string[] = [];
  const bestLeagueRank = Math.min(...offers.map((candidate) => leagueRank(candidate.leagueTier)));
  if (leagueRank(offer.leagueTier) === bestLeagueRank) badges.push('가장 높은 리그');
  const bestRoleRank = Math.min(...offers.map((candidate) => ROLE_PROMISE_RANK[candidate.rolePromise]));
  if (ROLE_PROMISE_RANK[offer.rolePromise] === bestRoleRank) badges.push('출전 기회 높음');
  return badges.length > 0 ? badges.join(' · ') : '—';
}

function buildOfferRows(offers: Offer[]): CompareRow[] {
  return [
    { id: 'badge', label: '특징', cells: offers.map((offer) => ({ value: computeBadges(offer, offers), highlighted: computeBadges(offer, offers) !== '—' })) },
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

function ViewOfferLink({ careerId, offerId, layout }: { careerId: string; offerId: string; layout?: string }) {
  return (
    <Link
      key={layout}
      to="/career/$careerId/contract"
      params={{ careerId }}
      search={{ offerId }}
      className={buttonClassName('primary', 'w-full justify-center')}
      style={buttonStyle}
    >
      이 제안 보기
    </Link>
  );
}

function OffersScreen() {
  const { careerId } = Route.useParams();
  const query = useCareer(careerId);

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-009', careerPhase: query.data?.state.seasonPhase ?? 'NONE' });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.data === undefined) return null;

  const { state } = query.data;
  const pending = state.pending;
  // T-3-003 §9: step 7 재계약 사전 협상(CONTRACT, 제안 있음)도 OFFERS와 같은 화면을 재사용한다.
  if (pending === null || (pending.kind !== 'OFFERS' && pending.kind !== 'CONTRACT')) return null;

  const offers = pending.offers;

  return (
    <div className="flex flex-col gap-os-6">
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
          <h2 className="font-os font-bold text-os-text" style={H2_STYLE}>
            {offers[0]!.teamName}
          </h2>
          <dl className="grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
            <div>
              <dt>리그</dt>
              <dd className="text-os-text">{LEAGUE_TIER_LABEL_KO[offers[0]!.leagueTier]}</dd>
            </div>
            <div>
              <dt>기간</dt>
              <dd className="os-num text-os-text">{offers[0]!.lengthSeasons}시즌</dd>
            </div>
            <div>
              <dt>주급</dt>
              <dd className="os-num text-os-text">{formatKrw(offers[0]!.wageMinorPerWeek)}</dd>
            </div>
            <div>
              <dt>계약금</dt>
              <dd className="os-num text-os-text">{formatKrw(offers[0]!.signingBonusMinor)}</dd>
            </div>
            <div>
              <dt>역할 약속</dt>
              <dd className="text-os-text">{SQUAD_ROLE_LABELS[offers[0]!.rolePromise]}</dd>
            </div>
            <div>
              <dt>등번호</dt>
              <dd className="os-num text-os-text">{offers[0]!.shirtNumber}</dd>
            </div>
            <div>
              <dt>전술 적합도</dt>
              <dd className="os-num text-os-text">{offers[0]!.tacticalFitEstimate}</dd>
            </div>
          </dl>
          <Link
            to="/career/$careerId/contract"
            params={{ careerId }}
            search={{ offerId: offers[0]!.id }}
            className={buttonClassName('primary')}
            style={buttonStyle}
          >
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
          rows={buildOfferRows(offers)}
        />
      )}
    </div>
  );
}
