// ───────── 원터치 미니게임 (T-10-089) ─────────
// 경기 장면이 있는 선택지(페널티킥·1대1·승부차기)는 확률 판정 대신 타이밍 게이지로 가린다. 게이지 위를 왕복하는
// 바늘을 한 번 탭해 멈추고, 초록 구간 안이면 성공이다. 능력치로 정해지던 성공 확률 p는 구간의 넓이가 된다 —
// 능력치가 좋을수록 구간이 넓지만, 성공 여부는 손으로 정한다.
//
// 판정은 여전히 resolveChoice 한 곳에서 한다. 탭 결과를 판정값(roll)으로 바꿔 넘기면(offsetToRoll) roll < p가
// 곧 "구간 안"이 된다. 시뮬레이터·골든 테스트는 탭 없이 부르므로 지금처럼 난수로 판정한다.
import { clamp } from './rng.js';

/** 장면 종류. shot·chip·dribble은 내가 차고, save는 내가 골키퍼다. */
export type MgKind = 'shot' | 'chip' | 'dribble' | 'save';

/** '이벤트 id:선택지 번호' → 장면. 선택지 순서는 서버 choiceBonus 키와 같아 바뀌지 않는다. */
const MINIGAMES: Readonly<Record<string, MgKind>> = {
  'penalty:0': 'shot',
  'fw-one-on-one:0': 'chip',
  'fw-one-on-one:1': 'dribble',
  'pk-save:0': 'save',
  'pk-save:1': 'save',
  'gk-pk:0': 'save',
  'gk-pk:1': 'save',
};
export const minigameOf = (id: string, idx: number): MgKind | undefined =>
  MINIGAMES[`${id}:${idx}`];

/** 선택지 문구가 방향을 정한 장면(-1 왼쪽 · 0 제자리). 없으면 화면에서 무작위로 고른다. */
const MG_SIDE: Readonly<Record<string, -1 | 0>> = {
  'pk-save:0': -1,
  'pk-save:1': 0,
};
export const minigameSide = (id: string, idx: number): -1 | 0 | undefined =>
  MG_SIDE[`${id}:${idx}`];

/** 탭 버튼 문구. */
export const MG_TAP: Readonly<Record<MgKind, string>> = {
  shot: '슛!',
  chip: '칩슛!',
  dribble: '제친다!',
  save: '다이빙!',
};

/**
 * 성공 구간 넓이(게이지 전체 대비). p 0.72(보통 페널티킥) → 0.30, p 0.3(보통 승부차기) → 0.16. 바늘이 한쪽 끝에서
 * 반대쪽까지 SWEEP_MS에 가므로 0.30은 약 240ms, 0.16은 약 130ms 동안 구간 안에 머문다.
 */
export const zoneWidth = (p: number, kind?: MgKind) =>
  clamp((0.06 + 0.34 * p) * (kind ? ZONE_SCALE[kind] : 1), 0.06, 0.36);
/** 장면별 구간 배율. 칩슛은 키퍼 머리 위로 띄우는 섬세한 슛이라 더 좁다. */
const ZONE_SCALE: Readonly<Record<MgKind, number>> = { shot: 1, chip: 0.75, dribble: 1, save: 1 };
export const SWEEP_MS = 800;
/** 제한 시간(ms). 장면이 뜬 뒤 이 안에 누르지(차지) 않으면 실패다. */
export const MG_TIME_MS = 3000;

/** 선택 창·도감에 보이는 구간 크기. */
export const zoneLabel = (w: number) => (w >= 0.26 ? '넓음' : w >= 0.17 ? '보통' : '좁음');

/** 시작 후 t(ms) 시점의 바늘 위치(0–1, 왕복). */
export function markerAt(t: number): number {
  const k = (Math.max(0, t) / SWEEP_MS) % 2;
  return k <= 1 ? k : 2 - k;
}

/**
 * 탭 위치가 구간 가운데에서 떨어진 정도. 0 = 한가운데, 1 = 구간 끝, 1 초과 = 빗나감.
 * x가 null이면 제한 시간 안에 누르지 않은 것 — 무한대(실패)다.
 */
export const tapOffset = (x: number | null, center: number, w: number) =>
  x === null ? Infinity : Math.abs(x - center) / (w / 2);

/** 떨어진 정도 → 판정값. 구간 안(≤1)이면 p보다 작고, 밖이면 p 이상이다. */
export function offsetToRoll(d: number, p: number): number {
  return d <= 1 ? p * d * 0.999 : Math.min(0.999, p + (1 - p) * Math.min(1, d - 1));
}

/** 결과 시트에 붙는 한 줄. */
export function timingNote(d: number): string {
  if (!Number.isFinite(d)) return '시간 초과 — 3초 안에 누르지 않았어요';
  if (d <= 0.25) return '완벽한 타이밍!';
  if (d <= 1) return '타이밍 성공';
  if (d <= 1.6) return '아깝게 빗나간 타이밍';
  return '타이밍을 놓쳤어요';
}
