// SCR-009 첫 프로 제안 결과. 제안별 핵심 조건을 모바일 카드로 비교하고 추가 조건은 펼쳐본다.
// "경쟁자 수"는 도메인에 없어 표시하지 않는다.
import { buttonClassName, buttonStyle, EmptyState, ScreenIntro } from '@offside/ui';
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

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

const ROLE_PROMISE_RANK: Record<SquadRole, number> = {
  STARTER: 0,
  ROTATION: 1,
  BENCH: 2,
  RESERVE: 3,
};

function leagueRank(tier: Offer['leagueTier']): number {
  return tier === 'YOUTH' ? 4 : tier;
}

function computeBadges(offer: Offer, offers: Offer[]): string {
  const badges: string[] = [];
  const bestLeagueRank = Math.min(...offers.map((candidate) => leagueRank(candidate.leagueTier)));
  if (leagueRank(offer.leagueTier) === bestLeagueRank) badges.push('가장 높은 리그');
  const bestRoleRank = Math.min(
    ...offers.map((candidate) => ROLE_PROMISE_RANK[candidate.rolePromise]),
  );
  if (ROLE_PROMISE_RANK[offer.rolePromise] === bestRoleRank) badges.push('출전 기회 높음');
  return badges.length > 0 ? badges.join(' · ') : '—';
}

function ViewOfferLink({ careerId, offerId }: { careerId: string; offerId: string }) {
  return (
    <Link
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

function OfferCard({
  careerId,
  offer,
  offers,
}: {
  careerId: string;
  offer: Offer;
  offers: Offer[];
}) {
  const badges = computeBadges(offer, offers);
  return (
    <article className="os-panel flex flex-col gap-os-4" aria-labelledby={`offer-${offer.id}`}>
      <div className="flex items-start justify-between gap-os-3">
        <div className="min-w-0 flex flex-col gap-os-2">
          <p className="os-eyebrow">{LEAGUE_TIER_LABEL_KO[offer.leagueTier]}</p>
          <h2 id={`offer-${offer.id}`} className="font-os font-bold text-os-text" style={H2_STYLE}>
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
      {offers.length > 1 && badges !== '—' ? (
        <p className="font-os font-semibold text-os-accent" style={CAPTION_STYLE}>
          {badges}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-os-4 font-os text-os-text-2" style={CAPTION_STYLE}>
        <div className="flex flex-col gap-os-1">
          <dt>주급</dt>
          <dd className="os-num font-semibold text-os-text">{formatKrw(offer.wageMinorPerWeek)}</dd>
        </div>
        <div className="flex flex-col gap-os-1">
          <dt>기간</dt>
          <dd className="os-num font-semibold text-os-text">{offer.lengthSeasons}시즌</dd>
        </div>
        <div className="flex flex-col gap-os-1">
          <dt>역할 약속</dt>
          <dd className="font-semibold text-os-text">{SQUAD_ROLE_LABELS[offer.rolePromise]}</dd>
        </div>
        <div className="flex flex-col gap-os-1">
          <dt>전술 적합도</dt>
          <dd className="os-num font-semibold text-os-text">{offer.tacticalFitEstimate}</dd>
        </div>
      </dl>
      <details className="border-t border-os-border pt-os-3">
        <summary className="cursor-pointer font-os text-os-text-2" style={CAPTION_STYLE}>
          계약 조건 자세히
        </summary>
        <dl className="mt-os-3 flex flex-col gap-os-2 font-os" style={CAPTION_STYLE}>
          <div className="flex items-baseline justify-between gap-os-3">
            <dt className="text-os-text-2">리그</dt>
            <dd>{LEAGUE_TIER_LABEL_KO[offer.leagueTier]}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-os-3">
            <dt className="text-os-text-2">계약금</dt>
            <dd className="os-num">{formatKrw(offer.signingBonusMinor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-os-3">
            <dt className="text-os-text-2">등번호</dt>
            <dd className="os-num">{offer.shirtNumber}</dd>
          </div>
        </dl>
      </details>
      <ViewOfferLink careerId={careerId} offerId={offer.id} />
    </article>
  );
}

function OffersScreen() {
  const { careerId } = Route.useParams();
  const query = useCareer(careerId);

  useEffect(() => {
    platform.analytics.track('screen_viewed', {
      screenId: 'SCR-009',
      careerPhase: query.data?.state.seasonPhase ?? 'NONE',
    });
    // 마운트 시 1회만(로더가 이미 캐시를 채웠다).
  }, []);

  if (query.data === undefined) return null;

  const { state } = query.data;
  const pending = state.pending;
  // T-3-003 §9: step 7 재계약 사전 협상(CONTRACT, 제안 있음)도 OFFERS와 같은 화면을 재사용한다.
  if (pending === null || (pending.kind !== 'OFFERS' && pending.kind !== 'CONTRACT')) return null;

  const offers = pending.offers;

  return (
    <div className="os-screen">
      <ScreenIntro
        eyebrow="새로운 유니폼"
        title="제안 비교"
        description="리그의 높이만큼, 내가 뛸 수 있는 자리도 중요해요. 다음 팀의 조건을 살펴보세요."
      />

      {offers.length === 0 ? (
        <EmptyState
          headingLevel={2}
          reason="제안이 없습니다"
          action={
            <Link to="/" className={buttonClassName('primary')} style={buttonStyle}>
              허브로
            </Link>
          }
        />
      ) : (
        <section className="flex flex-col gap-os-4" aria-label={`도착한 제안 ${offers.length}건`}>
          <div className="flex items-center justify-between gap-os-3">
            <h2 className="os-section-title">도착한 제안</h2>
            <span className="os-num font-semibold text-os-accent">{offers.length}건</span>
          </div>
          {offers.map((offer) => (
            <OfferCard key={offer.id} careerId={careerId} offer={offer} offers={offers} />
          ))}
        </section>
      )}
    </div>
  );
}
