// T-11-191 꾸미기 가게: 항목 · 기록 아이템을 사고 고르는 규칙. 꾸미기 화면에서만 쓰므로, 그림(avatar.ts)이 읽어
// 첫 화면 청크에 실리는 look.ts와 따로 둔다.
import { LOOK_ITEMS, lookEditable, lookOwned, validValue } from './look.js';
import { salaryCost } from './training.js';
import type { GameState, LookItem, LookState } from './types.js';

/** 이 항목을 사는 값(만 원, 10 단위). */
export const lookCost = (s: GameState, item: LookItem): number =>
  salaryCost(s, LOOK_ITEMS[item].rate, LOOK_ITEMS[item].min);

/**
 * 기록 아이템: 칭호(titles.ts)를 얻으면 열리는 금빛 선택지. 항목의 마지막 선택지이고, 항목을 산 것과 따로 하나씩 산다.
 * 순서가 화면 순서다. id는 세이브(LookState.rec)에 남으니 바꾸지 않는다. titles 중 하나만 얻으면 열린다
 * (국가대표 데뷔는 한국 선수 '태극전사' · 외국 선수 '국가대표'로 나뉜다).
 */
export const LOOK_RECORDS = [
  { id: 'scorer-boots', item: 'boots', value: 10, titles: ['topscorer'] },
  { id: 'champ-band', item: 'band', value: 8, titles: ['champion'] },
  { id: 'nation-wrist', item: 'wrist', value: 6, titles: ['ntdebut', 'ntdebutx'] },
  { id: 'bigear-goggle', item: 'glasses', value: 6, titles: ['bigear'] },
  { id: 'ballon-hair', item: 'hair', value: 12, titles: ['ballon'] },
  { id: 'worldcup-socks', item: 'socks', value: 7, titles: ['worldchamp'] },
] as const satisfies readonly {
  id: string;
  item: LookItem;
  value: number;
  titles: readonly string[];
}[];
export type LookRecord = (typeof LOOK_RECORDS)[number];
export type LookRecordId = LookRecord['id'];
/** 이 값이 기록 아이템이면 그 정의. */
export const lookRecordOf = (item: LookItem, value: number): LookRecord | undefined =>
  LOOK_RECORDS.find((r) => r.item === item && r.value === value);

/** 항목을 사면 고를 수 있는 값(기록 아이템 값은 따로 산다). */
export const plainValue = (item: LookItem, v: number) =>
  validValue(item, v) && !lookRecordOf(item, v);

/** 항목을 산다. 은퇴했거나 이미 샀거나 자금이 모자라면 false(상태를 바꾸지 않는다). 사면 고른 값은 value(없으면 0)다. */
export function buyLook(s: GameState, item: LookItem, value = 0): boolean {
  if (!lookEditable(s) || lookOwned(s, item)) return false;
  const cost = lookCost(s, item);
  if (s.money < cost || !plainValue(item, value)) return false;
  s.money -= cost;
  const look: LookState = s.look ?? { owned: [], pick: {} };
  look.owned.push(item);
  look.pick[item] = value;
  s.look = look;
  return true;
}

/** 산 항목의 모양을 바꾼다(무료). 은퇴했거나 사지 않았거나 없는 값 · 기록 아이템 값이면 false. */
export function setLook(s: GameState, item: LookItem, value: number): boolean {
  if (!lookEditable(s) || !lookOwned(s, item) || !plainValue(item, value)) return false;
  s.look!.pick[item] = value;
  return true;
}

/** 기록 아이템 값: 연봉 × 0.5, 최소 1,000만. */
const RECORD_PRICE = { rate: 0.5, min: 1000 };

export const lookRecordCost = (s: GameState): number =>
  salaryCost(s, RECORD_PRICE.rate, RECORD_PRICE.min);
/** 칭호를 얻어 살 수 있게 열렸나. */
export const lookRecordOpen = (s: GameState, r: LookRecord): boolean =>
  !!s.titles?.some((t) => (r.titles as readonly string[]).includes(t.id));
export const lookRecordOwned = (s: GameState, r: LookRecord): boolean =>
  !!s.look?.rec?.includes(r.id);
/** 이 기록 아이템을 지금 입고 있나. */
export const lookRecordWorn = (s: GameState, r: LookRecord): boolean =>
  s.look?.pick[r.item] === r.value;

/** 기록 아이템을 사서 바로 입는다. 은퇴했거나 칭호가 없거나 이미 샀거나 자금이 모자라면 false. */
export function buyLookRecord(s: GameState, r: LookRecord): boolean {
  if (!lookEditable(s) || !lookRecordOpen(s, r) || lookRecordOwned(s, r)) return false;
  const cost = lookRecordCost(s);
  if (s.money < cost) return false;
  s.money -= cost;
  const look: LookState = s.look ?? { owned: [], pick: {} };
  (look.rec ??= []).push(r.id);
  look.pick[r.item] = r.value;
  s.look = look;
  return true;
}

/** 산 기록 아이템을 입거나 벗는다(무료). 벗으면 그 항목을 산 경우 첫 선택지, 아니면 기본 모습으로 돌아간다. */
export function wearLookRecord(s: GameState, r: LookRecord, on: boolean): boolean {
  if (!lookEditable(s) || !lookRecordOwned(s, r)) return false;
  const look = s.look!;
  if (on) look.pick[r.item] = r.value;
  else if (look.pick[r.item] === r.value) {
    if (lookOwned(s, r.item)) look.pick[r.item] = 0;
    else delete look.pick[r.item];
  }
  return true;
}
