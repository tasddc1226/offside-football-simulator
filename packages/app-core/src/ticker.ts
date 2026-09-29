// T-10-122 홈 전광판에 흘릴 줄을 만든다. 서버가 따로 준 이적·최초 기록(각각 최신순)을 이적 3줄마다 기록 1줄씩
// 섞는다 — 기록은 드물고 오래돼 시각순으로만 섞으면 맨 뒤로 밀린다.
import type { TickerFirst, TickerResponse, TickerTransfer } from '@offside/contracts';
import { isAmateurClubId } from '@offside/contracts/club-names';
import { anonName } from './format.js';

export type TickerItem =
  | {
      key: string;
      kind: 'transfer' | 'debut';
      at: string;
      who: string;
      age: number;
      from: string;
      to: string;
    }
  | { key: string; kind: 'first' | 'record'; at: string; who: string; text: string };

const who = (x: { name: string | null; pos: TickerTransfer['pos']; number: number | null }) =>
  x.name ?? anonName(x.pos, x.number);

const transferItem = (t: TickerTransfer): TickerItem => ({
  key: `t:${t.at}:${t.toClubId}`,
  kind: isAmateurClubId(t.fromClubId) ? 'debut' : 'transfer',
  at: t.at,
  who: who(t),
  age: t.age,
  from: t.fromClubId,
  to: t.toClubId,
});
const firstItem = (f: TickerFirst): TickerItem => ({
  key: `f:${f.id}:${f.at}`,
  kind: f.kind,
  at: f.at,
  who: who(f),
  text: f.kind === 'record' ? `${f.label} ${f.value}${f.unit ?? ''}` : f.label,
});

const EVERY = 3;

export function tickerItems(d: Pick<TickerResponse, 'transfers' | 'firsts'>): TickerItem[] {
  const out: TickerItem[] = [];
  const firsts = d.firsts.map(firstItem);
  d.transfers.forEach((t, i) => {
    out.push(transferItem(t));
    if ((i + 1) % EVERY === 0 && firsts.length) out.push(firsts.shift()!);
  });
  return [...out, ...firsts];
}
