// T-11-545 선수 만들기에서 무료로 고르는 외형(피부 · 머리색 · 머리 모양). 고르지 않은 항목은 커리어 ID로 정하는 기본 모습이다.
// 고른 항목은 꾸미기 가게(look-shop.ts)에서 산 것으로 쳐서 다시 팔지 않고, 커리어 중에 다른 모양으로 무료로 바꿀 수 있다.
// newGame(engine.ts)이 읽어 첫 화면 청크에 실리므로 꾸미기 표(look.ts · avatar-look)를 가져오지 않고 선택지 수만 적는다.
// 두 표와 같은지는 look.test.ts가 본다.
import type { LookState } from './types.js';

export const CREATE_LOOK_ITEMS = ['skin', 'hair', 'style'] as const;
export type CreateLookItem = (typeof CREATE_LOOK_ITEMS)[number];
export type CreateLook = Partial<Record<CreateLookItem, number>>;

/** 고를 수 있는 값의 수(look.ts LOOK_ITEMS options). 머리색의 마지막(12, 발롱도르 금빛)은 기록 아이템이라 뺀다. */
export const CREATE_LOOK_OPTIONS = { skin: 6, hair: 12, style: 15 } as const satisfies Record<
  CreateLookItem,
  number
>;

/** 만들기에서 고를 수 있는 값인가(기록 아이템 값은 칭호를 얻어야 산다). */
export const createLookValue = (item: CreateLookItem, v: number): boolean =>
  Number.isInteger(v) && v >= 0 && v < CREATE_LOOK_OPTIONS[item];

/** 만들기에서 고른 외형 → 새 커리어의 꾸미기 상태. 고른 것이 없거나 모두 잘못된 값이면 undefined(기본 모습). */
export function createLookState(pick: CreateLook | null | undefined): LookState | undefined {
  const items = CREATE_LOOK_ITEMS.filter((k) => {
    const v = pick?.[k];
    return v !== undefined && createLookValue(k, v);
  });
  if (!items.length) return undefined;
  return { owned: [...items], pick: Object.fromEntries(items.map((k) => [k, pick![k]!])) };
}
