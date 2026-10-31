import { afterEach, describe, expect, it, vi } from 'vitest';
import { BAL, setLatestBalance, useCareerBalance } from '@offside/game/balance';
import { gradeOf } from '@offside/game/stats';
import { BALANCE_KEYS } from '@offside/contracts/balance';
import { setLocale } from '@offside/contracts/i18n';
import { BALANCE_TEXT } from '@offside/contracts/balance-text';
import {
  atLeastOneOf3,
  fairnessView,
  gradeOdds,
  GRADES,
  historyRows,
  oddsPct,
  subscribeFairness,
} from './fairness';
import { balanceKeysText } from './i18n/ko/balanceKeys';

describe('fairness', () => {
  afterEach(() => {
    setLatestBalance(null);
    useCareerBalance(null);
  });

  it('표를 연 뒤 늦게 받은 최신 설정을 반영하고 구독 해제 뒤에는 갱신하지 않는다', () => {
    const render = vi.fn();
    const unsubscribe = subscribeFairness(render);
    expect(render.mock.lastCall![0].pot[0]).toEqual(['S', '0.8%', '2.6%']);
    setLatestBalance({ version: 2, values: { potMean: 77, premiumSMult: 3 } });
    const view = render.mock.lastCall![0];
    expect(view.pot[0]).toEqual(['S', '1.9%', '2.6%']);
    expect(view.potNotes.join(' ')).toContain('5.6%');
    expect(view.potNotes.join(' ')).toContain('버전 2');
    // 표 갱신은 현재 커리어 BAL을 덮어쓰지 않는다.
    expect(BAL.potMean).toBe(75);
    unsubscribe();
    const calls = render.mock.calls.length;
    setLatestBalance(null);
    expect(render).toHaveBeenCalledTimes(calls);
    // 재진입하면 이미 수신한 설정으로 바로 그린다.
    setLatestBalance({ version: 2, values: { potMean: 77 } });
    const stop = subscribeFairness(render);
    expect(render.mock.lastCall![0].pot[0][1]).toBe('1.9%');
    stop();
  });

  it('등급 확률은 합이 1이고 기본값(평균 75, 편차 6)에서 S는 1% 미만이다', () => {
    const o = gradeOdds(75, 6);
    expect(GRADES.reduce((a, g) => a + o[g], 0)).toBeCloseTo(1, 6);
    expect(o.S).toBeGreaterThan(0.006);
    expect(o.S).toBeLessThan(0.01);
    expect(atLeastOneOf3(o.S)).toBeCloseTo(0.0233, 3);
  });

  it('계산한 확률이 같은 방식의 표본 추출과 맞는다', () => {
    // 시드 고정(mulberry32) Box–Muller로 candidates.ts와 같은 반올림·등급 규칙을 흉내 낸다.
    let x = 12345;
    const rnd = () => {
      x = (x + 0x6d2b79f5) | 0;
      let t = Math.imul(x ^ (x >>> 15), 1 | x);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (((t ^ (t >>> 14)) >>> 0) + 0.5) / 4294967296;
    };
    const n = 200_000;
    const count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const z = Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
      const g = gradeOf(Math.max(55, Math.min(96, Math.round(74 + z * 8))));
      count[g] = (count[g] ?? 0) + 1;
    }
    const o = gradeOdds(74, 8);
    for (const g of GRADES) expect((count[g] ?? 0) / n).toBeCloseTo(o[g], 2);
  });

  it('표는 기본 밸런스와 강화 4단계를 담는다', () => {
    const v = fairnessView();
    expect(v.pot.map(([g, season]) => `${g} ${season}`)).toEqual([
      'S 0.8%',
      'A 7.0%',
      'B 26.0%',
      'C 48.2%',
      'D 18.0%',
    ]);
    expect(v.boost.map(([, p]) => p)).toEqual([
      '50% (대성공 10%)',
      '35% (대성공 7%)',
      '25% (대성공 5%)',
      '15%',
    ]);
    expect(oddsPct(0.0004)).toBe('<0.1%');
    expect(oddsPct(0.026)).toBe('2.6%');
  });

  it('대성공 소수 확률과 확정 강화 예외를 최신 표에도 공개한다', () => {
    setLatestBalance({ version: 3, values: { boostGreat: 0.1 } });
    const view = fairnessView();
    expect(view.boost.map(([, p]) => p)).toEqual([
      '50% (대성공 5%)',
      '35% (대성공 3.5%)',
      '25% (대성공 2.5%)',
      '15%',
    ]);
    expect(view.boostNote).toContain('확정 강화는 별도');
    expect(view.boostNote).toContain('10%');
  });

  it('이력은 바로 앞 버전(맨 처음은 기본값)과 달라진 항목만 보여 준다', () => {
    const rows = historyRows({
      patches: [],
      versions: [
        {
          version: 2,
          values: { potMean: 76, eventWeight: { knock: 2 } },
          activatedAt: '2026-10-02T00:00:00.000Z',
          active: true,
        },
        {
          version: 1,
          values: { potMean: 76, injuryRate: 0.01 },
          activatedAt: '2026-10-01T00:00:00.000Z',
          active: false,
        },
      ],
    });
    expect(rows[0]!.changes).toEqual([
      [balanceKeysText.injuryRate, '1% → 1.2%'],
      [balanceKeysText.eventWeight({ n: 1 }), ''],
    ]);
    expect(rows[1]!.changes).toEqual([
      [balanceKeysText.potMean, '75 → 76'],
      [balanceKeysText.injuryRate, '1.2% → 1%'],
    ]);
  });

  describe('T-11-333 코드 배포 패치', () => {
    afterEach(() => setLocale('ko'));
    const patch = {
      id: 't-11-229-growth-targetman',
      appliedAt: '2026-10-12T16:28:05.431Z',
      title: { ko: '타겟맨 훈련', en: 'Target men' },
      items: { ko: ['헤딩으로 키워도 올라요'], en: ['Heading counts now'] },
      changes: [{ key: 'potGrowthFloor' as const, from: 0.04, to: 0.15 }],
      postId: 'pst_release_20261013',
    };
    const history = {
      versions: [
        {
          version: 1,
          values: { potMean: 76 },
          activatedAt: '2026-10-20T00:00:00.000Z',
          active: true,
        },
      ],
      patches: [
        patch,
        { ...patch, id: 'older', appliedAt: '2026-10-09T07:07:53.731Z', changes: [] },
      ],
    };

    it('버전과 섞어 최근 적용 순으로 늘어놓고, 키 변경은 버전 줄과 같은 모양으로 보여 준다', () => {
      const rows = historyRows(history);
      expect(rows.map((r) => [r.kind, r.id])).toEqual([
        ['version', 'v1'],
        ['patch', 't-11-229-growth-targetman'],
        ['patch', 'older'],
      ]);
      expect(rows[1]).toMatchObject({
        title: '타겟맨 훈련',
        items: ['헤딩으로 키워도 올라요'],
        postId: 'pst_release_20261013',
        changes: [[balanceKeysText.potGrowthFloor, '×0.04 → ×0.15']],
      });
      expect(rows[2]!.changes).toEqual([]);
    });

    it('패치 문구는 지금 언어로 고르고, 번역이 없으면 한국어다', () => {
      setLocale('en');
      expect(historyRows(history)[1]).toMatchObject({
        title: 'Target men',
        items: ['Heading counts now'],
      });
      setLocale('ja');
      expect(historyRows(history)[1]).toMatchObject({ title: '타겟맨 훈련' });
    });
  });

  it('밸런스 항목 이름은 운영 도구 이름(스펙 label)과 같다', () => {
    for (const k of BALANCE_KEYS) expect(balanceKeysText[k], k).toBe(BALANCE_TEXT[k].label);
  });
});
