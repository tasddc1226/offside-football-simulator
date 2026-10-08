// 구단 자금 내역 화면(웹·앱 공용). 서버가 준 한 줄(FundsHistoryEntry)을 화면 문구로 바꾸고 한국 시각 날짜로 묶는다.
import type { FundsHistoryEntry, FundsHistoryResponse } from '@offside/contracts';
import { tn } from '@offside/game/i18n/names';
import { POS_LABEL } from '@offside/game/pos-label';
import { kstDay } from '@offside/contracts/kst';
import { apiFetch } from './api/client.js';
import { kstParts } from './boardText.js';
import { fmtValue } from './format.js';
import { fundsText } from './funds.js';
import { fundsHistoryText as H } from './i18n/ko/fundsHistory.js';
import { marketText as M } from './i18n/ko/market.js';
import { marketName, SPEND_LABEL, TRADE_LABEL } from './market.js';

/** 내역 한 페이지(30줄). 열 때마다 새로 받는다 — 방출·거래 직후에 열어도 바로 보이게 메모하지 않는다. */
export const fetchFundsHistory = (page = 0) =>
  apiFetch<FundsHistoryResponse>(`/v1/market/funds/history?page=${page}`);

interface FundsHistoryRow {
  id: string;
  kind: FundsHistoryEntry['kind'];
  badge: string;
  title: string;
  /** 시각(한국 시각 HH:MM)과 판매 수수료. */
  sub: string;
  amount: string;
  plus: boolean;
}

function fundsHistoryRow(
  e: FundsHistoryEntry,
  local: ReadonlyMap<string, string>,
): FundsHistoryRow {
  const { time } = kstParts(e.at);
  return {
    id: e.id,
    kind: e.kind,
    badge: e.kind === 'spent' ? M.tradeSpent : TRADE_LABEL[e.kind],
    title: e.item
      ? SPEND_LABEL[e.item]
      : e.card
        ? `${marketName(e.card, local)} ${tn(POS_LABEL[e.card.pos])} ${e.card.peak}`
        : '',
    sub: e.fee ? `${time} · ${H.fees({ fee: fmtValue(e.fee) })}` : time,
    amount: `${e.amount < 0 ? '−' : '+'}${fmtValue(Math.abs(e.amount))}`,
    plus: e.amount >= 0,
  };
}

/** 한국 시각 날짜로 묶는다(최근 순 그대로). */
export function fundsHistoryDays(
  items: readonly FundsHistoryEntry[],
  local: ReadonlyMap<string, string>,
): { day: string; label: string; rows: FundsHistoryRow[] }[] {
  const days: { day: string; label: string; rows: FundsHistoryRow[] }[] = [];
  for (const e of items) {
    const day = kstDay(e.at);
    let g = days.at(-1);
    if (g?.day !== day) {
      g = { day, label: H.date({ m: Number(day.slice(5, 7)), d: Number(day.slice(8)) }), rows: [] };
      days.push(g);
    }
    g.rows.push(fundsHistoryRow(e, local));
  }
  return days;
}

/** 위쪽 합계: 들어온 자금(방출 · 판매)과 나간 자금(영입 · 구단 자금 사용). 합은 부호를 붙이고(0이면 없이), 0인 줄은 뺀다. */
export function fundsHistoryTotals(t: FundsHistoryResponse['totals']) {
  const line = (label: string, v: number) => ({ label, value: fundsText(v) });
  const signed = (sign: string, v: number) => (v > 0 ? `${sign}${fundsText(v)}` : fundsText(0));
  const income = t.released + t.sold;
  const spending = t.bought + t.spent;
  return {
    income: {
      total: signed('+', income),
      lines: [
        ...(t.released ? [line(H.released, t.released)] : []),
        ...(t.sold ? [line(H.sold, t.sold)] : []),
      ],
    },
    spending: {
      total: signed('−', spending),
      lines: [
        ...(t.bought ? [line(H.bought, t.bought)] : []),
        ...(t.spent ? [line(H.spent, t.spent)] : []),
      ],
    },
  };
}
