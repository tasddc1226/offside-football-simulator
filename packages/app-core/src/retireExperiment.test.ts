import { describe, expect, it } from 'vitest';
import { BALANCE_SPEC, resolveBalance } from '@offside/contracts/balance';
import type { CareerRecord } from '@offside/game/types';
import {
  fnv1a,
  pickRetireScenes,
  profileKey,
  retireAccount,
  retireArm,
  retireArmOf,
  retireBucket,
  retireExpShare,
  retireNextStep,
  RETIRE_EXP_KEY,
} from './retireExperiment.js';
import { retireSceneView, retireNextText, retireCtaLabel } from './retireExperimentView.js';

const rec = (p: Partial<CareerRecord>): CareerRecord => ({
  year: 2026,
  age: 18,
  club: '서울 FC',
  league: 'K리그1',
  apps: 0,
  goals: 0,
  assists: 0,
  cs: 0,
  rating: 0,
  rank: 5,
  ovr: 60,
  honors: [],
  ...p,
});

describe('retireArm (T-11-669 고정 배정)', () => {
  it('기본값은 꺼짐(0)이고 운영 범위는 0~0.5다', () => {
    expect(BALANCE_SPEC[RETIRE_EXP_KEY]).toMatchObject({ def: 0, min: 0, max: 0.5 });
    expect(retireExpShare({ values: resolveBalance() })).toBe(0);
    expect(retireExpShare({ values: resolveBalance({ retireExpShare: 0.9 }) })).toBe(0.5);
    expect(retireExpShare({ values: {} })).toBe(0);
  });

  it('ID가 없거나 비율이 0 · 잘못된 값이면 실험 밖(null)이다', () => {
    expect(retireArm(null, 0.5)).toBeNull();
    expect(retireArm(undefined, 0.5)).toBeNull();
    expect(retireArm('', 0.5)).toBeNull();
    expect(retireArm('p1', 0)).toBeNull();
    expect(retireArm('p1', Number.NaN)).toBeNull();
    expect(retireArm('p1', -1)).toBeNull();
    expect(retireArm('p1', undefined)).toBeNull();
  });

  it('같은 ID는 언제 불러도 같은 군이다(웹 · 앱 · 다음 은퇴)', () => {
    for (const id of ['a', 'b', 'profile-123', '00000000-0000-4000-8000-000000000000'])
      expect(retireArm(id, 0.3)).toBe(retireArm(id, 0.3));
    // 해시 값 자체를 고정해 웹 · 앱(같은 코드) 사이 배정이 바뀌지 않게 한다.
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
  });

  it('비율 s면 실험군 s, 대조군 s, 나머지는 실험 밖이다', () => {
    const ids = Array.from({ length: 20_000 }, (_, i) => `id-${i}`);
    const count = (s: number) => {
      const c = { treatment: 0, control: 0, out: 0 };
      for (const id of ids) c[retireArm(id, s) ?? 'out']++;
      return c;
    };
    const c = count(0.1);
    for (const n of [c.treatment, c.control]) {
      expect(n / ids.length).toBeGreaterThan(0.09);
      expect(n / ids.length).toBeLessThan(0.11);
    }
    const half = count(0.5);
    expect(half.out).toBe(0);
    expect(Math.abs(half.treatment - half.control) / ids.length).toBeLessThan(0.02);
    // 0.5 초과는 0.5로 자른다.
    expect(count(0.9)).toEqual(half);
    for (const id of ids.slice(0, 2000)) {
      const b = retireBucket(id);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(10_000);
    }
  });

  it('비율이 달라져도 같은 프로필의 군은 바뀌지 않는다(대조군이 실험군으로 뒤집히지 않음)', () => {
    const ids = Array.from({ length: 20_000 }, (_, i) => `id-${i}`);
    const shares = [0.05, 0.1, 0.2, 0.35, 0.5];
    let both = 0;
    for (const id of ids) {
      const arms = shares.map((s) => retireArm(id, s)).filter((a) => a !== null);
      // 들어간 비율에서는 늘 같은 군, 그 군은 비율과 무관한 군 해시와 같다.
      for (const a of arms) expect(a).toBe(retireArmOf(id));
      const lo = retireArm(id, 0.1);
      const hi = retireArm(id, 0.3);
      if (lo) {
        // 낮은 비율에 들어갔으면 높은 비율에도 들어가고 군이 같다(이미 노출된 결과 귀속 보존).
        expect(hi).toBe(lo);
        both++;
      }
    }
    expect(both).toBeGreaterThan(0);
    // 비율을 내리면 빠질 수는 있어도 반대 군이 되지는 않는다.
    for (const id of ids.slice(0, 5000)) {
      const hi = retireArm(id, 0.4);
      const lo = retireArm(id, 0.05);
      if (lo) expect(lo).toBe(hi);
    }
  });

  it('로컬 계정 구분 키는 원래 ID 글자를 그대로 담지 않는다(익명화가 아니라 짧은 구분 키)', () => {
    const k = profileKey('profile-abc');
    expect(k).toBeTypeOf('string');
    expect(k).not.toContain('profile');
    expect(profileKey(null)).toBeNull();
  });
});

