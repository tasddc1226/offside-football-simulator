import { computeContractSeasonsRemaining, type CareerState, type Offer } from '@offside/domain';
import { buttonClassName, buttonStyle, TeamBadge } from '@offside/ui';
import { Link } from '@tanstack/react-router';
import { formatKrw } from './format.js';
import { LEAGUE_TIER_LABEL_KO, SQUAD_ROLE_LABELS } from './labels.js';
import { getTeamIdentity } from './team-identity.js';
import { actionableRevision, OFFER_KIND_LABEL_KO, offerDecisionDeadlineLabel, offerDetailRows, offerProjectionNotice, offerStatusLabel } from './transfer-view.js';

function signedDelta(value: number, current: number): string {
  const delta = value - current;
  if (delta === 0) return '현재와 같음';
  return `${delta > 0 ? '+' : '−'}${formatKrw(Math.abs(delta))}`;
}

export function offerHeadlineRows(offer: Offer, state: CareerState, recordRevision: number, safeOfferId: string | null) {
  const current = state.contract;
  const remaining = current === null ? null : computeContractSeasonsRemaining(current.lengthSeasons, current.signedAtRevision, state.timeline);
  const deadline = offerDecisionDeadlineLabel(offer, recordRevision);
  return [
    { label: '제안', value: `${OFFER_KIND_LABEL_KO[offer.kind]} · ${offerStatusLabel(offer, actionableRevision(recordRevision), safeOfferId)}` },
    { label: '리그', value: LEAGUE_TIER_LABEL_KO[offer.leagueTier] },
    {
      label: '역할 · 출전 약속',
      value: `${SQUAD_ROLE_LABELS[offer.rolePromise]} · ${Math.round(offer.appearancePromise.minutesShareBp / 100)}%`,
    },
    {
      label: '주급',
      value: formatKrw(offer.wageMinorPerWeek),
      delta: current === null ? '첫 프로 계약' : signedDelta(offer.wageMinorPerWeek, current.wageMinorPerWeek),
    },
    {
      label: '기간',
      value: `${offer.lengthSeasons}시즌`,
      delta:
        current === null
          ? '첫 프로 계약'
          : offer.lengthSeasons === (remaining ?? 0)
            ? '현재와 같음'
            : `남은 ${remaining ?? 0}시즌 대비 ${offer.lengthSeasons > (remaining ?? 0) ? '+' : '−'}${Math.abs(offer.lengthSeasons - (remaining ?? 0))}시즌`,
    },
    { label: '결정 기한', value: deadline },
  ];
}

export function CompactOfferCard({
  careerId,
  offer,
  state,
  recordRevision,
  safeOfferId,
  parentTeamName,
}: {
  careerId: string;
  offer: Offer;
  state: CareerState;
  recordRevision: number;
  safeOfferId: string | null;
  parentTeamName: string | null;
}) {
  const identity = getTeamIdentity(offer.teamId);
  const headline = offerHeadlineRows(offer, state, recordRevision, safeOfferId);
  const headlineLabels = new Set(headline.map((row) => row.label));
  const details = offerDetailRows(offer, recordRevision, safeOfferId, parentTeamName).filter(
    (row) => !headlineLabels.has(row.label) && row.label !== '제안 종류' && row.label !== '상태' && row.label !== '유효 기간',
  );
  const pending = state.pending;
  const projectionNotice =
    pending !== null && (pending.kind === 'OFFERS' || pending.kind === 'CONTRACT')
      ? offerProjectionNotice(state.rulesetVersion, pending.market.reason)
      : null;
  return (
    <article className="os-panel flex flex-col gap-os-4" aria-labelledby={`offer-${offer.id}`}>
      <div>
        <p className="os-eyebrow">{OFFER_KIND_LABEL_KO[offer.kind]}</p>
        <h2 id={`offer-${offer.id}`} className="os-section-title flex items-center gap-os-2">
          <TeamBadge initials={identity.initials} colorVar={identity.colorVar} size="m" />
          {offer.teamName}
        </h2>
      </div>
      <dl className="grid grid-cols-2 gap-os-3">
        {headline.map((row) => (
          <div key={row.label} className="flex flex-col gap-os-1">
            <dt className="os-eyebrow">{row.label}</dt>
            <dd className="font-os font-semibold text-os-text">{row.value}</dd>
            {'delta' in row ? <span className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)' }}>{row.delta}</span> : null}
          </div>
        ))}
      </dl>
      <details>
        <summary className="cursor-pointer font-os font-semibold text-os-text">나머지 조건 {details.length}개</summary>
        <dl className="mt-os-2 grid grid-cols-2 gap-os-2 font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
          {details.map((row) => <div key={row.label}><dt>{row.label}</dt><dd className="text-os-text">{row.value}</dd></div>)}
        </dl>
      </details>
      {projectionNotice ? <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>{projectionNotice}</p> : null}
      <Link to="/career/$careerId/contract" params={{ careerId }} search={{ offerId: offer.id }} className={buttonClassName('primary', 'w-full justify-center')} style={buttonStyle}>
        제안 상세·결정
      </Link>
    </article>
  );
}
