// T-11-545 선수 만들기의 외형 고르기(웹 Create.svelte · 앱 screens/create/Create.tsx 공용).
// 피부 · 머리색 · 머리 모양만 무료로 고르고, 고른 항목은 새 커리어의 꾸미기에서 산 것으로 친다(game look.ts createLookState).
// 만들기 화면 청크에만 실리도록 칭호 · 가게 규칙(avatarLook.ts)을 가져오지 않는다.
import { LOOK_SWATCHES } from '@offside/game/avatar';
import {
  CREATE_LOOK_ITEMS,
  LOOK_ITEMS,
  createLookValue,
  type CreateLook,
  type CreateLookItem,
} from '@offside/game/look';
import { avatarLookText as L } from './i18n/ko/avatarLook';

/** 머리 모양 이름(game look.ts LOOK_STYLES 순서). 꾸미기 화면(avatarLook.ts)도 같이 쓴다. */
export const styleLabels = (): string[] => [
  L.styleShort,
  L.styleFringe,
  L.styleLong,
  L.styleMohawk,
  L.styleSlick,
  L.styleBuzz,
  L.styleAfro,
  L.styleBun,
  L.styleSpiky,
  L.styleBald,
  L.styleShaved,
  L.styleDread,
  L.styleFauxhawk,
  L.stylePonytail,
  L.styleMullet,
];

export interface CreateLookRow {
  item: CreateLookItem;
  name: string;
  /** 고른 값. null이면 기본 모습. */
  current: number | null;
  options: { value: number; label: string | null; swatch: string | null }[];
}

const NAME: Record<CreateLookItem, () => string> = {
  skin: () => L.itemSkin,
  hair: () => L.itemHair,
  style: () => L.itemStyle,
};

export const createLookRows = (look: CreateLook): CreateLookRow[] =>
  CREATE_LOOK_ITEMS.map((item) => ({
    item,
    name: NAME[item](),
    current: look[item] ?? null,
    options: Array.from({ length: LOOK_ITEMS[item].options }, (_, value) => value)
      .filter((value) => createLookValue(item, value))
      .map((value) =>
        item === 'style'
          ? { value, label: styleLabels()[value]!, swatch: null }
          : { value, label: null, swatch: LOOK_SWATCHES[item][value] ?? null },
      ),
  }));

/** 고른 값을 바꾼 새 외형(null이면 그 항목을 기본 모습으로 되돌린다). */
export function withCreateLook(
  look: CreateLook,
  item: CreateLookItem,
  value: number | null,
): CreateLook {
  const next: CreateLook = { ...look };
  if (value === null || !createLookValue(item, value)) delete next[item];
  else next[item] = value;
  return next;
}
