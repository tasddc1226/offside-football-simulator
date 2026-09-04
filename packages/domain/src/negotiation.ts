import type { Offer } from './types.js';

/**
 * T-3-001 D-44: 제안 상태기계의 순수 함수 모음(rng 소비 없음). 저장 상태에는 `negotiationState`·
 * `validUntilRevision`만 두고 GENERATED/OFFERED/ACCEPTED/REJECTED/EXPIRED는 pending 목록 존재
 * 여부·타임라인으로 표현한다(phase-03 상태기계를 저장 필드로 중복하지 않는다). T-3-003이 이 함수들을
 * 명령 처리기(NEGOTIATE·REJECT_OFFER·ADVANCE)에서 부른다 — 이 작업에서는 아무 처리기도 부르지 않는다.
 */

/**
 * `validUntilRevision === null`(안전 잔류 제안 포함)은 절대 만료되지 않는다. 경계는
 * `validUntilRevision === revision`을 유효로 취급한다(그 revision까지는 아직 유효, 다음 revision부터
 * 만료 — `> validUntilRevision`일 때만 만료로 고정).
 */
export function isOfferExpired(offer: Offer, revision: number): boolean {
  return offer.validUntilRevision !== null && revision > offer.validUntilRevision;
}

/** `OPEN`이고 `negotiable`의 항목(wage·role·length) 중 하나 이상이 참일 때만 협상할 수 있다. */
export function canNegotiate(offer: Offer): boolean {
  return offer.negotiationState === 'OPEN' && (offer.negotiable.wage || offer.negotiable.role || offer.negotiable.length);
}

export type ExpireOffersResult = { kept: Offer[]; expired: Offer[] };

/** `isOfferExpired` 기준으로 목록을 나눈다. 원래 순서를 유지한다. */
export function expireOffers(offers: readonly Offer[], revision: number): ExpireOffersResult {
  const kept: Offer[] = [];
  const expired: Offer[] = [];
  for (const offer of offers) {
    (isOfferExpired(offer, revision) ? expired : kept).push(offer);
  }
  return { kept, expired };
}
