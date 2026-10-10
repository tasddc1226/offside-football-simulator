import { CUP_KO_ROUNDS, type CupRound } from '@offside/contracts/cup';
import type { CupMatch } from './api/cup';

export const BRACKET = { cardWidth: 224, column: 264, cardHeight: 112, pitch: 136, header: 44 };
export interface BracketNode {
  round: CupRound;
  slot: number;
  x: number;
  y: number;
  height: number;
  compact: boolean;
  match: CupMatch | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
}
export interface BracketConnector {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
/** UI-only future slots. The server creates actual matches after each completed round. */
export function cupBracket(matches: readonly CupMatch[], active = 0) {
  const start = CUP_KO_ROUNDS.findIndex((r) => matches.some((m) => m.round === r));
  if (start < 0)
    return {
      rounds: [],
      nodes: [],
      paths: [],
      connectors: [] as BracketConnector[],
      width: 0,
      height: 0,
      viewportHeight: 0,
    };
  const rounds = CUP_KO_ROUNDS.slice(start);
  // Naver-style focus: 16-team view halves the spacing; QF and later share a compact tree.
  const base = Math.min(Math.max(0, active), Math.max(0, rounds.indexOf('qf')));
  const viewportHeight =
    base === 0 && rounds.length > 3 ? 640 : base < 2 && rounds.length > 3 ? 640 : 520;
  const nodes: BracketNode[] = [];
  const paths: string[] = [];
  const connectors: BracketConnector[] = [];
  const count = 2 ** (rounds.length - 1);
  const lookup = new Map(matches.map((m) => [`${m.round}:${m.slot}`, m]));
  rounds.forEach((round, column) => {
    const compact = column < base;
    const height = compact ? 56 : BRACKET.cardHeight;
    const step = compact ? 68 : BRACKET.pitch * 2 ** (column - base);
    for (let slot = 0; slot < count / 2 ** column; slot++) {
      const match = lookup.get(`${round}:${slot}`) ?? null;
      const prev = rounds[column - 1];
      const winner = (s: number) => {
        const m = lookup.get(`${prev}:${s}`);
        return m?.played ? m.winnerTeamId : null;
      };
      nodes.push({
        round,
        slot,
        match,
        x: column * BRACKET.column,
        y: BRACKET.header + step * (slot + 0.5) - height / 2,
        height,
        compact,
        homeTeamId: match ? match.homeTeamId : column ? winner(slot * 2) : null,
        awayTeamId: match ? match.awayTeamId : column ? winner(slot * 2 + 1) : null,
      });
    }
  });
  for (const n of nodes) {
    const column = rounds.indexOf(n.round);
    if (column === rounds.length - 1) continue;
    const next = nodes.find(
      (t) => t.round === rounds[column + 1] && t.slot === Math.floor(n.slot / 2),
    )!;
    const x = n.x + BRACKET.cardWidth;
    const y = n.y + n.height / 2;
    const mid = x + (BRACKET.column - BRACKET.cardWidth) / 2;
    const endY = next.y + next.height / 2;
    const path = `M ${x} ${y} H ${mid} V ${endY} H ${next.x}`;
    paths.push(path);
    // Native SVG allocates a bitmap for its entire bounds: keep each connector narrow.
    connectors.push({
      path,
      x: x - 2,
      y: Math.min(y, endY) - 2,
      width: next.x - x + 4,
      height: Math.abs(endY - y) + 4,
    });
  }
  return {
    rounds,
    nodes,
    paths,
    connectors,
    width: rounds.length * BRACKET.column - 40,
    height: Math.max(...nodes.map((n) => n.y + n.height)) + 24,
    viewportHeight,
  };
}
