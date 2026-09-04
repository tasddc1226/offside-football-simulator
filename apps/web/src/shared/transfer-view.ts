// T-3-005: domain Offer를 화면에서 읽을 수 있는 공개 값으로만 투영한다.
// id·bp·truePotential·내부 시장가치는 이 모듈을 통해 화면에 노출하지 않는다.
import {
  computeContractSeasonsRemaining,
  type CareerState,
  type DomainSnapshot,
  type NegotiationAsk,
  type Offer,
} from '@offside/domain';
import type { CompareRow } from '@offside/ui';
import { formatKrw } from './format.js';
import { LEAGUE_TIER_LABEL_KO, POSITION_LABELS, SQUAD_ROLE_LABELS } from './labels.js';

export const OFFER_KIND_LABEL_KO: Record<Offer['kind'], string> = {
  RENEWAL: '재계약',
  TRANSFER: '완전 이적',
  LOAN: '임대',
  FREE_AGENT: '자유계약',
};

export const MARKET_REASON_LABEL_KO: Record<
  'FIRST_CONTRACT' | 'EXPIRED' | 'INTEREST' | 'LOAN_END' | 'PRE_NEGOTIATION',
  string
> = {
  FIRST_CONTRACT: '첫 프로 계약',
  EXPIRED: '계약 만료',
  INTEREST: '타 구단 관심',
  LOAN_END: '임대 종료',
  PRE_NEGOTIATION: '재계약 사전 협상',
};

export type CurrentContractSummary = { label: string; value: string };

/** 현재 계약 ID와 시즌 구간이 모두 일치하는 결산만 현재 계약의 이행으로 센다. */
function isSeasonInCurrentContract(state: CareerState, contract: NonNullable<CareerState['contract']>, seasonIndex: number): boolean {
  // 갱신은 기존 열린 stint의 contractId만 새 계약 ID로 바꾸므로, stint의 시작보다
  // 늦은 signedSeasonIndex를 함께 적용해야 갱신 전 시즌을 새 계약에 섞지 않는다.
  if (seasonIndex < contract.signedSeasonIndex) return false;
  const contractStints = state.clubHistory.filter((stint) => stint.contractId === contract.id);
  return contractStints.some(
    (stint) => seasonIndex >= stint.fromSeasonIndex && (stint.toSeasonIndex === null || seasonIndex <= stint.toSeasonIndex),
  );
}

/** SCR-017 상단·SCR-029 휴대폰이 공유하는 현재 계약 공개 요약. */
export function buildCurrentContractSummary(state: CareerState): CurrentContractSummary[] {
  const contract = state.contract;
  if (contract === null) return [];
  const fulfilledPromises = state.seasonHistory.filter(
    (summary) => isSeasonInCurrentContract(state, contract, summary.index) && summary.result.promiseFulfilment.fulfilled,
  ).length;
  return [
    // SCR-029 휴대폰의 기존 "팀"·"기간" 문구를 유지한다. SCR-017은 값의 의미로 현재
    // 계약을 설명하므로 별도 raw enum/내부 id 없이 같은 view-model을 재사용한다.
    { label: '팀', value: contract.teamName },
    { label: '리그', value: LEAGUE_TIER_LABEL_KO[contract.leagueTier] },
    { label: '기간', value: `${contract.lengthSeasons}시즌` },
    { label: '현재 역할', value: SQUAD_ROLE_LABELS[contract.rolePromise] },
    {
      label: '남은 계약',
      value: `${computeContractSeasonsRemaining(contract.lengthSeasons, contract.signedAtRevision, state.timeline)}시즌`,
    },
    { label: '현재 주급', value: formatKrw(contract.wageMinorPerWeek) },
    { label: '출전 약속 이행/위반', value: `이행 ${fulfilledPromises}회 · 위반 ${contract.promiseBreaches}회` },
  ];
}

export type OfferStatus = 'OPEN' | 'COUNTERED' | 'WITHDRAWN' | 'EXPIRED';

