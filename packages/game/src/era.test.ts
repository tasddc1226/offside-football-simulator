import { afterEach, describe, expect, it } from 'vitest';
import { setLatestBalance } from './balance.js';
import { ERA_MAX_RIVALS } from './era.js';
import { POTY, TOP_SCORER } from './comps.js';
import { playCareer } from './__fixtures__/play-career.js';
import { rivalName } from './stories.js';
import type { GameState } from './types.js';

const N = 48;
const strip = (s: GameState) => JSON.stringify({ ...s, cid: '', era: undefined, bal: undefined });

describe('시대의 라이벌 (T-11-475)', () => {
  afterEach(() => setLatestBalance(null));

  it('라이벌이 있어도 내 커리어 결과(최종 상태 · RNG)는 꺼졌을 때와 같다', () => {
    for (let i = 0; i < N; i++) {
      setLatestBalance({ version: 1, values: { eraRival: 0 } });
      const off = playCareer(i);
      setLatestBalance(null);
      const on = playCareer(i);
      expect(off.era).toBeUndefined();
      expect(strip(on)).toBe(strip(off));
    }
  });

  it('같은 시드면 라이벌도 같다', () => {
    const a = playCareer(3).era,
      b = playCareer(3).era;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('라이벌은 내 포지션 · 비슷한 나이이고, 내가 받은 단독 상과 발롱 순위를 겹치지 않는다', () => {
    let seen = 0;
    for (let i = 0; i < N; i++) {
      const s = playCareer(i);
      if (!s.era) continue;
      seen++;
      const all = [...(s.era.past ?? []), s.era.cur];
      expect(all.length).toBeLessThanOrEqual(ERA_MAX_RIVALS);
      for (const v of all) {
        expect(v.pos).toBe(s.pos);
        expect(v.name).not.toBe(s.name);
        for (const x of v.seasons) {
          const mineBallon = s.ballon?.find((b) => b.year === x.year)?.rank;
          if (x.ballon && mineBallon) expect(x.ballon).not.toBe(mineBallon);
          const myLeague = s.career.find((r) => r.year === x.year)?.league;
          if (myLeague !== x.league) continue;
          const mine = s.awards.filter((a) => a.year === x.year).map((a) => a.t);
          for (const t of x.honors)
            if (
              Object.values(TOP_SCORER).includes(t) ||
              Object.values(POTY).includes(t) ||
              t === '발롱도르'
            )
              expect(mine).not.toContain(t);
        }
      }
      const first = all[0]!;
      const myBorn = s.career[0]!.year - s.career[0]!.age;
      expect(Math.abs(first.born - myBorn)).toBeLessThanOrEqual(1);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('이야기 이벤트의 라이벌도 시대의 라이벌과 같은 사람이다', () => {
    for (let i = 0; i < N; i++) {
      const s = playCareer(i);
      if (s.era && s.flags.rivalName) {
        expect(rivalName(s)).toBe((s.era.past?.[0] ?? s.era.cur).name);
        return;
      }
    }
  });
});
