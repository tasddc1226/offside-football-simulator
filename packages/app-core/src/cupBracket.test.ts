import { describe, expect, it } from 'vitest';
import { cupBracket, BRACKET } from './cupBracket';
import type { CupMatch } from './api/cup';
const fixture = (slot: number, extra: Partial<CupMatch> = {}): CupMatch => ({
  id: `m${slot}`,
  round: 'r32',
  group: null,
  slot,
  homeTeamId: `h${slot}`,
  awayTeamId: `a${slot}`,
  at: '2026-10-11T12:00:00.000Z',
  played: false,
  homeGoals: null,
  awayGoals: null,
  pens: null,
  winnerTeamId: null,
  forfeit: false,
  ...extra,
});
describe('cup bracket progression', () => {
  it('places all 31 slots and routes adjacent fixtures into the correct next slot', () => {
    const tree = cupBracket(Array.from({ length: 16 }, (_, slot) => fixture(slot)));
    expect(tree.rounds).toEqual(['r32', 'r16', 'qf', 'sf', 'f']);
    expect(tree.nodes).toHaveLength(31);
    expect(tree.paths).toHaveLength(30);
    const parents = tree.nodes.filter((n) => n.round === 'r16');
    expect(parents[0]!.y).toBe((tree.nodes[0]!.y + tree.nodes[1]!.y) / 2);
    expect(parents[7]!.y).toBe((tree.nodes[14]!.y + tree.nodes[15]!.y) / 2);
    expect(
      tree.nodes.every((n) => n.y >= BRACKET.header && n.y + BRACKET.cardHeight <= tree.height),
    ).toBe(true);
  });
  it('keeps native connector bitmaps below Android canvas limits at high display density', () => {
    const matches = Array.from({ length: 16 }, (_, slot) => fixture(slot));
    for (let active = 0; active < 5; active++) {
      const tree = cupBracket(matches, active);
      expect(tree.connectors.map((line) => line.path)).toEqual(tree.paths);
      for (const line of tree.connectors) {
        expect(line.width).toBeGreaterThan(0);
        expect(line.height).toBeGreaterThan(0);
        // Four bytes per pixel, even at 4x density: each surface stays under 4 MB.
        expect(line.width * line.height * 4 * 4 ** 2).toBeLessThan(4_000_000);
      }
    }
  });
  it('advances the recorded penalty or forfeit winner, never the higher goals or an unplayed pick', () => {
    const tree = cupBracket([
      fixture(0, {
        played: true,
        homeGoals: 1,
        awayGoals: 1,
        pens: { home: 3, away: 4 },
        winnerTeamId: 'a0',
      }),
      fixture(1, { winnerTeamId: 'h1' }),
    ]);
    const next = tree.nodes.find((n) => n.round === 'r16' && n.slot === 0)!;
    expect(next.match).toBeNull();
    expect(next.homeTeamId).toBe('a0');
    expect(next.awayTeamId).toBeNull();
  });
  it('supports smaller tournaments and preserves actual next-round identities', () => {
    const final = fixture(0, {
      id: 'final',
      round: 'f',
      homeTeamId: 'winnerA',
      awayTeamId: 'winnerB',
    });
    const tree = cupBracket([fixture(0, { round: 'sf' }), fixture(1, { round: 'sf' }), final]);
    expect(tree.rounds).toEqual(['sf', 'f']);
    expect(tree.nodes).toHaveLength(3);
    expect(tree.nodes.at(-1)!.match).toBe(final);
    expect(tree.nodes.at(-1)!.homeTeamId).toBe('winnerA');
    expect(cupBracket([fixture(0, { round: 'g1' })]).nodes).toEqual([]);
  });
  it('reflows around the selected round and caps the compact layout at the quarter-finals', () => {
    const matches = Array.from({ length: 16 }, (_, slot) => fixture(slot));
    const initial = cupBracket(matches, 0);
    const r16 = cupBracket(matches, 1);
    const qf = cupBracket(matches, 2);
    const final = cupBracket(matches, 4);
    expect(initial.viewportHeight).toBe(640);
    expect(qf.viewportHeight).toBe(520);
    expect(
      r16.nodes.filter((n) => n.round === 'r32').every((n) => n.compact && n.height === 56),
    ).toBe(true);
    expect(r16.nodes.find((n) => n.round === 'r16')!.y).toBe(initial.nodes[0]!.y);
    expect(qf.nodes.find((n) => n.round === 'qf')!.y).toBe(initial.nodes[0]!.y);
    expect(final.nodes.map((n) => [n.x, n.y, n.height])).toEqual(
      qf.nodes.map((n) => [n.x, n.y, n.height]),
    );
    for (const tree of [initial, r16, qf, final]) {
      for (const round of ['r32', 'r16', 'qf', 'sf']) {
        const nodes = tree.nodes.filter((n) => n.round === round);
        expect(
          nodes.every((n, i) => i === 0 || n.y >= nodes[i - 1]!.y + nodes[i - 1]!.height),
        ).toBe(true);
      }
      expect(tree.paths).toHaveLength(30);
    }
  });
});