/**
 * A market command first expires offers at the command's next snapshot revision.
 * Keep this derivation in the web adapter so a screen never falls back to
 * currentStep (which is a season position, not a persisted revision).
 */
export function actionableRevision(recordRevision: number): number {
  return recordRevision + 1;
}

const NEGOTIATION_KEYS: Record<NegotiationAsk, keyof Offer['negotiable']> = {
  WAGE: 'wage',
  ROLE: 'role',
  LENGTH: 'length',
};

/** domain의 대문자 ask와 Offer의 소문자 negotiable 키를 명시적으로 연결한다. */
export function negotiationKey(ask: NegotiationAsk): keyof Offer['negotiable'] {
  return NEGOTIATION_KEYS[ask];
}

export function offerStatus(offer: Offer, revision: number): OfferStatus {
  if (offer.negotiationState === 'WITHDRAWN') return 'WITHDRAWN';
  if (offer.validUntilRevision !== null && revision > offer.validUntilRevision) return 'EXPIRED';
  if (offer.negotiationState === 'COUNTERED') return 'COUNTERED';
  return 'OPEN';
}

export function offerStatusLabel(offer: Offer, revision: number, safeOfferId: string | null): string {
  const status = offerStatus(offer, revision);
  if (status === 'WITHDRAWN') return '철회됨';
  if (status === 'EXPIRED') return '만료됨';
  if (status === 'COUNTERED') return '협상된 제안';
  return offer.id === safeOfferId ? '안전 잔류 제안' : '검토 중';
}

/**
 * `recordRevision` is the persisted snapshot revision. The command will be
 * applied at its next revision, where domain `prepareMarketOffers` expires
 * offers before looking up the requested offer.
 */
export function canNegotiateOffer(offer: Offer, recordRevision: number, ask: NegotiationAsk): boolean {
  return offerStatus(offer, actionableRevision(recordRevision)) === 'OPEN' && offer.negotiable[negotiationKey(ask)];
}

export function canAcceptOffer(offer: Offer, recordRevision: number): boolean {
  const status = offerStatus(offer, actionableRevision(recordRevision));
  return status === 'OPEN' || status === 'COUNTERED';
}

function formatOptionalKrw(value: number | null): string {
  return value === null ? '—' : formatKrw(value);
}

function formatMinutesShare(bp: number): string {
  return `${Math.round(bp / 100)}%`;
}

function formatOfferValidity(offer: Offer, recordRevision: number, actionRevision: number): string {
  if (offer.validUntilRevision === null) return '제한 없음';
  if (recordRevision <= offer.validUntilRevision && actionRevision > offer.validUntilRevision) {
    return `현재 revision ${recordRevision}까지 유효 · 다음 결정에서 만료`;
  }
  if (recordRevision > offer.validUntilRevision) return '만료됨';
  return `revision ${offer.validUntilRevision}까지`;
}

type NegotiationOutcome = 'COUNTERED' | 'WITHDRAWN';

export type NegotiationResultView = {
  offerId: string;
  teamName: string;
  ask: NegotiationAsk;
  askLabel: string;
  outcome: NegotiationOutcome;
  before: string;
  after: string;
  reason: string;
  remainingOffers: Array<{ id: string; teamName: string; kind: string }>;
};

const ASK_LABELS: Record<NegotiationAsk, string> = { WAGE: '주급', ROLE: '역할', LENGTH: '기간' };

function negotiationValue(offer: Offer, ask: NegotiationAsk): string {
  switch (ask) {
    case 'WAGE':
      return formatKrw(offer.wageMinorPerWeek);
    case 'ROLE':
      return SQUAD_ROLE_LABELS[offer.rolePromise];
    case 'LENGTH':
      return `${offer.lengthSeasons}시즌`;
  }
}

