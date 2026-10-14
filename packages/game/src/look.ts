// ───────── T-11-191 도트 선수 꾸미기 ─────────
// 사는 규칙(가격 · 구매 · 기록 아이템)은 look-shop.ts. 커리어 중 선수 자금으로 꾸미기 항목을 한 번 사면, 그 커리어 동안 그 항목의 모양을 언제든 바꿀 수 있다. 은퇴 후에는 별도 외형 편집 화면에서 기록을 유지하며 바꾼다.
// 산 항목과 고른 값은 세이브(GameState.look)에 남고, 은퇴 업로드 때 lookCode로 줄여 서버에 올린다(명예의 전당 · 결산 사진).
// 그림(avatar.ts)은 이 파일의 선택지 순서를 그대로 쓴다. 게임 RNG는 쓰지 않고 성장 · 결과에 영향이 없다.
import type { GameState, LookItem, LookState } from './types.js';
import { LOOK_CODE, LOOK_ORDER } from './look-code.js';
export { LOOK_ORDER, lookCode } from './look-code.js';

/** 머리 모양(avatar.ts HAIR 키) — 순서가 코드 값이다. 뒤에만 더한다. */
export const LOOK_STYLES = [
  'short',
  'fringe',
  'long',
  'mohawk',
  'slick',
  'buzz',
  'afro',
  'bun',
  'spiky',
] as const;
/** 수염 — 0 없음, 1 짧은 수염, 2 덥수룩한 수염. */
export const LOOK_BEARDS = [null, 'stubble', 'full'] as const;
/** 표정 — 0 기본(나이 · 부상대로), 1 웃음, 2 윙크. 부상 중에는 아픈 표정이 먼저다. */
export const LOOK_EXPRS = [null, 'happy', 'wink'] as const;

/**
 * 항목마다 선택지 수와 가격 등급. 선택지 순서는 avatar.ts의 색 · 모양 표와 같다(뒤에만 더한다).
 * 가격 = max(최소, 연봉 × 비율) — 잠재력 엿보기(0.35)처럼 어느 리그에서든 부담이 비슷하다.
 */
export const LOOK_ITEMS = {
  skin: { options: 6, rate: 0.15, min: 300 },
  hair: { options: 13, rate: 0.15, min: 300 },
  beard: { options: LOOK_BEARDS.length, rate: 0.15, min: 300 },
  style: { options: LOOK_STYLES.length, rate: 0.3, min: 600 },
  expr: { options: LOOK_EXPRS.length, rate: 0.15, min: 300 },
  band: { options: 9, rate: 0.3, min: 600 },
  wrist: { options: 7, rate: 0.3, min: 600 },
  glasses: { options: 7, rate: 0.6, min: 1200 },
  boots: { options: 11, rate: 0.3, min: 600 },
  socks: { options: 8, rate: 0.3, min: 600 },
} as const satisfies Record<LookItem, { options: number; rate: number; min: number }>;
export const lookOwned = (s: GameState, item: LookItem): boolean => !!s.look?.owned.includes(item);

/** 현역 상점 진입 가능 여부. 은퇴 후에는 별도 외형 편집 화면을 쓴다. */
export const lookEditable = (s: GameState): boolean => !s.retired;

export const validValue = (item: LookItem, v: number) =>
  Number.isInteger(v) && v >= 0 && v < LOOK_ITEMS[item].options;

/** 서버 코드 → 고른 값. 모르는 글자 · 범위 밖 값은 버린다(새 항목이 생긴 뒤 옛 앱이 읽어도 깨지지 않게). */
export function parseLookCode(code: string | null | undefined): LookState['pick'] {
  const pick: LookState['pick'] = {};
  if (!code) return pick;
  for (const [, ch, n] of code.matchAll(/([a-z])(\d{1,2})/g)) {
    const item = LOOK_ORDER.find((k) => LOOK_CODE[k] === ch);
    const v = Number(n);
    if (item && validValue(item, v)) pick[item] = v;
  }
  return pick;
}
