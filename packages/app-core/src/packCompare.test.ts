import { describe, expect, it } from 'vitest';
import { packUnits } from './packCompare';

const krw = (qty: number, amount: number) => ({ qty, amount, currency: 'KRW' });

describe('packUnits', () => {
  it('같은 통화의 묶음은 장당 가격을 적고 가장 싼 묶음 하나만 표시한다', () => {
    const r = packUnits([krw(1, 1100), krw(5, 4400), krw(50, 33000)], 'ko-KR');
    expect(r.map((u) => u.unit)).toEqual(['₩1,100', '₩880', '₩660']);
    expect(r.map((u) => u.lowest)).toEqual([false, false, true]);
  });

  it('엔화는 소수 없이, 달러는 센트까지 적는다', () => {
    const jpy = packUnits(
      [
        { qty: 1, amount: 160, currency: 'JPY' },
        { qty: 5, amount: 650, currency: 'JPY' },
      ],
      'ja-JP',
    );
    expect(jpy.map((u) => u.unit?.replace(/[^\d.,]/g, ''))).toEqual(['160', '130']);
    const usd = packUnits(
      [
        { qty: 1, amount: 0.99, currency: 'USD' },
        { qty: 5, amount: 3.99, currency: 'USD' },
      ],
      'en-US',
    );
    expect(usd.map((u) => u.unit)).toEqual(['$0.99', '$0.80']);
    expect(usd[1]?.lowest).toBe(true);
  });

  it('통화가 섞였거나 숫자 가격이 빠지면 모두 숨긴다', () => {
    const none = [
      { unit: null, value: null, lowest: false },
      { unit: null, value: null, lowest: false },
    ];
    expect(packUnits([krw(1, 1100), { qty: 5, amount: 3.99, currency: 'USD' }], 'ko-KR')).toEqual(
      none,
    );
    expect(packUnits([krw(1, 1100), { qty: 5, currency: 'KRW' }], 'ko-KR')).toEqual(none);
    expect(packUnits([krw(1, 1100), { qty: 5, amount: 0, currency: 'KRW' }], 'ko-KR')).toEqual(
      none,
    );
    expect(packUnits([krw(1, 1100), { qty: 5, amount: 4400, currency: '' }], 'ko-KR')).toEqual(
      none,
    );
  });

  it('묶음이 하나뿐이면 비교하지 않는다', () => {
    expect(packUnits([krw(5, 4400)], 'ko-KR')).toEqual([
      { unit: null, value: null, lowest: false },
    ]);
  });

  it('적힌 장당 가격이 같으면 가장 낮다고 하지 않는다', () => {
    const r = packUnits([krw(1, 1100), krw(5, 5500)], 'ko-KR');
    expect(r.map((u) => u.lowest)).toEqual([false, false]);
    expect(r.map((u) => u.unit)).toEqual(['₩1,100', '₩1,100']);
  });
});
