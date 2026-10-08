import { describe, expect, it } from 'vitest';
import { CUP_HOME_AFTER_MS, cupBeforeDraw, cupOnHome } from './cupHome.js';

const final = '2026-10-20T12:00:00.000Z';
const cup = {
  rounds: [
    { round: 'g1', at: '2026-10-13T12:00:00.000Z' },
    { round: 'f', at: final },
  ],
};
const of = (phase: string) => ({ phase, cup }) as unknown as Parameters<typeof cupOnHome>[0];

describe('cupOnHome', () => {
  it('진행 중인 단계는 늘 보인다', () => {
    for (const p of ['soon', 'open', 'closed', 'group', 'knockout'])
      expect(cupOnHome(of(p))).toBe(true);
  });
  it('취소된 대회는 숨긴다', () => {
    expect(cupOnHome(of('cancelled'))).toBe(false);
  });
  it('끝난 대회는 결승 뒤 일주일까지만', () => {
    const t = Date.parse(final);
    expect(cupOnHome(of('done'), t + CUP_HOME_AFTER_MS - 1)).toBe(true);
    expect(cupOnHome(of('done'), t + CUP_HOME_AFTER_MS)).toBe(false);
  });
});

describe('cupBeforeDraw', () => {
  it('접수 전·중·마감 뒤만 추첨 전이다', () => {
    expect(['soon', 'open', 'closed'].every((p) => cupBeforeDraw(p as never))).toBe(true);
    expect(['group', 'knockout', 'done', 'cancelled'].some((p) => cupBeforeDraw(p as never))).toBe(
      false,
    );
  });
});