describe('pickRetireScenes (저장 기록만, 중복 없이 최대 3개)', () => {
  it('첫 출전 · 최고 평점 · 마지막 출전을 시즌 순서로 고른다', () => {
    const career = [
      rec({ year: 2026, apps: 0 }),
      rec({ year: 2027, apps: 12, rating: 6.5 }),
      rec({ year: 2028, apps: 30, rating: 7.4 }),
      rec({ year: 2029, apps: 28, rating: 7.4 }),
      rec({ year: 2030, apps: 20, rating: 6.9 }),
      rec({ year: 2031, apps: 0 }),
    ];
    const s = pickRetireScenes(career);
    expect(s.map((x) => [x.kind, x.rec.year])).toEqual([
      ['first_apps', 2027],
      ['peak_rating', 2028],
      ['last_apps', 2030],
    ]);
  });

  it('같은 시즌이면 하나만 남기고, 출전 시즌이 없으면 비운다', () => {
    expect(pickRetireScenes([])).toEqual([]);
    expect(pickRetireScenes([rec({ apps: 0 }), rec({ apps: 0 })])).toEqual([]);
    const one = pickRetireScenes([rec({ year: 2026, apps: 3, rating: 6.2 })]);
    expect(one.map((x) => x.kind)).toEqual(['first_apps']);
    // 최고 평점이 마지막 시즌이면 최고 평점 장면을 따로 두지 않는다.
    const two = pickRetireScenes([
      rec({ year: 2026, apps: 3, rating: 6.2 }),
      rec({ year: 2027, apps: 9, rating: 7.1 }),
    ]);
    expect(two.map((x) => x.kind)).toEqual(['first_apps', 'last_apps']);
    // 평점이 모두 0이면 최고 평점 장면이 없다.
    const flat = pickRetireScenes([
      rec({ year: 2026, apps: 3 }),
      rec({ year: 2027, apps: 9 }),
      rec({ year: 2028, apps: 9 }),
    ]);
    expect(flat.map((x) => x.kind)).toEqual(['first_apps', 'last_apps']);
  });

  it('장면 글은 기록 숫자만 옮기고 프로 데뷔라고 부르지 않는다', () => {
    const [first] = pickRetireScenes([
      rec({
        year: 2027,
        age: 19,
        apps: 12,
        goals: 3,
        assists: 2,
        rating: 6.54,
        rank: 4,
        honors: ['리그 우승'],
      }),
    ]);
    const v = retireSceneView(first!, 'FW');
    expect(v.title).toBe('첫 출전 기록');
    expect(v.when).toBe('2027 · 19세 · 서울 FC');
    expect(v.stats).toBe('12경기 3골 2도움');
    expect(v.rating).toBe('평점 6.54');
    expect(v.detail).toBe('K리그1 4위 · OVR 60');
    expect(v.honors).toContain('리그 우승');
    expect(JSON.stringify(v)).not.toMatch(/데뷔/);
    const gk = retireSceneView(
      { ...first!, rec: { ...first!.rec, cs: 7, rank: '-', honors: [] } },
      'GK',
    );
    expect(gk.stats).toBe('12경기 3골 무실점 7');
    expect(gk.detail).toBe('K리그1 · OVR 60');
    expect(gk.honors).toBeNull();
  });
});

describe('retireNextStep (상태와 모순 없는 다음 행동)', () => {
  it('업로드 · 계정 상태별로 다른 안내와 버튼', () => {
    expect(retireNextStep('member', 'done')).toEqual({ kind: 'team', cta: 'team' });
    expect(retireNextStep('guest', 'done')).toEqual({ kind: 'login', cta: 'login' });
    expect(retireNextStep('unknown', 'done')).toEqual({ kind: 'club', cta: 'club' });
    for (const a of ['member', 'guest', 'unknown'] as const) {
      expect(retireNextStep(a, 'pending')).toEqual({ kind: 'wait', cta: 'club' });
      expect(retireNextStep(a, 'sending')).toEqual({ kind: 'wait', cta: 'club' });
      expect(retireNextStep(a, 'rejected')).toEqual({ kind: 'blocked', cta: null });
    }
  });

  it('올라가지 않은 기록을 올라갔다고 말하지 않는다', () => {
    expect(retireNextText('wait')).not.toMatch(/올라갔어요/);
    expect(retireNextText('blocked')).not.toMatch(/올라갔어요/);
    expect(retireNextText('team')).toMatch(/올라갔어요/);
    expect(retireNextText('login')).toMatch(/로그인하면/);
    expect(retireCtaLabel('login')).toBe('로그인하고 팀 꾸리기');
  });

  it('계정 확인 결과를 member · guest · unknown으로 나눈다', () => {
    const p = (google: boolean, apple: boolean) => ({ id: 'x', linked: { google, apple } });
    expect(retireAccount(p(true, false))).toBe('member');
    expect(retireAccount(p(false, true))).toBe('member');
    expect(retireAccount(p(false, false))).toBe('guest');
    expect(retireAccount(null)).toBe('guest');
    expect(retireAccount(undefined)).toBe('unknown');
    expect(retireAccount('error')).toBe('unknown');
  });
});
