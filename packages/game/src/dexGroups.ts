// 확률 도감(T-10-012) 분류. 이벤트를 볼 때마다 쓰는 가벼운 부분만 따로 둬서, 확률 분석(eventDex.ts)은
// 도감 화면을 열 때만 불러온다.
import type { Pos } from './data.js';
import type { EventDef } from './types.js';

export type DexGroup = 'career' | 'position' | 'story' | 'special';
export const DEX_GROUPS: { id: DexGroup; name: string; hidden: boolean }[] = [
  { id: 'career', name: '커리어', hidden: false },
  { id: 'position', name: '포지션', hidden: false },
  { id: 'story', name: '스토리', hidden: true },
  { id: 'special', name: '특별', hidden: true },
];

const POS_PREFIX: Record<string, Pos> = { fw: 'FW', mf: 'MF', df: 'DF', gk: 'GK' };
export const posOf = (ev: EventDef): Pos | null => POS_PREFIX[ev.id.split('-')[0]!] ?? null;
export const groupOf = (ev: EventDef): DexGroup =>
  ev.story ? 'story' : ev.chain ? 'special' : posOf(ev) ? 'position' : 'career';
/** 겪기 전에는 제목·선택지를 가리는 이벤트(스포일러 보호). */
export const isHiddenEvent = (ev: EventDef): boolean =>
  DEX_GROUPS.find((g) => g.id === groupOf(ev))!.hidden;
