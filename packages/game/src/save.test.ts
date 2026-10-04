import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/save-fw26.json';
import { SUB_KEYS } from './attributes.js';
import { SAVE_VERSION } from './data.js';
import { leagueOf } from './engine.js';
import './event-registry.js';
import { createRng, rnd } from './rng.js';
import { loadSave, migrateSave } from './save.js';
import type { GameState } from './types.js';
import { acceptOption } from './season.js';

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
  it('T-11-054 옛 만료 제안은 총기간 그대로, 조기 제안은 추가기간을 포함해 복원한다', () => {
    for (const early of [false, true]) {
      const G = current();
      G.contract = { years: early ? 1 : 0, salary: 1000 };
      const option = {
        kind: 'renew' as const,
        name: '재계약',
        years: early ? 3 : 2,
        salary: 2000,
        desc: '',
        ...(early ? { extension: { years: 2, clubId: G.club.id, year: G.year } } : {}),
      };
      G.pending = {
        type: 'market',
        res: null,
        m: { options: [option], note: '', canRetire: false },
      };
      const saved = JSON.parse(JSON.stringify(G));
      const restored = loadSave(saved)!.G;
      expect(restored.pending).toEqual(G.pending);
      const p = restored.pending!;
      if (p.type !== 'market') throw new Error('market');
      const r = p.m!.options[0]!;
      if (!early) expect(r).not.toHaveProperty('extension');
      acceptOption(restored, r);
      expect(restored.contract).toEqual({ years: early ? 3 : 2, salary: 2000 });
    }
  });
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

  it('loadSave: 버전이 다르거나 없으면 버리고, 맞으면 고쳐서 돌려준다', () => {
    expect(loadSave(null)).toBeNull();
    expect(loadSave({ ...current(), v: 2 } as unknown as GameState)).toBeNull();
    expect(loadSave(legacy())).toMatchObject({ newCid: true });
  });

  it('T-10-066 이전 기록(클럽 id 없음)은 추측해 채우지 않고 그대로 읽는다 — 엠블럼은 이름으로 찾는다', () => {
    const G = current();
    expect(G.career.some((r) => 'clubId' in r)).toBe(false);
    migrateSave(G);
    expect(G.career.some((r) => 'clubId' in r)).toBe(false);
    expect(G.trophies.some((t) => 'clubId' in t)).toBe(false);
  });

  it('구단 이름이 바뀌었으면 현재 소속을 최신 이름으로', () => {
    const G = current();
    const name = G.club.name;
    G.club.name = '옛 이름';
    migrateSave(G);
    expect(G.club.name).toBe(name);
  });
});

describe('T-11-062 체육요원 저장 호환성', () => {
  it.each(['미필', '군필', '상무복무', '전환대기', '기존특례', '기존특례군필', '외국국적'])(
    '%s 옛 저장의 병역·국적·예약·계약·RNG를 보존하고 반복 이관은 동일하다',
    (kind) => {
      const G = current();
      if (kind === '군필' || kind === '기존특례군필') G.mil.served = true;
      if (kind === '상무복무' || kind === '전환대기') {
        G.mil.serving = true;
        G.mil.type = 'sangmu';
        G.mil.left = 2;
        G.mil.prevClub = {
          club: { ...G.club },
          leagueId: G.leagueId,
          contract: { ...G.contract! },
          abroad: false,
        };
      }
      if (['전환대기', '기존특례', '기존특례군필'].includes(kind))
        G.mil.exempt = '아시안게임 금메달';
      if (kind === '외국국적') G.nation = 'JP';
      Object.assign(G.mil, { applied: false, accepted: false, armyNext: false });
      const before = structuredClone(G);
      const loaded = loadSave(JSON.parse(JSON.stringify(G)))!.G;
      const expected = structuredClone(before);
      if (expected.mil.exempt) expected.mil.sportsService = { monthsLeft: null, lastYear: G.year };
      expect(loaded).toEqual(expected);
      expect(loadSave(JSON.parse(JSON.stringify(loaded)))!.G).toEqual(loaded);
    },
  );
});
