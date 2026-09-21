import { computeContractSeasonsRemaining, type CareerState, type Offer } from '@offside/domain';
import { buttonClassName, buttonStyle } from '@offside/ui';
import { Link } from '@tanstack/react-router';
import { ClubBadge } from './ClubBadge.js';
import { formatKrw } from './format.js';
import { ScoreScale, managerTrustScore, tacticalFitScore } from './qualitative-scale.js';
import {
  LEAGUE_TIER_LABEL_KO,
  POSITION_LABELS,
  ROLE_PROMISE_SENTENCE,
  SQUAD_ROLE_LABELS,
} from './labels.js';
import {
  actionableRevision,
  OFFER_KIND_LABEL_KO,
  offerDecisionDeadlineLabel,
  offerDetailRows,
  offerProjectionNotice,
  offerStatusLabel,
} from './transfer-view.js';

function signedDelta(value: number, current: number): string {
  const delta = value - current;
  if (delta === 0) return '현재와 같음';
  return `${delta > 0 ? '+' : '−'}${formatKrw(Math.abs(delta))}`;
}

/**
 * 첫 계약 화면(SCR-009) 제안 카드 위 "왜 이 팀이 제안했나" 한 줄. offer.positionPlan·rolePromise·
 * leagueTier를 조합한 표시 전용 문구다(도메인 계산 없음, 새 값 파생 없음 — 기존 필드를 문장으로
 * 풀어 쓸 뿐). 스카우트 평가 뒤 도착한 제안이라는 맥락을 이어준다.
 */
export function offerRationale(offer: Offer): string {
  return `${offer.leagueName ?? LEAGUE_TIER_LABEL_KO[offer.leagueTier]} ${offer.teamName}이(가) ${POSITION_LABELS[offer.positionPlan]} 자리를 보고 제안했습니다. ${ROLE_PROMISE_SENTENCE[offer.rolePromise]}`;
}

export function offerHeadlineRows(
  offer: Offer,
  state: CareerState,
  recordRevision: number,
  safeOfferId: string | null,
) {
  const current = state.contract;
  const remaining =
    current === null
      ? null
      : computeContractSeasonsRemaining(
          current.lengthSeasons,
          current.signedAtRevision,
          state.timeline,
        );
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
    { label: '리그', value: offer.leagueName ?? LEAGUE_TIER_LABEL_KO[offer.leagueTier] },
    {
      label: '역할 · 출전 약속',
      value: `${SQUAD_ROLE_LABELS[offer.rolePromise]} · ${Math.round(offer.appearancePromise.minutesShareBp / 100)}%`,
    },
    {
      label: '주급',
      value: formatKrw(offer.wageMinorPerWeek),
      delta:
        current === null
          ? '첫 프로 계약'
          : signedDelta(offer.wageMinorPerWeek, current.wageMinorPerWeek),
    },
    {
      label: '기간',
      value: `${offer.lengthSeasons}시즌`,
      delta:
        current === null
          ? '첫 프로 계약'
          : remaining === 0
            ? `현재 계약의 마지막 시즌 · 갱신 +${offer.lengthSeasons}시즌`
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
    (row) =>
      !headlineLabels.has(row.label) &&
      row.label !== '제안 종류' &&
      row.label !== '상태' &&
      row.label !== '유효 기간',
  );
  const tacticalFit = details.find((row) => row.label === '전술 적합도');
  const remainingDetails = details.filter((row) => row.label !== '전술 적합도');
  const pending = state.pending;
  const projectionNotice =
    pending !== null && (pending.kind === 'OFFERS' || pending.kind === 'CONTRACT')
      ? offerProjectionNotice(state.rulesetVersion, pending.market.reason)
      : null;
  const isFirstContractOffer =
    pending !== null &&
    (pending.kind === 'OFFERS' || pending.kind === 'CONTRACT') &&
    pending.market.reason === 'FIRST_CONTRACT';
  return (
    <article className="os-panel flex flex-col gap-os-4" aria-labelledby={`offer-${offer.id}`}>
      <div>
        <p className="os-eyebrow">{OFFER_KIND_LABEL_KO[offer.kind]}</p>
        <h2 id={`offer-${offer.id}`} className="os-section-title flex items-center gap-os-2">
          <ClubBadge teamId={offer.teamId} size="m" />
          {offer.teamName}
        </h2>
        {isFirstContractOffer ? (
          <p
            className="font-os text-os-text-2"
            style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
          >
            {offerRationale(offer)}
          </p>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-os-3">
        {headline.map((row) => (
          <div key={row.label} className="flex flex-col gap-os-1">
            <dt className="os-eyebrow">{row.label}</dt>
            <dd className="flex flex-col gap-os-1">
              <span className="font-os font-semibold text-os-text">{row.value}</span>
              {'delta' in row ? (
                <span
                  className="font-os text-os-text-2"
                  style={{ fontSize: 'var(--os-fs-caption)' }}
                >
                  {row.delta}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <details>
        <summary className="cursor-pointer font-os font-semibold text-os-text">
          나머지 조건 {remainingDetails.length}개
        </summary>
        <dl
          className="mt-os-2 grid grid-cols-2 gap-os-2 font-os text-os-text-2"
          style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
        >
          {remainingDetails.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd className="text-os-text">{row.value}</dd>
            </div>
          ))}
        </dl>
      </details>
      {tacticalFit !== undefined ? (
        <ScoreScale label="전술 적합도" score={tacticalFitScore(Number(tacticalFit.value))} />
      ) : null}
      {state.contract !== null ? (
        <ScoreScale
          label="현재 감독 신뢰"
          score={managerTrustScore(state.relationships.managerTrust)}
        >
          <span className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)' }}>
            현재 소속 감독과의 관계 점수입니다. 새 제안의 성공 확률을 뜻하지 않습니다.
          </span>
        </ScoreScale>
      ) : null}
      {projectionNotice ? (
        <p
          className="font-os text-os-text-2"
          style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
        >
          {projectionNotice}
        </p>
      ) : null}
      <Link
        to="/career/$careerId/contract"
        params={{ careerId }}
        search={{ offerId: offer.id }}
        className={buttonClassName('primary', 'w-full justify-center')}
        style={buttonStyle}
      >
        제안 상세·결정
      </Link>
    </article>
  );
}
