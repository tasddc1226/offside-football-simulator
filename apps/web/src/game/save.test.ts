import { describe, expect, it } from 'vitest';
import fixture from '../../e2e/fixtures/save-fw26.json';
import { SUB_KEYS } from './attributes.js';
import { leagueOf } from './engine.js';
import './event-registry.js';
import { createRng, rnd } from './rng.js';
import { migrateSave, SAVE_VERSION } from './save.js';
import type { GameState } from './types.js';

// T-10-046: 저장본 마이그레이션. 지금 형식의 저장본은 그대로 두고, 옛 형식은 빠진 필드를 채운다.
// 저장 형식을 바꾸면 여기에 그 이전 형식의 사례를 더한다.

const current = (): GameState => structuredClone(fixture) as unknown as GameState;

/** 지금 저장본에서 형식 도입 순서대로 필드를 뺀 옛 저장본. */
function legacy(edit: (g: Record<string, unknown>) => void = () => {}): GameState {
  const g = current() as unknown as Record<string, unknown>;
  for (const k of ['rng', 'sub', 'seasonStartSub', 'bloom', 'halves', 'cid', 'titles']) delete g[k];
  edit(g);
  return g as unknown as GameState;
}

describe('migrateSave (T-10-046)', () => {
  it('지금 형식의 저장본은 바꾸지 않고, 저장된 시드로 RNG를 되돌린다', () => {
    expect(current().v).toBe(SAVE_VERSION);
    const G = current();
    expect(migrateSave(G)).toEqual({ newCid: false });
    expect(G).toEqual(current());
    const expected = createRng(G.rng!.seed);
    expect([rnd(), rnd(), rnd()]).toEqual([expected.next(), expected.next(), expected.next()]);
  });

  it('옛 저장본: 시드·세부 능력치·bloom·전후반기·커리어 ID·칭호를 채운다', () => {
    const G = legacy((g) => {
      g.phase = 5;
      g.chains = [{ id: 'rival-3', at: 25, until: 30 }];
    });
    expect(migrateSave(G)).toEqual({ newCid: true });
    expect(typeof G.rng!.seed).toBe('number');
    expect(Object.keys(G.sub).sort()).toEqual([...SUB_KEYS].sort());
    expect(G.seasonStart).toEqual(G.attrs);
    expect(G.seasonStartSub).toEqual(G.sub);
    expect(G.bloom).toBe(0);
    expect(G.halves).toBe(1);
    expect(G.phase).toBe(3);
    expect(G.chains).toEqual([{ id: 'rival-3', at: 15, until: 18 }]);
    expect(G.cid).toMatch(/^[0-9a-f-]{36}$/);
    expect(Array.isArray(G.titles)).toBe(true);
  });

  it('4구간 저장본의 시즌 중간 구간은 치른 경기 수로 전반기/후반기를 정한다', () => {
    const tot = leagueOf(current().leagueId).matches;
    const at = (phase: number, played: number) => {
      const G = legacy((g) => {
        g.phase = phase;
        (g.season as { played: number }).played = played;
      });
      migrateSave(G);
      return G.phase;
    };
    expect(at(0, 0)).toBe(0);
    expect(at(2, tot / 2 - 1)).toBe(1);
    expect(at(3, tot / 2)).toBe(2);
    expect(at(5, tot)).toBe(3);
  });

  it('구단 이름이 바뀌었으면 현재 소속을 최신 이름으로', () => {
    const G = current();
    const name = G.club.name;
    G.club.name = '옛 이름';
    migrateSave(G);
    expect(G.club.name).toBe(name);
  });
});
