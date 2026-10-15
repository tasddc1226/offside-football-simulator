// T-11-191 도트 선수 꾸미기 화면 값(웹 AvatarLook.svelte · 앱 screens/game/AvatarLook.tsx 공용).
// 진행 중 가게 규칙(가격 · 구매)은 game look.ts, 그림 색은 game avatar.ts에 있다.
import { LOOK_SWATCHES, avatarSpec } from '@offside/game/avatar';
import { LOOK_BEARDS, LOOK_ITEMS, LOOK_ORDER, LOOK_STYLES, lookOwned } from '@offside/game/look';
import {
  lookRecordCost,
  lookRecordOpen,
  lookRecordOwned,
  lookRecordWorn,
  LOOK_RECORDS,
  lookCost,
  plainValue,
  type LookRecord,
  type LookRecordId,
} from '@offside/game/look-shop';
import { tn } from '@offside/game/i18n/names';
import { titleById } from '@offside/game/titles';
import { fmtMoney } from '@offside/game/player';
import type { GameState, LookItem, LookState } from '@offside/game/types';
import { appFormatText as W } from './i18n/ko/appFormat';
import { avatarLookText as L } from './i18n/ko/avatarLook';
import { avatarRecordText as R } from './i18n/ko/avatarRecord';

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
    gloves: L.itemGloves,
    keeperKit: L.itemKeeperKit,
    kneePads: L.itemKneePads,
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
  L.styleBald,
  L.styleShaved,
  L.styleDread,
  L.styleFauxhawk,
  L.stylePonytail,
  L.styleMullet,
];
const BEARD_LABEL = () => [L.none, L.beardStubble, L.beardFull];
const EXPR_LABEL = () => [L.exprBase, L.exprHappy, L.exprWink];

export function optionsOf(item: LookItem): LookOption[] {
  const n = LOOK_ITEMS[item].options;
  // 기록 아이템 값은 아래 기록 아이템 칸에서 따로 산다.
  return Array.from({ length: n }, (_, value) => value)
    .filter((value) => plainValue(item, value))
    .map((value) => {
      if (item === 'style') return { value, label: STYLE_LABEL()[value]!, swatch: null };
      if (item === 'beard') return { value, label: BEARD_LABEL()[value]!, swatch: null };
      if (item === 'expr') return { value, label: EXPR_LABEL()[value]!, swatch: null };
      const swatch = LOOK_SWATCHES[item][value] ?? null;
      const empty = item === 'socks' ? L.socksTeam : item === 'keeperKit' ? L.kitClub : L.none;
      return { value, label: swatch ? null : empty, swatch };
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

export const RECORD_NAME = (): Record<LookRecordId, string> => ({
  'scorer-boots': R.recScorerBoots,
  'champ-band': R.recChampBand,
  'nation-wrist': R.recNationWrist,
  'bigear-goggle': R.recBigearGoggle,
  'ballon-hair': R.recBallonHair,
  'worldcup-socks': R.recWorldcupSocks,
});

export interface LookRecordRow {
  r: LookRecord;
  name: string;
  swatch: string | null;
  /** 칭호를 얻어 살 수 있다. */
  open: boolean;
  owned: boolean;
  worn: boolean;
  /** 열리는 조건(칭호 이름). */
  need: string;
  cost: number;
  costText: string;
}

/** 이 선수가 얻을 수 있는 열쇠 칭호의 이름(국가대표는 국적에 따라 '태극전사' · '국가대표'). */
function needTitle(s: GameState, r: LookRecord): string {
  const defs = r.titles.map((id) => titleById(id)).filter((d) => !!d);
  return (defs.find((d) => !d.avail || d.avail(s)) ?? defs[0])?.name ?? r.titles[0];
}

/** 기록 아이템 칸(칭호를 얻으면 열리는 금빛 선택지). */
export function lookRecordRows(s: GameState): LookRecordRow[] {
  const cost = lookRecordCost(s);
  const names = RECORD_NAME();
  return LOOK_RECORDS.map((r) => ({
    r,
    name: names[r.id],
    swatch:
      (LOOK_SWATCHES as Record<string, readonly (string | null)[]>)[r.item]?.[r.value] ?? null,
    open: lookRecordOpen(s, r),
    owned: lookRecordOwned(s, r),
    worn: lookRecordWorn(s, r),
    need: R.recNeed({ title: tn(needTitle(s, r)) }),
    cost,
    costText: W.won({ v: fmtMoney(cost) }),
  }));
}

/** 미리보기: 기록 아이템을 입혀 본 상태(원본은 바꾸지 않는다). */
export function lookRecordPreview(s: GameState, r: LookRecord): GameState {
  return {
    ...s,
    look: { owned: s.look?.owned ?? [], pick: { ...s.look?.pick, [r.item]: r.value } },
  };
}
