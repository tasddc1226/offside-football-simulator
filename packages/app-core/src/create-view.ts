// ───────── 선수 생성 화면 표시 로직 (T-10-022) ─────────
// Create.svelte의 라이브 카드·후보 카드가 쓰는 순수 함수. .svelte.ts 상태를 import하지 않아
// vitest에서 바로 검증할 수 있다.
import {
  ATTR_KEYS,
  attrLabels,
  typeForFocus,
  type AttrKey,
  type Pos,
  type DetailPos,
} from '@offside/game/data';
import {
  bodyMods,
  GK_SUBS,
  legacyOvr,
  SUBS,
  ROLES,
  ROLE_NAME,
  GROUP_W,
  mainRole,
} from '@offside/game/attributes';
import type { Body } from '@offside/contracts/body';
import { createText as L } from './i18n/ko/create.js';

/** 시작 OVR 추정치 — newGame이 세부 능력치를 맞추는 목표값(legacyOvr)과 같다. */
export const startOvr = (pos: Pos, attrs: Record<AttrKey, number>): number =>
  Math.round(legacyOvr(pos, attrs));

/** 한 줄 스카우트 코멘트: 가장 높은 능력치 + 그 능력치로 정한 유형. 1·2위가 거의 같으면 둘 다 말한다. */
export function scoutLine(pos: Pos, attrs: Record<AttrKey, number>): string {
  const [a, b] = ATTR_KEYS.slice().sort((x, y) => attrs[y] - attrs[x]) as [AttrKey, AttrKey];
  const labels = attrLabels(pos);
  const kind = L.archetype({ pos, k: a });
  if (attrs[a] - attrs[b] <= 1) return L.scoutBoth({ a: labels[a], b: labels[b], kind });
  return L.scoutOne({ a: labels[a], kind });
}

/** 주력이 아닌 능력치 중 가장 높은 것 — 주력은 세 후보 모두 비슷해서, 닫힌 카드의 힌트로는 이쪽이 변별력이 있다. */
export function hiddenStrength(attrs: Record<AttrKey, number>, focus: readonly AttrKey[]): AttrKey {
  return ATTR_KEYS.filter((k) => !focus.includes(k)).sort((a, b) => attrs[b] - attrs[a])[0]!;
}

// 골키퍼에게 보여 줄 체격 보정(나머지는 골키퍼 능력치에 거의 안 쓰인다).
const GK_BODY = ['div', 'han', 'jmp', 'str', 'ref', 'rea'];

/** 체격 보정 요약: 포지션에 쓰이는 세부 능력치 중 보정이 큰 4개("민첩성 +2 · 몸싸움 −1"). 보정이 없으면 빈 문자열. */
export function bodyNote(pos: Pos, body: Body): string {
  return Object.entries(bodyMods({ pos, body }))
    .filter(([k]) => (pos === 'GK' ? GK_BODY.includes(k) : !GK_SUBS.includes(k)))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
    .map(([k, v]) => `${SUBS[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`)
    .join(' · ');
}

/** Display the same role used after creation, including legacy focus-based roles. No RNG or save writes. */
export function ovrFocusView(pos: Pos, focus: readonly AttrKey[], dpos?: DetailPos | null) {
  const role = mainRole({ pos, type: typeForFocus(pos, [...focus]), ...(dpos ? { dpos } : {}) });
  const weights = ROLES[role]!;
  const labels = attrLabels(pos);
  const headingOnly =
    (weights.hea ?? 0) > 0 && ['int', 'awa', 'stt', 'sli'].every((k) => !weights[k]);
  const keys = ATTR_KEYS.slice()
    .sort((a, b) => GROUP_W[role]![b] - GROUP_W[role]![a])
    .filter((k) => GROUP_W[role]![k] > 0)
    .slice(0, 3);
  const groups = keys.map((k) => (k === 'def' && headingOnly ? L.ovrHeadingGroup : labels[k]));
  const subs = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => SUBS[k])
    .join(' · ');
  return {
    role,
    keys,
    title: L.ovrFocusTitle({ role: ROLE_NAME[role]! }),
    groups: groups.join(' · '),
    subs: L.ovrFocusSubs({ list: subs }),
    note: headingOnly ? L.ovrHeadingNote : L.ovrFocusNote,
  };
}
