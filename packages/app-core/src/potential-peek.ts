// T-11-079 커리어 중 잠재력 엿보기(앱 보상형 광고). 은퇴 때 공개하는 실제 잠재력은 그대로 두고, 화면용 스카우트
// 평가(potLabel — 재평가 전에는 'C~B' 범위)만 그 시즌 동안 보여 준다. 첫 시즌을 마쳐야 열린다(potScouted, 리세 방지).
// 엿본 기록은 세이브가 아니라 기기에 따로 둔다(커리어 id + 시즌). 엔진·저장 형식·업로드는 바꾸지 않는다.
// T-11-133 보상형 광고가 없는 웹은 게임 자금을 내고 연다(규칙은 game peek.ts).
import { buyPeek as pay, peekCost, peekShort } from '@offside/game/peek';
import { fmtMoney } from '@offside/game/player';
import { potLabel, potScouted } from '@offside/game/stats';
import type { GameState } from '@offside/game/types';
import { gamePotentialText as L } from './i18n/ko/gamePotential';
import { appFormatText as W } from './i18n/ko/appFormat';

/** 이 커리어의 이 시즌에 평가를 열었다는 기록. */
export type PotentialPeek = { cid: string; year: number };

export type PeekView =
  /** 첫 시즌 전 — 아직 스카우트 평가가 없다. */
  | { kind: 'locked'; text: string }
  /** 광고(광고 제거 구매자는 바로)나 자금(웹)으로 열 수 있다. */
  | { kind: 'available'; text: string; button: string }
  /** 웹 — 자금이 모자라다. */
  | { kind: 'short'; text: string }
  | { kind: 'shown'; grade: string; text: string };

/** 첫 시즌 전 안내 — 언어가 정해진 뒤에 읽도록 함수로 둔다. */
export const peekLocked = (): string => L.peekLocked;

/** 기기에 남긴 값을 읽는다. 형식이 틀리면 없는 것으로 본다. */
export function parsePeek(raw: string | null | undefined): PotentialPeek | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PotentialPeek>;
    return typeof v.cid === 'string' && Number.isInteger(v.year)
      ? { cid: v.cid, year: v.year! }
      : null;
  } catch {
    return null;
  }
}

export const peekOf = (s: GameState): PotentialPeek => ({ cid: s.cid, year: s.year });

/** 같은 커리어의 같은 시즌에 연 기록이면 열려 있다. 다음 시즌이 되면 다시 닫힌다. */
export const peekOpen = (s: GameState, peek: PotentialPeek | null): boolean =>
  !!peek && peek.cid === s.cid && peek.year === s.year;

/** 여는 방법 — 'ad' 앱 보상형 광고, 'free' 광고 제거 구매자, 'pay' 웹(자금). */
export type PeekOffer = 'ad' | 'free' | 'pay';

export function peekView(s: GameState, peek: PotentialPeek | null, offer: PeekOffer): PeekView {
  if (!potScouted(s)) return { kind: 'locked', text: L.peekLocked };
  if (peekOpen(s, peek)) {
    const grade = potLabel(s);
    return { kind: 'shown', grade, text: L.peekShown({ grade, year: s.year }) };
  }
  if (offer !== 'pay')
    return {
      kind: 'available',
      text: L.peekAvailable,
      button: offer === 'free' ? L.peekBtnFree : L.peekBtnAd,
    };
  const cost = W.won({ v: fmtMoney(peekCost(s)) });
  return peekShort(s)
    ? { kind: 'short', text: L.peekShort({ cost }) }
    : { kind: 'available', text: L.peekAvailable, button: L.peekBtnPay({ cost }) };
}

/** 웹: 자금을 내고 이번 시즌 평가를 연다. 열 수 없으면(첫 시즌 전 · 자금 부족) null, 상태를 바꾸지 않는다. */
export const buyPeek = (s: GameState): PotentialPeek | null => (pay(s) ? peekOf(s) : null);
