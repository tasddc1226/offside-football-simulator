import { describe, expect, it } from 'vitest';
import { pickAndroidOffer, pickIosIntro, type OfferLike } from './memberOffer.js';

const phase = (formattedPrice: string, recurrenceMode: number, billingCycleCount = 0) => ({
  billingCycleCount,
  billingPeriod: 'P1M',
  formattedPrice,
  priceAmountMicros: String(Number(formattedPrice.replace(/\D/g, '')) * 1_000_000),
  recurrenceMode,
});
const offer = (id: string, list: ReturnType<typeof phase>[], token = `tok-${id}`): OfferLike => ({
  id,
  offerTokenAndroid: token,
  pricingPhasesAndroid: { pricingPhaseList: list },
  displayPrice: list[0]?.formattedPrice ?? '₩4,900',
});
const base = offer('', [phase('₩4,900', 1)], 'tok-base');
const intro = offer('intro-1m', [phase('₩2,900', 2, 1), phase('₩4,900', 1)]);

describe('pickAndroidOffer', () => {
  it('할인 요금제가 앞에 있어도 할인을 켜지 않았으면 정상가 요금제로 판다', () => {
    expect(pickAndroidOffer([intro, base], null)).toEqual({
      token: 'tok-base',
      price: '₩4,900',
      intro: null,
    });
  });
  it('할인을 켰고 요금제가 목록에 있으면 그 토큰과 가격 단계를 함께 쓴다', () => {
    expect(pickAndroidOffer([base, intro], 'intro-1m')).toEqual({
      token: 'tok-intro-1m',
      price: '₩4,900',
      intro: { price: '₩2,900', months: 1 },
    });
  });
  it('한 달 1회 결제 할인(반복 없음)은 횟수가 0으로 와도 첫 달 할인으로 읽는다', () => {
    for (const count of [0, 1]) {
      const once = offer('intro-1m', [phase('₩2,900', 3, count), phase('₩4,900', 1)]);
      expect(pickAndroidOffer([base, once], 'intro-1m')).toEqual({
        token: 'tok-intro-1m',
        price: '₩4,900',
        intro: { price: '₩2,900', months: 1 },
      });
    }
  });
  it('반복 결제 할인은 횟수만큼의 달로 읽고, 횟수가 없으면 정상가로 판다', () => {
    const two = offer('intro-1m', [phase('₩2,900', 2, 2), phase('₩4,900', 1)]);
    expect(pickAndroidOffer([base, two], 'intro-1m')?.intro).toEqual({
      price: '₩2,900',
      months: 2,
    });
    const zero = offer('intro-1m', [phase('₩2,900', 2, 0), phase('₩4,900', 1)]);
    expect(pickAndroidOffer([base, zero], 'intro-1m')?.intro).toBeNull();
  });
  it('할인 요금제가 없으면(자격 없음) 정상가로 판다', () => {
    expect(pickAndroidOffer([base], 'intro-1m')?.token).toBe('tok-base');
  });
  it('할인 요금제 모양이 다르면(무료 체험 · 다른 정상가 · 세 단계) 정상가로 판다', () => {
    const free = offer('intro-1m', [phase('₩0', 2, 1), phase('₩4,900', 1)]);
    const other = offer('intro-1m', [phase('₩2,900', 2, 1), phase('₩5,900', 1)]);
    const three = offer('intro-1m', [
      phase('₩1,900', 2, 1),
      phase('₩2,900', 2, 1),
      phase('₩4,900', 1),
    ]);
    for (const o of [free, other, three])
      expect(pickAndroidOffer([o, base], 'intro-1m')).toEqual({
        token: 'tok-base',
        price: '₩4,900',
        intro: null,
      });
  });
  it('다른 이름의 할인 요금제는 쓰지 않는다', () => {
    const promo = offer('winback', [phase('₩2,200', 2, 1), phase('₩4,900', 1)]);
    expect(pickAndroidOffer([promo, base], 'intro-1m')?.token).toBe('tok-base');
  });
  it('월 정상가 요금제가 둘이거나 없으면 팔지 않는다', () => {
    expect(pickAndroidOffer([base, offer('b2', [phase('₩5,900', 1)])], null)).toBeNull();
    expect(pickAndroidOffer([intro], 'intro-1m')).toBeNull();
    expect(pickAndroidOffer([], null)).toBeNull();
  });
  it('가격 단계가 없는 응답은 요금제가 하나일 때만 쓴다', () => {
    const bare: OfferLike = { id: '', offerTokenAndroid: 't', displayPrice: '₩4,900' };
    expect(pickAndroidOffer([bare], 'intro-1m')).toEqual({
      token: 't',
      price: '₩4,900',
      intro: null,
    });
    expect(pickAndroidOffer([bare, { ...bare, offerTokenAndroid: 'u' }], null)).toBeNull();
    expect(pickAndroidOffer([{ ...bare, offerTokenAndroid: null }], null)).toBeNull();
  });
});

describe('pickIosIntro', () => {
  const p = {
    introductoryPriceIOS: '₩2,900',
    introductoryPriceNumberOfPeriodsIOS: '1',
    introductoryPricePaymentModeIOS: 'pay-as-you-go',
    introductoryPriceSubscriptionPeriodIOS: 'month',
  };
  it('받을 수 있는 계정에만 보인다', () => {
    expect(pickIosIntro(p, true)).toEqual({ price: '₩2,900', months: 1 });
    expect(pickIosIntro(p, false)).toBeNull();
  });
  it('무료 체험 · 선결제 · 달이 아닌 주기 · 할인 없음은 보이지 않는다', () => {
    expect(pickIosIntro({ ...p, introductoryPricePaymentModeIOS: 'free-trial' }, true)).toBeNull();
    expect(
      pickIosIntro({ ...p, introductoryPricePaymentModeIOS: 'pay-up-front' }, true),
    ).toBeNull();
    expect(pickIosIntro({ ...p, introductoryPriceSubscriptionPeriodIOS: 'week' }, true)).toBeNull();
    expect(pickIosIntro({ introductoryPricePaymentModeIOS: 'empty' }, true)).toBeNull();
  });
});
