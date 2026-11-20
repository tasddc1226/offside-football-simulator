import { DAY_MS } from '@offside/contracts/kst';
import { describe, expect, it } from 'vitest';
import {
  MEMBER_INTRO_DUE_DAYS,
  memberIntroCohort,
  membershipIntroGroup,
  type MemberIntroRow,
} from './memberIntro.js';

const T0 = Date.parse('2026-11-21T00:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

async function profileIn(group: 'offer' | 'control') {
  for (let i = 0; ; i++) {
    const id = `prf_${group}_${i}`;
    if ((await membershipIntroGroup(id)) === group) return id;
  }
}

describe('T-11-774 첫 달 할인 실험 집계', () => {
  it('군별로 가입 · 자동 갱신 끔 · 둘째 달 대상 · 유지를 센다', async () => {
    const offer = await profileIn('offer');
    const control = await profileIn('control');
    const row = (profile_id: string, days: number, auto_renew: number | null): MemberIntroRow => ({
      store: 'google',
      profile_id,
      created_at: iso(T0),
      until: iso(T0 + days * DAY_MS),
      auto_renew,
    });
    const rows = [
      row(offer, 61, 1), // 둘째 달 결제
      row(offer, 31, 0), // 첫 달 뒤 끝남
      row(offer, 40, 1), // 결제 유예만 받은 구독은 유지로 세지 않는다
      row(control, 61, null),
    ];
    const early = await memberIntroCohort(rows, T0 + (MEMBER_INTRO_DUE_DAYS - 1) * DAY_MS);
    expect(early.google.offer).toEqual({ new: 3, off: 1, due: 0, kept: 0 });
    expect(early.google.control).toEqual({ new: 1, off: 0, due: 0, kept: 0 });

    const later = await memberIntroCohort(rows, T0 + MEMBER_INTRO_DUE_DAYS * DAY_MS);
    expect(later.google.offer).toEqual({ new: 3, off: 1, due: 3, kept: 1 });
    expect(later.google.control).toEqual({ new: 1, off: 0, due: 1, kept: 1 });
    expect(later.apple.offer.new + later.apple.control.new).toBe(0);

    const ios = await memberIntroCohort([{ ...row(offer, 61, 1), store: 'apple' }], T0);
    expect(ios.apple.offer.new).toBe(1);
    expect(ios.google.offer.new).toBe(0);
  });

  it('대상이 없으면 0만 돌려준다', async () => {
    const empty = await memberIntroCohort([], T0);
    expect(empty.google.offer.new + empty.apple.control.new).toBe(0);
  });
});
