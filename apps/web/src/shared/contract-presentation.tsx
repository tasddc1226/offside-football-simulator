import { computeContractSeasonsRemaining, type CareerState, type Offer } from '@offside/domain';
import { buttonClassName, buttonStyle } from '@offside/ui';
import { Link } from '@tanstack/react-router';
import { ClubBadge } from './ClubBadge.js';
import { formatKrw } from './format.js';
import { LEAGUE_TIER_LABEL_KO, SQUAD_ROLE_LABELS } from './labels.js';
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
    // 이슈 188: "완전 이적 · 안전 잔류 제안"처럼 한 값으로 붙이면 360px 2열 그리드에서 카드마다
    // 다르게 감겨 카드 높이가 어긋났다. 종류는 값, 상태는 주급·기간 행과 같은 보조 줄(delta)로
    // 내려 모든 카드의 헤드라인 행 높이를 같게 맞춘다.
    {
      label: '제안',
      value: OFFER_KIND_LABEL_KO[offer.kind],
      delta: offerStatusLabel(offer, actionableRevision(recordRevision), safeOfferId),
    },
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
          <ClubBadge teamId={offer.teamId} size="m" />
          {offer.teamName}
        </h2>
      </div>
      <dl className="grid grid-cols-2 gap-os-3">
        {headline.map((row) => (
          <div key={row.label} className="flex flex-col gap-os-1">
            <dt className="os-eyebrow">{row.label}</dt>
            <dd className="flex flex-col gap-os-1">
              <span className="font-os font-semibold text-os-text">{row.value}</span>
              {'delta' in row ? <span className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)' }}>{row.delta}</span> : null}
            </dd>
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
