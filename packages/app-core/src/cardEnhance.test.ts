import { DEFAULT_ENHANCE_RULES, enhanceExpectedCost } from '@offside/contracts/card-enhance';
import type { EnhanceAutoBody, EnhanceAutoResponse } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import {
  enhanceAutoBudgets,
  enhanceAutoExpected,
  enhanceAutoSummary,
  enhanceAutoTargets,
  enhanceErrorText,
  enhanceFxBig,
  enhanceFxMs,
  enhanceParticles,
  enhanceResultKind,
  enhanceResultText,
  enhanceSellNote,
  enhanceLossNote,
  showsPosOvr,
  enhanceView,
  runEnhanceAuto,
} from './cardEnhance.js';
import { cardEnhanceText as L } from './i18n/ko/cardEnhance.js';

describe('카드 강화 창 (T-11-373)', () => {
  const open = { ...DEFAULT_ENHANCE_RULES, open: true };
  const card = { level: 0, fails: 0, tier: 'normal' as const };

  it('시도할 수 있으면 서버에 보낼 본 값을 만든다', () => {
    const v = enhanceView(card, open, 1_000_000);
    expect(v.block).toBeNull();
    expect(v.ratePct).toBe('90%');
    expect(v.body).toEqual({ level: 0, fails: 0, cost: 100_000, rateBp: 9000, downBp: 0 });
    expect(v.ovrText).toBe(L.ovr({ now: 0, next: 1 }));
    expect(v).toMatchObject({ keepPct: '10%', downPct: '0%', failText: L.failSafe });
    expect(enhanceView({ ...card, level: 3 }, open, 1_000_000)).toMatchObject({
      ratePct: '45%',
      keepPct: '40%',
      downPct: '15%',
      failText: L.failNote({ lv: 2 }),
    });
  });

  it('실패해도 확률이 그대로이고, 막는 이유를 차례로 알린다', () => {
    // 실패해도 확률은 그대로다(천장 없음).
    expect(enhanceView({ ...card, fails: 9 }, open, 1_000_000).ratePct).toBe('90%');
    expect(enhanceView(card, DEFAULT_ENHANCE_RULES, 1_000_000).block).toBe(L.closed);
    expect(enhanceView(card, open, 1_000_000, true).block).toBe(L.listed);
    expect(enhanceView(card, open, 99_999).block).toBe(L.short);
    expect(enhanceView({ ...card, level: 10 }, open, 1_000_000)).toMatchObject({
      block: L.max,
      ovrText: null,
    });
  });

  it('최고 OVR이 높은 카드는 낮은 확률과 이유를 보여 주고, 본 값도 그 확률이다', () => {
    const top = enhanceView({ ...card, tier: 'top' }, open, 1_000_000);
    expect(top).toMatchObject({ ratePct: '72%', keepPct: '28%', tierText: L.tierTop });
    expect(top.body?.rateBp).toBe(7200);
    expect(enhanceView({ ...card, tier: 'high' }, open, 1_000_000).ratePct).toBe('81%');
    expect(enhanceView(card, open, 1_000_000).tierText).toBeNull();
  });

  it('결과 문구: 성공 · 유지 · 실패(-1)', () => {
    expect(enhanceResultKind({ success: true, from: 3, to: 4 })).toBe('success');
    expect(enhanceResultKind({ success: false, from: 3, to: 3 })).toBe('keep');
    expect(enhanceResultKind({ success: false, from: 3, to: 2 })).toBe('down');
    expect(enhanceResultText({ success: false, from: 3, to: 2 })).toBe(
      L.failDown({ from: 3, to: 2 }),
    );
    expect(enhanceResultText({ success: false, from: 3, to: 3 })).toBe(L.failKeep({ lv: 3 }));
  });

  it('거절 이유 · 판매 안내', () => {
    expect(enhanceErrorText({ reason: 'FUNDS_SHORT' })).toBe(L.short);
    expect(enhanceErrorText({ reason: 'X', message: '서버 문구' })).toBe('서버 문구');
    expect(enhanceSellNote(0)).toBeNull();
    expect(enhanceSellNote(2)).toContain('+2');
  });

  it('자리 OVR은 제 자리가 아닐 때만 따로 보인다(강화 OVR만큼 높은 것은 제 자리)', () => {
    expect(showsPosOvr(84, 84, 0)).toBe(false);
    expect(showsPosOvr(84, 87, 3)).toBe(false);
    expect(showsPosOvr(84, 79, 0)).toBe(true);
    expect(showsPosOvr(84, 82, 3)).toBe(true);
    // 강화 덕에 최고 OVR과 숫자가 같아져도 제 자리가 아니면 보인다(제 자리면 87이다).
    expect(showsPosOvr(84, 84, 3)).toBe(true);
    expect(showsPosOvr(84, 87, null)).toBe(true);
  });

  it('방출 · 과제 확인에는 강화한 선수가 있을 때만 경고한다', () => {
    expect(enhanceLossNote([{ enhance: 0 }, {}])).toBeNull();
    expect(enhanceLossNote([{ enhance: 3 }, { enhance: 1 }, {}])).toBe(L.lossNote({ n: 2 }));
  });
});

