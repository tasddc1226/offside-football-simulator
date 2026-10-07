import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicHofEntry } from '@offside/contracts';
import { newGame } from '@offside/game/engine';
import { createRng, setActiveRng } from '@offside/game/rng';
import { retire } from '@offside/game/season';
import { honoursRoll } from '@offside/game/retirement-report';
import { setStorage } from '@offside/game/storage';
import { createLegends } from './legend.js';
import { initialAppState } from './state.js';

vi.mock('./api/client.js', () => ({
  getMyCareers: vi.fn(async () => ({ ok: true, data: { entries: [] } })),
  getHofDetail: vi.fn(),
}));

beforeEach(() => {
  const store = new Map<string, string>();
  setStorage({
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
  });
  setActiveRng(createRng(7));
});

function host() {
  const state = initialAppState();
  const legends = createLegends({
    state,
    rnOf: () => null,
    toast: vi.fn(),
    uploadRetirement: vi.fn(),
    scrollTop: vi.fn(),
  });
  return { state, legends };
}

function game(wins: number) {
  const s = newGame(
    { name: '수상', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    7,
  );
  s.age = 30;
  s.awards = Array.from({ length: 8 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => ({ year: 2030 + j, t: `other-${i}` })),
  )
    .flat()
    .concat(Array.from({ length: wins }, (_, i) => ({ year: 2030 + i, t: '발롱도르' })));
  s.ballon = [{ year: 2030, rank: 2 }];
  return s;
}

describe('은퇴 리포트 발롱도르 통산 횟수', () => {
  for (const wins of [0, 1, 2]) {
    it(`${wins}회 수상은 개인상 상위 8종과 후보 횟수에 관계없이 별도 통산에 남는다`, () => {
      const s = game(wins);
      expect(
        honoursRoll(s.awards)
          .slice(0, 8)
          .some((a) => a.name === '발롱도르'),
      ).toBe(false);
      const { legends } = host();
      expect(legends.viewFromGame(s).totals.ballon).toBe(wins);
      const h = retire(s);
      expect(legends.viewFromEntry(h).totals.ballon).toBe(wins);
      delete h.detail;
      expect(legends.viewFromEntry(h).totals.ballon).toBe(wins);
    });
  }

  it('통산 필드가 없는 옛 로컬 은퇴 기록은 상세의 실제 수상 기록을 사용한다', () => {
    const h = retire(game(2));
    const legacy = structuredClone(h);
    Reflect.deleteProperty(legacy, 'ballon');
    expect(host().legends.viewFromEntry(legacy).totals.ballon).toBe(2);
    delete legacy.detail;
    expect(host().legends.viewFromEntry(legacy).totals.ballon).toBe(0);
  });

  it('상세가 없는 공개 은퇴 기록도 서버 요약의 횟수를 전달한다', async () => {
    const h = retire(game(2));
    const e: PublicHofEntry = {
      id: 'public-other',
      name: h.name,
      pos: h.pos,
      number: h.number,
      retireAge: h.age,
      peak: h.peak,
      legendScore: h.score,
      apps: h.apps,
      goals: h.goals,
      assists: h.assists,
      trophies: h.trophies,
      awards: h.awards,
      caps: h.caps,
      ballon: h.ballon,
      lastClub: h.lastClub,
      retiredAt: '2026-10-07T00:00:00.000Z',
      hasDetail: false,
      title: null,
    };
    const { state, legends } = host();
    await legends.openPublicLegend(e);
    expect(state.legend?.d).toBeNull();
    expect(state.legend?.totals.ballon).toBe(2);
  });
});
