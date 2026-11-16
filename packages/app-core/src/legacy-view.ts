// T-11-733 은퇴 유산(웹·앱 공용). 규칙은 game legacy.ts, 여기는 선수 탭 카드 · 은퇴 확인 · 은퇴 리포트 문구만 만든다.
import {
  LEGACY_AGE,
  LEGACY_KINDS,
  LEGACY_TIERS,
  legacyFund,
  legacyItemsValue,
  legacyTierOf,
  legacyToNext,
} from '@offside/game/legacy';
import { gLegacyText as G } from '@offside/game/i18n/ko/gLegacy';
import { fmtMoney } from '@offside/game/player';
import type { GameState, LegacyKind, LegacyTier } from '@offside/game/types';
import { gameLegacyText as L } from './i18n/ko/gameLegacy';
import { appFormatText as L2 } from './i18n/ko/appFormat.js';

export const legacyKindName = (k: LegacyKind): string => G[k];
export const legacyTierName = (t: LegacyTier): string => G[`tier${t}`];
const won = (v: number) => L2.won({ v: fmtMoney(v) });

export interface LegacyView {
  kinds: { k: LegacyKind; name: string; on: boolean }[];
  /** 지금 은퇴하면 받을 등급(0이면 아직 동 등급 아래). */
  tier: LegacyTier | 0;
  line: string;
  /** 등급 기준표(동 · 은 · 금 · 레전드). */
  ladder: { t: LegacyTier; name: string; min: string; on: boolean }[];
  /** 소장품 가치가 더해질 때 한 줄. */
  items?: string;
  note: string;
}

/** 카드를 보일 때만(30세부터, 은퇴 전). */
export function legacyView(s: GameState): LegacyView | null {
  if (s.retired || s.age < LEGACY_AGE) return null;
  const fund = legacyFund(s);
  const tier = legacyTierOf(fund);
  const pick = s.legacyPick;
  const next = legacyToNext(fund);
  const iv = legacyItemsValue(s);
  const line = !pick
    ? L.linePick
    : tier
      ? next
        ? L.lineTierNext({
            kind: G[pick],
            tier: legacyTierName(tier),
            next: legacyTierName((tier + 1) as LegacyTier),
            need: won(next),
          })
        : L.lineTierMax({ kind: G[pick], tier: legacyTierName(tier) })
      : L.lineBelow({ need: won(next) });
  return {
    kinds: LEGACY_KINDS.map((k) => ({ k, name: G[k], on: pick === k })),
    tier,
    line,
    ladder: LEGACY_TIERS.map((min, i) => {
      const t = (i + 1) as LegacyTier;
      return { t, name: legacyTierName(t), min: won(min), on: tier >= t };
    }),
    ...(iv ? { items: L.itemsLine({ value: won(iv) }) } : {}),
    note: L.note,
  };
}

/** 은퇴 확인 시트에 붙일 한 줄. 고르지 않았으면 null. */
export function legacyRetireLine(s: GameState): string | null {
  const pick = s.legacyPick;
  if (!pick) return null;
  const tier = legacyTierOf(legacyFund(s));
  return tier
    ? L.retireLine({ kind: G[pick], tier: legacyTierName(tier) })
    : L.retireLineBelow({ kind: G[pick] });
}

/** 은퇴 리포트 장면 문구. */
export function legacyCredit(legacy: { k: LegacyKind; t: number }) {
  const t = Math.min(4, Math.max(1, legacy.t)) as LegacyTier;
  return {
    kind: G[legacy.k],
    tier: legacyTierName(t),
    t,
    line:
      legacy.k === 'academy'
        ? L.creditAcademy
        : legacy.k === 'charity'
          ? L.creditCharity
          : L.creditClub,
  };
}