function parseNegotiationRef(refId: string | null): { offerId: string; ask: NegotiationAsk; outcome: NegotiationOutcome } | null {
  if (refId === null) return null;
  const [offerId, ask, outcome] = refId.split(':');
  if (
    offerId === undefined ||
    (ask !== 'WAGE' && ask !== 'ROLE' && ask !== 'LENGTH') ||
    (outcome !== 'COUNTERED' && outcome !== 'WITHDRAWN')
  ) {
    return null;
  }
  return { offerId, ask, outcome };
}

/**
 * Reconstructs the user-visible negotiation result from the command-before
 * offer and the persisted snapshot's NEGOTIATED refId. A failed roll is still
 * an `ok: true` domain transition with `WITHDRAWN`; no client-only state is
 * invented here.
 */
export function buildNegotiationResultView(
  beforeOffer: Offer,
  snapshot: Pick<DomainSnapshot, 'revision' | 'state'>,
): NegotiationResultView | null {
  const entry = [...snapshot.state.timeline]
    .reverse()
    .find((candidate) => candidate.kind === 'NEGOTIATED' && candidate.revision === snapshot.revision && candidate.refId?.startsWith(`${beforeOffer.id}:`));
  const parsed = parseNegotiationRef(entry?.refId ?? null);
  if (parsed === null || parsed.offerId !== beforeOffer.id) return null;

  const nextPending = snapshot.state.pending;
  const afterOffer =
    nextPending?.kind === 'OFFERS' || nextPending?.kind === 'CONTRACT'
      ? nextPending.offers.find((candidate) => candidate.id === beforeOffer.id)
      : undefined;
  if (parsed.outcome === 'COUNTERED' && afterOffer === undefined) return null;

  const remainingOffers =
    nextPending?.kind === 'OFFERS' || nextPending?.kind === 'CONTRACT'
      ? nextPending.offers
          .filter((candidate) => candidate.id !== beforeOffer.id)
          .map((candidate) => ({ id: candidate.id, teamName: candidate.teamName, kind: OFFER_KIND_LABEL_KO[candidate.kind] }))
      : [];

  return {
    offerId: beforeOffer.id,
    teamName: beforeOffer.teamName,
    ask: parsed.ask,
    askLabel: ASK_LABELS[parsed.ask],
    outcome: parsed.outcome,
    before: negotiationValue(beforeOffer, parsed.ask),
    after: afterOffer === undefined ? '—' : negotiationValue(afterOffer, parsed.ask),
    reason:
      parsed.outcome === 'COUNTERED'
        ? `${ASK_LABELS[parsed.ask]} 조건이 조정되어 협상된 제안으로 저장되었습니다.`
        : `${ASK_LABELS[parsed.ask]} 협상 요청이 수용되지 않아 ${beforeOffer.teamName} 제안이 철회되었습니다.`,
    remainingOffers,
  };
}

function formatCompetitorSummary(offer: Offer): string {
  if (offer.competitorSummary === null) return '—';
  const gap = offer.competitorSummary.ovrGap > 0 ? `+${offer.competitorSummary.ovrGap}` : String(offer.competitorSummary.ovrGap);
  return `${offer.competitorSummary.rank}위 · OVR ${gap}`;
}

function formatLoan(offer: Offer, parentTeamName: string | null): string {
  if (offer.loan === null) return '—';
  const buy = offer.loan.buyOptionMinor === null ? '매입 옵션 없음' : `매입 ${formatKrw(offer.loan.buyOptionMinor)}`;
  return `${parentTeamName ?? '원소속'}에서 ${offer.loan.seasons}시즌 · 임금 ${formatMinutesShare(offer.loan.wageShareBp)} · ${buy}`;
}

function cellsFor<T>(offers: readonly Offer[], value: (offer: Offer) => T, render: (value: T) => string = String) {
  const values = offers.map((offer) => render(value(offer)));
  const distinct = new Set(values);
  return values.map((text) => ({ value: text, highlighted: distinct.size > 1 && text !== '—' }));
}

