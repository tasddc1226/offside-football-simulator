import { describe, expect, it } from 'vitest';
import { ATTR_KEYS, CLUBS, LAST_PHASE } from './data.js';
import { newGame, resolveChoice } from './engine.js';
import { createRng, setActiveRng } from './rng.js';
import { acceptOption, endSeason, market, retireAge, VETERAN_RENEW } from './season.js';
import { playPhase } from './turn.js';
import type { GameState } from './types.js';

// T-11-045 시즌별 은퇴 나이. 프리시즌 선수(retireAt 없음)는 예전처럼 41세에 은퇴하고, 시즌 1 선수(45)는 41~44세에
// 지난 시즌에 뛴 만큼 1년씩 더 뛸 수 있다.

const make = (seed: number, retireAt?: number) => {
  setActiveRng(createRng(seed));
  return newGame(
    {
      name: '은퇴',
      number: 9,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      retireAt,
    },
    seed,
  );
};

/** 한 시즌을 뛰어 커리어 기록을 하나 만든 뒤, K리그1 최약체 구단에서 계약이 끝난 그 나이 선수로 만든다. */
function veteran(
  age: number,
  retireAt: number | undefined,
  last: { apps: number; rating: number },
) {
  const s = make(11, retireAt);
  for (let ph = 0; ph <= LAST_PHASE; ph++) {
    s.training = 'rest';
    const { ev } = playPhase(s);
    if (ev) resolveChoice(s, ev, 0);
  }
  endSeason(s);
  const club = CLUBS.filter((c) => c.leagueId === 'k1').sort((a, b) => a.str - b.str)[0]!;
  s.leagueId = 'k1';
  s.club = { ...club };
  s.contract = { years: 0, salary: 1000 };
  for (const k of ATTR_KEYS) s.attrs[k] = 90;
  for (const k of Object.keys(s.sub)) s.sub[k] = 90;
  s.age = age;
  s.mil = { ...s.mil, served: true };
  Object.assign(s.career.at(-1)!, { mil: false, ...last });
  setActiveRng(createRng(5));
  return s;
}
const ok = { apps: VETERAN_RENEW.apps, rating: VETERAN_RENEW.rating };

describe('T-11-045 은퇴 나이', () => {
  it('새 선수에 시즌의 은퇴 나이를 고정한다 — 프리시즌 값이면 필드를 두지 않는다(예전과 같은 저장)', () => {
    expect(make(1, 45).retireAt).toBe(45);
    expect('retireAt' in make(1, 41)).toBe(false);
    expect('retireAt' in make(1)).toBe(false);
    expect(retireAge(make(1))).toBe(41);
  });

  it('은퇴 나이는 RNG를 쓰지 않는다 — 같은 시드면 능력치와 이후 추첨이 같다', () => {
    const a = make(3, 45),
      b = make(3);
    expect(a.attrs).toEqual(b.attrs);
    // 잠재력은 시즌 선수만 다른 평균·편차(T-11-093)로 뽑지만 같은 난수를 쓴다.
    expect(a.season.rivals).toEqual(b.season.rivals);
  });

  it('프리시즌 선수는 41세 시장에서 은퇴한다 — 제의가 없어서가 아니라 나이 때문이라고 알린다', () => {
    const m = market(veteran(41, undefined, ok));
    expect(m.options).toEqual([]);
    expect(m.note).toBe('41세가 되어 더 이상 현역으로 뛸 수 없습니다. 은퇴를 결정할 시간입니다.');
  });

  it('시즌 1 선수는 41세에 지난 시즌 기준을 채우면 1년 재계약을 고를 수 있다', () => {
    const m = market(veteran(41, 45, ok));
    const renew = m.options.find((o) => o.kind === 'renew');
    expect(renew).toMatchObject({ years: 1, desc: '베테랑 재계약' });
    expect(m.note).toContain('45세가 되면 은퇴합니다.');
    for (const o of m.options) if (o.kind === 'offer') expect(o.years).toBe(1);
  });

  it('지난 시즌 출전이나 평점이 모자라면 재계약이 없다', () => {
    for (const last of [
      { apps: VETERAN_RENEW.apps - 1, rating: 7.5 },
      { apps: 30, rating: VETERAN_RENEW.rating - 0.1 },
    ]) {
      const m = market(veteran(42, 45, last));
      expect(m.options.some((o) => o.kind === 'renew')).toBe(false);
    }
  });

  it('은퇴 나이가 되면 계약이 남아 있어도 은퇴하고, 그 이유를 알린다', () => {
    const s = veteran(45, 45, ok);
    s.contract = { years: 2, salary: 1000 };
    const m = market(s);
    expect(m.options).toEqual([]);
    expect(m.canRetire).toBe(true);
    expect(m.note).toBe('45세가 되어 더 이상 현역으로 뛸 수 없습니다. 은퇴를 결정할 시간입니다.');
  });

  it('끝까지 뛰면 프리시즌 선수는 40세, 시즌 1 선수는 44세가 마지막 시즌이다', () => {
    const lastAge = (retireAt?: number) => {
      let max = 0;
      for (let i = 0; i < 20; i++) {
        const s: GameState = make(1000 + i, retireAt);
        for (let y = 0; y < 30; y++) {
          for (let ph = 0; ph <= LAST_PHASE; ph++) {
            s.training = s.cond < 45 ? 'rest' : 'pac';
            const { ev } = playPhase(s);
            if (ev) resolveChoice(s, ev, 0);
          }
          endSeason(s);
          const m = market(s);
          const o = m.options.find((x) => x.kind === 'stay' || x.kind === 'renew') ?? m.options[0];
          if (!o) break;
          acceptOption(s, o, m.options);
        }
        max = Math.max(max, ...s.career.map((r) => r.age));
      }
      return max;
    };
    expect(lastAge()).toBe(40);
    const extended = lastAge(45);
    expect(extended).toBeGreaterThan(40);
    expect(extended).toBeLessThanOrEqual(44);
  }, 30_000); // 커리어 40개를 끝까지 돌린다 — CI(x64)에선 5초를 넘긴다
});
