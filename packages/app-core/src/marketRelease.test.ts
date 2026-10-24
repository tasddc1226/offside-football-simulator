import { describe, expect, it } from 'vitest';
import { RELEASE_MAX } from '@offside/contracts/market-value';
import {
  allReleasePicked,
  marketGuestText,
  pickAllIds,
  pickAllLabel,
  togglePickId,
} from './market.js';
import { shopShortText } from './rerollShop.js';
import { fundsText } from './funds.js';
import { marketText as L } from './i18n/ko/market.js';
import { cupText as CL } from './i18n/ko/cup.js';
import { renameText as R } from './i18n/ko/rename.js';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ careerId: `c${i}` }));

describe('T-11-442 방출 전체 선택은 서버 한도까지만', () => {
  it('한도보다 많으면 앞에서부터 한도만큼 고르고, 다시 누르면 모두 푼다', () => {
    const list = players(RELEASE_MAX + 7);
    const all = pickAllIds(list, new Set());
    expect(all.size).toBe(RELEASE_MAX);
    expect([...all]).toEqual(list.slice(0, RELEASE_MAX).map((p) => p.careerId));
    expect(allReleasePicked(list.length, all.size)).toBe(true);
    expect(pickAllIds(list, all).size).toBe(0);
  });
  it('한도보다 적으면 모두 고른다', () => {
    const list = players(3);
    expect(pickAllIds(list, new Set(['c1'])).size).toBe(3);
    expect(allReleasePicked(3, 2)).toBe(false);
    expect(allReleasePicked(0, 0)).toBe(false);
  });
  it('버튼 이름은 한도를 넘을 때만 최대 인원을 적는다', () => {
    expect(pickAllLabel(RELEASE_MAX + 1, false)).toBe(L.pickAllMax({ n: RELEASE_MAX }));
    expect(pickAllLabel(RELEASE_MAX + 1, false)).toBe(`최대 ${RELEASE_MAX}명 선택`);
    expect(pickAllLabel(RELEASE_MAX, false)).toBe(L.pickAll);
    expect(pickAllLabel(4, true)).toBe(L.pickNone);
  });
  it('하나씩 고를 때도 한도를 넘기지 않는다', () => {
    const full = new Set(players(RELEASE_MAX).map((p) => p.careerId));
    expect(togglePickId(full, 'x')).toEqual({ next: full, full: true });
    expect(togglePickId(full, 'c0')).toMatchObject({ full: false });
    expect(togglePickId(full, 'c0').next.has('c0')).toBe(false);
    expect(togglePickId(new Set(), 'a').next).toEqual(new Set(['a']));
  });
});

describe('T-11-442 로그인 전 이적시장 안내', () => {
  it('탭마다 오류 대신 할 수 있는 일을 알린다', () => {
    expect(marketGuestText('sell')).toBe(L.guestSell);
    expect(marketGuestText('trades')).toBe(L.guestTrades);
    expect(marketGuestText('release')).toBe(L.guestRelease);
    for (const v of ['sell', 'trades', 'release'] as const)
      expect(marketGuestText(v)).toMatch(/^로그인하면/);
  });
  it('자금 만들기 버튼은 방출로 만든다는 걸 이름에 담는다', () => {
    expect(L.makeFunds).toBe('방출해서 자금 만들기');
  });
});

describe('T-11-442 상점 자금 부족 안내', () => {
  it('얼마나 모자라는지 적고, 모자라지 않으면 null', () => {
    expect(shopShortText(30_000, 100_000)).toBe(CL.shopShort({ short: fundsText(70_000) }));
    expect(shopShortText(30_000, 100_000)).toContain('방출하면');
    expect(shopShortText(100_000, 100_000)).toBeNull();
    expect(shopShortText(0, null)).toBeNull();
  });
});

describe('T-11-442 이름 변경 확인 문구', () => {
  it('받침에 따라 로/으로를 붙이고 공개된다는 걸 알린다', () => {
    expect(R.confirm({ name: '새이름' })).toBe('이름을 새이름으로 바꿀까요?');
    expect(R.confirm({ name: '가나' })).toBe('이름을 가나로 바꿀까요?');
    expect(R.confirmNote).toContain('공개돼요');
    expect(R.rule({ max: 12 })).toContain('12자');
  });
});
