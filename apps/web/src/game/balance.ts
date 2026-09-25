// ───────── T-10-016 서버 밸런스 설정 ─────────
// 게임 코드는 BAL.<키>를 읽는다. 값은 커리어마다 저장(GameState.bal)되고, 서버의 새 버전은 다음 시즌이
// 시작될 때(newSeason) 그 커리어에 적용된다 — 시즌 도중에는 수치가 바뀌지 않는다.
// 서버에 연결하지 못하면 저장된 값(없으면 코드 기본값 = 버전 0)으로 계속 진행한다.
import { resolveBalance, sanitizeBalance, type BalanceOverrides, type BalanceValues } from '@offside/contracts/balance';
import type { GameState } from './types.js';

export type CareerBalance = { v: number; values: BalanceOverrides };

/** 지금 진행 중인 커리어에 적용된 전체 값. */
export const BAL: BalanceValues = resolveBalance();
let latest: CareerBalance | null = null;

/** 값을 바꿔 끼운다(모자란 키는 기본값). 같은 객체를 유지해 import한 모듈이 새 값을 본다. */
export function applyBalance(values: BalanceOverrides = {}): void {
  Object.assign(BAL, resolveBalance(values));
}

/** 서버에서 받은 최신 설정. 다음 시즌 시작(또는 새 커리어)부터 쓰인다. */
export function setLatestBalance(cfg: { version: number; values: unknown } | null): void {
  latest = cfg ? { v: cfg.version, values: sanitizeBalance(cfg.values) } : null;
}

/** 저장된 커리어를 불러올 때: 그 커리어의 값으로 맞춘다. */
export function useCareerBalance(s: GameState | null): void {
  applyBalance(s?.bal?.values);
}

/** 새 시즌 시작 · 새 커리어: 최신 버전이 다르면 그 커리어에 적용한다. 바뀌었으면 true. */
export function adoptLatestBalance(s: GameState): boolean {
  const next = latest && latest.v !== (s.bal?.v ?? 0) ? latest : null;
  if (next) s.bal = { ...next };
  applyBalance(s.bal?.values);
  return !!next;
}

/** 선택지 성공 확률: 이벤트 정의의 확률 + 서버 가감(choiceBonus). 확률이 없는(확정) 선택지는 1. */
export function choiceOdds(p: number | undefined, evId: string, idx: number): number {
  if (p === undefined) return 1;
  const bonus = BAL.choiceBonus[`${evId}:${idx}`] ?? 0;
  return bonus ? Math.min(0.99, Math.max(0.01, p + bonus)) : p;
}

/** 이벤트 등장 가중치 배율(기본 1). */
export const eventWeight = (evId: string): number => BAL.eventWeight[evId] ?? 1;
