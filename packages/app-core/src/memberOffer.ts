// T-11-770e 멤버십 요금제 고르기(기획 T-11-747 R3B). 스토어가 준 구독 요금제 목록에서 실제로 결제에 쓸 것을 정하고, 화면에 보일
// 가격 단계(첫 달 할인 → 그 뒤 정상가)를 같은 요금제에서 뽑는다. 화면에 보인 가격과 결제에 쓰는 토큰이 어긋나지 않게 한 곳에서
// 정한다. 목록의 첫 번째나 가장 싼 것을 그냥 고르지 않는다. 확실하지 않으면 정상가만 보이거나(할인 숨김) 팔지 않는다(null).

/** Play 가격 단계의 반복 방식: 1 = 끝없이 반복(정상가), 2 = 정해진 횟수만 반복(첫 달 할인), 3 = 반복 없음. */
const INFINITE = 1;
const FINITE = 2;
const MONTH = 'P1M';

export interface OfferPhase {
  billingCycleCount: number;
  billingPeriod: string;
  formattedPrice: string;
  priceAmountMicros: string;
  recurrenceMode: number;
}
export interface OfferLike {
  id: string;
  offerTokenAndroid?: string | null;
  pricingPhasesAndroid?: { pricingPhaseList: OfferPhase[] } | null;
  displayPrice: string;
}
/** 첫 결제 할인: 그 기간의 월 가격과 몇 달인지. */
export interface MemberIntro {
  price: string;
  months: number;
}
export interface MemberOffer {
  /** 결제 요청에 붙일 요금제 토큰(Android). */
  token: string;
  /** 할인 뒤에 매달 결제되는 정상가. */
  price: string;
  intro: MemberIntro | null;
}

const phases = (o: OfferLike) => o.pricingPhasesAndroid?.pricingPhaseList ?? [];
const monthlyForever = (p: OfferPhase | undefined) =>
  !!p && p.recurrenceMode === INFINITE && p.billingPeriod === MONTH;

/**
 * Android: 월 정상가 요금제(가격 단계가 '매달 끝없이' 하나뿐인 것)를 찾고, `introId`를 주면 그 ID의 신규 할인 요금제를 먼저 본다.
 * Play는 이 계정이 받을 수 있는 요금제만 돌려주므로, 할인 요금제가 목록에 있으면 자격이 있는 것이다. 할인 요금제는 '몇 달 할인가
 * → 그 뒤 정상가와 같은 값' 두 단계일 때만 쓴다. 모양이 다르면 정상가로 판다.
 */
export function pickAndroidOffer(
  offers: readonly OfferLike[],
  introId: string | null,
): MemberOffer | null {
  const usable = offers.filter((o) => !!o.offerTokenAndroid);
  const regulars = usable.filter((o) => phases(o).length === 1 && monthlyForever(phases(o)[0]));
  // 가격 단계를 받지 못한 옛 응답이면 요금제가 하나뿐일 때만 그것을 쓴다(지금 운영 구성). 둘 이상이면 고르지 않는다.
  if (regulars.length !== 1) {
    const only = usable.length === 1 && phases(usable[0]!).length === 0 ? usable[0]! : null;
    return only ? { token: only.offerTokenAndroid!, price: only.displayPrice, intro: null } : null;
  }
  const regular = regulars[0]!;
  const price = phases(regular)[0]!.formattedPrice;
  const base: MemberOffer = { token: regular.offerTokenAndroid!, price, intro: null };
  if (!introId) return base;
  const offer = usable.find((o) => o.id === introId);
  const [first, last, ...rest] = offer ? phases(offer) : [];
  if (
    !offer ||
    rest.length ||
    !first ||
    first.recurrenceMode !== FINITE ||
    first.billingPeriod !== MONTH ||
    first.billingCycleCount < 1 ||
    !(Number(first.priceAmountMicros) > 0) ||
    !monthlyForever(last) ||
    last!.formattedPrice !== price
  )
    return base;
  return {
    token: offer.offerTokenAndroid!,
    price,
    intro: { price: first.formattedPrice, months: first.billingCycleCount },
  };
}

export interface IosIntroLike {
  introductoryPriceIOS?: string | null;
  introductoryPriceNumberOfPeriodsIOS?: string | null;
  introductoryPricePaymentModeIOS?: string | null;
  introductoryPriceSubscriptionPeriodIOS?: string | null;
}

/**
 * iOS: 상품에 '매달 할인가로 결제'하는 신규 할인이 있고 이 Apple 계정이 받을 수 있을 때(`eligible`)만 돌려준다. 무료 체험 · 선결제 ·
 * 달이 아닌 주기는 화면 문구가 맞지 않아 보이지 않는다(결제는 스토어가 정한 대로 된다).
 */
export function pickIosIntro(p: IosIntroLike, eligible: boolean): MemberIntro | null {
  const months = Number(p.introductoryPriceNumberOfPeriodsIOS);
  if (
    !eligible ||
    p.introductoryPricePaymentModeIOS !== 'pay-as-you-go' ||
    p.introductoryPriceSubscriptionPeriodIOS !== 'month' ||
    !p.introductoryPriceIOS ||
    !Number.isInteger(months) ||
    months < 1
  )
    return null;
  return { price: p.introductoryPriceIOS, months };
}
