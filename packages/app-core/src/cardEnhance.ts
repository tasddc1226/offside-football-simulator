// T-11-373 카드 강화 창(웹 team/EnhanceSheet.svelte · 앱 screens/owner/EnhanceSheet.tsx)이 그리는 값. 확률 · 비용 · 하락 규칙은
// contracts card-enhance.ts(서버 판정과 같은 식)에서, 운영 수치는 GET /v1/cards/enhance의 rules에서 온다.
import {
  ENHANCE_MAX,
  enhanceBoost,
  enhanceCost,
  enhanceFailLevel,
  enhanceRate,
  type EnhanceRules,
} from '@offside/contracts/card-enhance';
import { fmtValue } from './format.js';
import { cardEnhanceText as L } from './i18n/ko/cardEnhance.js';

/** 카드 배지 — 강화 전이면 null. */
export const enhanceBadge = (level: number | undefined) => (level ? `+${level}` : null);

export type EnhanceView = {
  level: number;
  next: number | null;
  /** 이번 시도 성공 확률(0~1, 천장 포함). */
  rate: number;
  ratePct: string;
  cost: number | null;
  costText: string;
  /** 실패하면 갈 단계와 그 안내. */
  failText: string;
  pityText: string | null;
  effectText: string | null;
  leftText: string;
  /** 시도를 막는 이유(없으면 null). */
  block: string | null;
};

export function enhanceView(
  card: { enhance?: number; enhanceFails?: number },
  rules: EnhanceRules,
  balance: number,
  used: number,
  listed = false,
): EnhanceView {
  const level = card.enhance ?? 0;
  const fails = card.enhanceFails ?? 0;
  const cost = enhanceCost(level, rules);
  const rate = enhanceRate(level, fails, rules);
  const next = level < ENHANCE_MAX ? level + 1 : null;
  const drop = enhanceFailLevel(level);
  const block =
    next === null
      ? L.max
      : rules.dailyCap === 0
        ? L.closed
        : listed
          ? L.listed
          : used >= rules.dailyCap
            ? L.limit
            : cost !== null && balance < cost
              ? L.short
              : null;
  return {
    level,
    next,
    rate,
    ratePct: `${Math.round(rate * 1000) / 10}%`,
    cost,
    costText: cost === null ? '-' : fmtValue(cost),
    failText: drop < level ? L.failDrop({ lv: drop }) : L.failStay,
    pityText: fails > 0 && next !== null ? L.pity({ n: fails }) : null,
    effectText:
      next === null || rules.effectScale === 0
        ? null
        : L.effect({
            now: String(enhanceBoost(level, rules.effectScale)),
            next: String(enhanceBoost(next, rules.effectScale)),
          }),
    leftText: L.left({ n: Math.max(0, rules.dailyCap - used) }),
    block,
  };
}

/** 시도 결과 한 줄. */
export const enhanceResultText = (r: { success: boolean; from: number; to: number }) =>
  r.success
    ? L.success({ lv: r.to })
    : r.to < r.from
      ? L.failDropped({ lv: r.to })
      : L.failKeep({ lv: r.to });

/** 서버 거절 이유를 창 문구로(모르는 이유는 서버 문구를 그대로). */
export function enhanceErrorText(e: { reason?: string | undefined; message?: string }): string {
  switch (e.reason) {
    case 'FUNDS_SHORT':
      return L.short;
    case 'DAILY_LIMIT':
      return L.limit;
    case 'ENHANCE_CLOSED':
      return L.closed;
    case 'ENHANCE_MAX':
      return L.max;
    case 'CARD_LISTED':
      return L.listed;
    default:
      return e.message || L.tryFail;
  }
}
