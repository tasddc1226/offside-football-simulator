import { SeasonGrowthSchema } from '@offside/contracts';
import * as g from '@offside/game/index';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import type { GameState } from '@offside/game/types';
import { describe, expect, it } from 'vitest';
import { takeSeasonGrowth } from './growth.js';
import { createMomentDriver, momentHooks } from './keyMoments.js';

/** 전반기 장면이 걸린 커리어를 찾아 구간 전 상태 · 난수와 첫 진행 결과를 돌려준다. */
function league(pos: g.Pos = 'FW') {
  for (let seed = 1; seed < 50; seed++) {
    setActiveRng(createRng(seed));
    const s = g.newGame(
      { name: 'T', number: 9, pos, foot: '오른발', type: g.TYPES[pos][0]!.id, trait: 'late' },
      seed,
    );
    s.cid = `km-${pos}-${seed}`;
    Object.assign(s, { trust: 95, cond: 100 });
    g.playPhase(s);
    const pre = JSON.stringify(s);
    const rng = getActiveRng().getState().seed;
    const first = g.playPhase(s, momentHooks(s));
    if (first.block?.moment) return { s, pre, rng, first };
  }
  throw new Error('장면이 걸린 커리어가 없다');
}

const driver = (x: ReturnType<typeof league>) => {
  let saves = 0;
  const d = createMomentDriver({
    s: x.s,
    first: x.first,
    rows: [],
    extras: [],
    pre: x.pre,
    rng: x.rng,
    settle: () => saves++,
    lines: () => ({ rows: [], extras: [] }),
  });
  return { d, saves: () => saves };
};

describe('T-11-394 결정적 장면 기록', () => {
  it('고른 선택지 · 확률 · 결과를 세이브 버퍼에 남기고 저장한다', () => {
    const x = league();
    const { d, saves } = driver(x);
    const m = x.first.block!.moment!;
    const card = d.atGame(m.game!)!;
    const pick = card.choices[0]!;
    const res = d.decide(card.key, pick.id);
    const mb = d.cur.block!.moment!;
    expect(x.s.momentBuf).toEqual([
      {
        ph: 1,
        at: 'l',
        sit: expect.any(String),
        c: pick.id,
        b: Math.round(mb.base * 100),
        p: pick.pct,
        ok: res.ok,
      },
    ]);
    expect(saves()).toBe(1);
  });

  it('맡기기는 auto, 시간 초과는 to로 남는다', () => {
    for (const [choice, c] of [
      ['auto', 'auto'],
      [null, 'to'],
    ] as const) {
      const x = league('GK');
      const { d, saves } = driver(x);
      const card = d.atGame(x.first.block!.moment!.game!)!;
      d.decide(card.key, choice);
      expect(x.s.momentBuf).toMatchObject([{ c, at: 'l', p: card.auto, b: card.auto }]);
      expect(saves()).toBe(0); // 상태가 그대로라 다음 저장 때 함께 저장된다.
    }
  });

  it('시즌 업로드 성장 기록에 실려 계약을 통과하고 버퍼는 비운다', () => {
    const x = league('MF');
    const { d } = driver(x);
    const card = d.atGame(x.first.block!.moment!.game!)!;
    d.decide(card.key, card.choices.at(-1)!.id);
    const s: GameState = x.s;
    const growth = takeSeasonGrowth(s)!;
    expect(growth.km).toHaveLength(1);
    expect(SeasonGrowthSchema.safeParse(growth).success).toBe(true);
    expect(s.momentBuf).toEqual([]);
  });
});
