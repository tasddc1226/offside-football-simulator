// T-11-191 도트 선수 꾸미기 화면 값(웹 AvatarLook.svelte · 앱 screens/game/AvatarLook.tsx 공용).
// 규칙(가격 · 구매 · 은퇴 뒤 잠금)은 game look.ts, 그림 색은 game avatar.ts에 있다.
import { LOOK_SWATCHES, avatarSpec } from '@offside/game/avatar';
import {
  LOOK_BEARDS,
  LOOK_ITEMS,
  LOOK_ORDER,
  LOOK_STYLES,
  lookCost,
  lookOwned,
} from '@offside/game/look';
import { fmtMoney } from '@offside/game/player';
import type { GameState, LookItem, LookState } from '@offside/game/types';
import { appFormatText as W } from './i18n/ko/appFormat';
import { avatarLookText as L } from './i18n/ko/avatarLook';

export interface LookOption {
  value: number;
  /** 글자 선택지(머리 모양 · 수염 · '없음'). 색 선택지면 null. */
  label: string | null;
  swatch: string | null;
}
export interface LookRow {
  item: LookItem;
  name: string;
  owned: boolean;
  cost: number;
  costText: string;
  /** 지금 그림에 보이는 값(산 항목은 고른 값, 아니면 기본 모습). */
  current: number;
  options: LookOption[];
}

export const lookItemName = (item: LookItem): string =>
  ({
    skin: L.itemSkin,
    hair: L.itemHair,
    beard: L.itemBeard,
    style: L.itemStyle,
    expr: L.itemExpr,
    band: L.itemBand,
    wrist: L.itemWrist,
    glasses: L.itemGlasses,
    boots: L.itemBoots,
    socks: L.itemSocks,
  })[item];

const STYLE_LABEL = () => [
  L.styleShort,
  L.styleFringe,
  L.styleLong,
  L.styleMohawk,
  L.styleSlick,
  L.styleBuzz,
  L.styleAfro,
  L.styleBun,
  L.styleSpiky,
];
const BEARD_LABEL = () => [L.none, L.beardStubble, L.beardFull];
const EXPR_LABEL = () => [L.exprBase, L.exprHappy, L.exprWink];

function optionsOf(item: LookItem): LookOption[] {
  const n = LOOK_ITEMS[item].options;
  return Array.from({ length: n }, (_, value) => {
    if (item === 'style') return { value, label: STYLE_LABEL()[value]!, swatch: null };
    if (item === 'beard') return { value, label: BEARD_LABEL()[value]!, swatch: null };
    if (item === 'expr') return { value, label: EXPR_LABEL()[value]!, swatch: null };
    const swatch = LOOK_SWATCHES[item][value] ?? null;
    return { value, label: swatch ? null : item === 'socks' ? L.socksTeam : L.none, swatch };
  });
}

/** 꾸미기를 안 한 항목의 지금 값(기본 모습에서 읽는다). */
function currentOf(s: GameState, item: LookItem): number {
  const picked = s.look?.pick[item];
  if (picked !== undefined) return picked;
  const sp = avatarSpec(s);
  switch (item) {
    case 'skin':
      return sp.look.skin;
    case 'hair':
      return sp.look.hair;
    case 'style':
      return Math.max(0, LOOK_STYLES.indexOf(sp.hairStyle as (typeof LOOK_STYLES)[number]));
    case 'beard':
      return Math.max(0, LOOK_BEARDS.indexOf(sp.beard));
    default:
      return 0;
  }
}

export const lookRows = (s: GameState): LookRow[] =>
  LOOK_ORDER.map((item) => {
    const cost = lookCost(s, item);
    return {
      item,
      name: lookItemName(item),
      owned: lookOwned(s, item),
      cost,
      costText: W.won({ v: fmtMoney(cost) }),
      current: currentOf(s, item),
      options: optionsOf(item),
    };
  });

/** 미리보기: 사기 전에 고른 값을 입힌 상태(원본은 바꾸지 않는다). */
export function lookPreview(s: GameState, item: LookItem, value: number): GameState {
  const look: LookState = {
    owned: [...(s.look?.owned ?? []), item],
    pick: { ...s.look?.pick, [item]: value },
  };
  return { ...s, look };
}
