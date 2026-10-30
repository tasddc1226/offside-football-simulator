// T-11-373 카드 강화 창(웹 team/EnhanceSheet.svelte · 앱 screens/owner/EnhanceSheet.tsx)이 그리는 값. 확률 · 비용 · 천장 · 강화 OVR은
// contracts card-enhance.ts(서버 판정과 같은 식)에서, 운영 수치와 카드 상태는 GET /v1/cards/:careerId/enhance에서 온다.
import {
  ENHANCE_MAX,
  enhanceCeilingLeft,
  enhanceCost,
  enhanceOvr,
  enhanceRateBp,
  enhanceStartsToNext,
  enhanceTriesLeft,
  enhanceValue,
  type EnhanceCardState,
  type EnhanceRules,
} from '@offside/contracts/card-enhance';
import type { EnhanceBody } from '@offside/contracts';
import { fmtValue } from './format.js';
import { cardEnhanceText as L } from './i18n/ko/cardEnhance.js';

/** 카드 배지 — 강화 전이면 null. */
export const enhanceBadge = (level: number | null | undefined) => (level ? `+${level}` : null);

export type EnhanceView = {
  level: number;
  next: number | null;
  /** 이번 시도 성공 확률(정수 퍼센트 문구, 천장이면 100%). */
  ratePct: string;
  cost: number | null;
  costText: string;
  /** 강화 OVR 지금 → 성공하면. */
  ovrText: string | null;
  /** 확정까지 남은 실패 안내(+5면 null). */
  ceilingText: string | null;
  triesLeft: number;
  triesText: string;
  /** 다음 시도권까지 남은 선발 경기 안내. */
  nextTryText: string;
  /** 시도를 막는 이유(없으면 null). */
  block: string | null;
  /** 서버에 보낼 본 값(시도할 수 있을 때만). */
  body: EnhanceBody | null;
};

export function enhanceView(
  card: EnhanceCardState,
  rules: EnhanceRules,
  balance: number,
  listed = false,
): EnhanceView {
  const { level, fails } = card;
  const cost = enhanceCost(level, rules);
  const rateBp = enhanceRateBp(level, fails, rules);
  const next = level < ENHANCE_MAX ? level + 1 : null;
  const triesLeft = enhanceTriesLeft(card, rules);
  const left = enhanceCeilingLeft(level, fails);
  const block =
    next === null
      ? L.max
      : !rules.open
        ? L.closed
        : listed
          ? L.listed
          : triesLeft < 1
            ? L.noTry
            : cost !== null && balance < cost
              ? L.short
              : null;
  return {
    level,
    next,
    ratePct: `${rateBp / 100}%`,
    cost,
    costText: cost === null ? '-' : fmtValue(cost),
    ovrText: next === null ? null : L.ovr({ now: enhanceOvr(level), next: enhanceOvr(next) }),
    ceilingText: left === null ? null : left === 0 ? L.sure : L.ceiling({ n: left }),
    triesLeft,
    triesText: L.triesN({ n: triesLeft }),
    nextTryText: L.nextTry({ n: enhanceStartsToNext(card, rules) }),
    block,
    body: block === null && cost !== null ? { level, fails, used: card.used, cost, rateBp } : null,
  };
}

/** 시도 결과 한 줄. */
export const enhanceResultText = (r: { success: boolean; to: number }) =>
  r.success ? L.success({ lv: r.to }) : L.failKeep({ lv: r.to });

/** 판매 시트 안내: 강화 가치가 판매 가격 범위에 더해진다(강화 전이면 null). */
export const enhanceSellNote = (level: number | null | undefined) =>
  level ? L.sellNote({ lv: level, value: fmtValue(enhanceValue(level)) }) : null;

/** 서버 거절 이유를 창 문구로(모르는 이유는 서버 문구를 그대로). */
export function enhanceErrorText(e: { reason?: string | undefined; message?: string }): string {
  switch (e.reason) {
    case 'FUNDS_SHORT':
      return L.short;
    case 'ENHANCE_NO_TRY':
      return L.noTry;
    case 'ENHANCE_CLOSED':
      return L.closed;
    case 'ENHANCE_MAX':
      return L.max;
    case 'CARD_LISTED':
      return L.listed;
    case 'ENHANCE_STALE':
      return L.stale;
    default:
      return e.message || L.tryFail;
  }
}

/** 응답을 받지 못한 시도(네트워크 · 일시 오류)는 같은 멱등 키로 다시 보낸다. 그 밖의 거절은 키를 새로 만든다. */
export const enhanceKeepKey = (e: { code?: string; retryable?: boolean }) => !!e.retryable;