describe('T-11-639 강화 연출 값', () => {
  it('높은 단계 성공만 크게, 길이는 결과마다 다르다', () => {
    expect(enhanceFxBig({ success: true, to: 7 })).toBe(true);
    expect(enhanceFxBig({ success: true, to: 6 })).toBe(false);
    expect(enhanceFxBig({ success: false, to: 8 })).toBe(false);
    expect(enhanceFxMs({ success: true, from: 7, to: 8 })).toBeGreaterThan(
      enhanceFxMs({ success: true, from: 1, to: 2 }),
    );
    expect(enhanceFxMs({ success: false, from: 2, to: 2 })).toBeLessThan(
      enhanceFxMs({ success: false, from: 2, to: 1 }),
    );
  });
  it('입자 배치는 범위 안의 고정값이다', () => {
    const a = enhanceParticles(24);
    expect(a).toHaveLength(24);
    expect(a).toEqual(enhanceParticles(24));
    for (const x of a) {
      expect(x.dist).toBeGreaterThanOrEqual(0.55);
      expect(x.dist).toBeLessThanOrEqual(1);
      expect(x.delay).toBeLessThan(1);
    }
  });
});

describe('T-11-679 자동 강화', () => {
  const rules = { ...DEFAULT_ENHANCE_RULES, open: true };
  const card = { level: 2, fails: 0, tier: 'normal' as const };

  it('목표는 다음 단계부터 +10까지, 기대 비용은 0에서 잰 값의 차이다', () => {
    expect(enhanceAutoTargets(8)).toEqual([9, 10]);
    expect(enhanceAutoTargets(10)).toEqual([]);
    const want = Math.round(enhanceExpectedCost(5).cost - enhanceExpectedCost(2).cost);
    expect(enhanceAutoExpected(card, 5, rules)).toBe(want);
    // 높은 구간 카드는 확률이 낮아 더 든다.
    expect(enhanceAutoExpected({ ...card, tier: 'top' }, 5, rules)).toBeGreaterThan(want);
  });

  it('쓸 금액 후보: 기대 비용 배수(1억 단위 올림)와 가진 자금 전부, 기본은 1.5배', () => {
    const { list, pick } = enhanceAutoBudgets(1_234_567, 100_000_000, 400_000);
    expect(list.map((b) => b.value)).toEqual([
      1_240_000, 1_860_000, 2_470_000, 3_710_000, 100_000_000,
    ]);
    expect(pick).toBe(1_860_000);
    expect(list.at(-1)!.label).toContain('가진 자금 전부');
    // 가진 자금보다 큰 배수는 빠지고, 1.5배가 없으면 가진 자금 전부가 기본이다.
    const poor = enhanceAutoBudgets(1_234_567, 1_500_000, 400_000);
    expect(poor.list.map((b) => b.value)).toEqual([1_240_000, 1_500_000]);
    expect(poor.pick).toBe(1_500_000);
    // 한 번도 못 하면 후보가 없다.
    expect(enhanceAutoBudgets(1_000_000, 100_000, 400_000).list).toEqual([]);
  });

  const reply = (d: Partial<EnhanceAutoResponse>): EnhanceAutoResponse => ({
    tries: [],
    spent: 0,
    balance: 0,
    card,
    stop: 'target',
    ...d,
  });

  it('more면 남은 금액 · 새 상태로 이어서 보내고, 결과를 모아 멈춘 이유를 남긴다', async () => {
    const sent: { body: EnhanceAutoBody; key: string }[] = [];
    const replies = [
      reply({
        tries: [
          { success: false, from: 2, to: 1, cost: 400_000 },
          { success: true, from: 1, to: 2, cost: 200_000 },
        ],
        spent: 600_000,
        balance: 9_400_000,
        card: { level: 2, fails: 0, tier: 'normal' },
        stop: 'more',
      }),
      reply({
        tries: [{ success: true, from: 2, to: 3, cost: 400_000 }],
        spent: 400_000,
        balance: 9_000_000,
        card: { level: 3, fails: 0, tier: 'normal' },
        stop: 'target',
        titles: ['t1'],
      }),
    ];
    let k = 0;
    const run = await runEnhanceAuto({
      start: card,
      target: 3,
      budget: 5_000_000,
      balance: 10_000_000,
      send: async (body, key) => {
        sent.push({ body, key });
        return { ok: true, data: replies.shift()! };
      },
      newKey: () => `key-${++k}`,
      cancelled: () => false,
    });
    expect(sent.map((s) => s.body.budget)).toEqual([5_000_000, 4_400_000]);
    expect(sent.map((s) => s.key)).toEqual(['key-1', 'key-2']);
    expect(run).toMatchObject({
      tries: 3,
      up: 2,
      keep: 0,
      down: 1,
      spent: 1_000_000,
      stop: 'target',
      titles: ['t1'],
    });
    expect(enhanceAutoSummary(run, 3)).toEqual({
      done: L.autoDone({ n: 3, up: 2, keep: 0, down: 1, spent: '100억' }),
      why: L.stopTarget({ lv: 3 }),
    });
  });

  it('응답을 받지 못하면 같은 키로 두 번까지 다시 보내고, 거절이면 이유를 남기며, 멈추기를 누르면 다음 묶음을 보내지 않는다', async () => {
    const keys: string[] = [];
    const lost = { ok: false as const, error: { code: 'NETWORK', message: '', retryable: true } };
    const answers = [
      lost,
      lost,
      {
        ok: true as const,
        data: reply({
          stop: 'more',
          tries: [{ success: false, from: 2, to: 2, cost: 1 }],
          spent: 1,
        }),
      },
    ];
    let stop = false;
    const run = await runEnhanceAuto({
      start: card,
      target: 5,
      budget: 10,
      balance: 10,
      send: async (_b, key) => {
        keys.push(key);
        stop = true;
        return answers.shift()!;
      },
      newKey: () => 'same',
      cancelled: () => stop,
    });
    expect(keys).toEqual(['same', 'same', 'same']);
    expect(run.stop).toBe('user');
    const refused = await runEnhanceAuto({
      start: card,
      target: 5,
      budget: 10,
      balance: 10,
      send: async () => ({
        ok: false,
        error: { code: 'CONFLICT', reason: 'ENHANCE_AUTO_BUDGET', message: 'x', retryable: false },
      }),
      newKey: () => 'k',
      cancelled: () => false,
    });
    expect(refused).toMatchObject({ stop: 'error', error: L.autoBudgetLow, tries: 0 });
    expect(enhanceAutoSummary(refused, 5)).toEqual({ done: null, why: L.autoBudgetLow });
  });
});