/** CompareCards의 모바일 stack·데스크톱 grid 양쪽에 동일하게 쓰는 비교 행. */
export function buildOfferRows(
  offers: readonly Offer[],
  recordRevision: number,
  safeOfferId: string | null,
  parentTeamName: string | null = null,
): CompareRow[] {
  const revision = actionableRevision(recordRevision);
  return [
    { id: 'kind', label: '제안 종류', cells: cellsFor(offers, (offer) => OFFER_KIND_LABEL_KO[offer.kind]) },
    { id: 'status', label: '상태', cells: cellsFor(offers, (offer) => offerStatusLabel(offer, revision, safeOfferId)) },
    { id: 'team', label: '팀', cells: cellsFor(offers, (offer) => offer.teamName) },
    { id: 'league', label: '리그', cells: cellsFor(offers, (offer) => LEAGUE_TIER_LABEL_KO[offer.leagueTier]) },
    { id: 'length', label: '기간', cells: cellsFor(offers, (offer) => `${offer.lengthSeasons}시즌`) },
    { id: 'wage', label: '주급', cells: cellsFor(offers, (offer) => formatKrw(offer.wageMinorPerWeek)) },
    { id: 'bonus', label: '계약금', cells: cellsFor(offers, (offer) => formatKrw(offer.signingBonusMinor)) },
    { id: 'transferFee', label: '이적료', cells: cellsFor(offers, (offer) => formatOptionalKrw(offer.transferFeeMinor)) },
    { id: 'role', label: '역할 약속', cells: cellsFor(offers, (offer) => SQUAD_ROLE_LABELS[offer.rolePromise]) },
    { id: 'appearance', label: '출전 약속', cells: cellsFor(offers, (offer) => formatMinutesShare(offer.appearancePromise.minutesShareBp)) },
    { id: 'position', label: '포지션 계획', cells: cellsFor(offers, (offer) => POSITION_LABELS[offer.positionPlan]) },
    { id: 'fit', label: '전술 적합도', cells: cellsFor(offers, (offer) => String(offer.tacticalFitEstimate)) },
    { id: 'competitor', label: '경쟁자 요약', cells: cellsFor(offers, formatCompetitorSummary) },
    {
      id: 'validity',
      label: '유효 기간',
      cells: cellsFor(offers, (offer) => formatOfferValidity(offer, recordRevision, revision)),
    },
    { id: 'loan', label: '임대 조건', cells: cellsFor(offers, (offer) => formatLoan(offer, parentTeamName)) },
  ];
}

export function offerDetailRows(
  offer: Offer,
  recordRevision: number,
  safeOfferId: string | null,
  parentTeamName: string | null = null,
): Array<{ label: string; value: string }> {
  const revision = actionableRevision(recordRevision);
  return [
    { label: '제안 종류', value: OFFER_KIND_LABEL_KO[offer.kind] },
    { label: '상태', value: offerStatusLabel(offer, revision, safeOfferId) },
    { label: '리그', value: LEAGUE_TIER_LABEL_KO[offer.leagueTier] },
    { label: '기간', value: `${offer.lengthSeasons}시즌` },
    { label: '주급', value: formatKrw(offer.wageMinorPerWeek) },
    { label: '계약금', value: formatKrw(offer.signingBonusMinor) },
    { label: '이적료', value: formatOptionalKrw(offer.transferFeeMinor) },
    { label: '역할 약속', value: SQUAD_ROLE_LABELS[offer.rolePromise] },
    { label: '출전 약속', value: formatMinutesShare(offer.appearancePromise.minutesShareBp) },
    { label: '포지션 계획', value: POSITION_LABELS[offer.positionPlan] },
    { label: '전술 적합도', value: String(offer.tacticalFitEstimate) },
    { label: '경쟁자 요약', value: formatCompetitorSummary(offer) },
    { label: '유효 기간', value: formatOfferValidity(offer, recordRevision, revision) },
    { label: '임대 조건', value: formatLoan(offer, parentTeamName) },
  ];
}
