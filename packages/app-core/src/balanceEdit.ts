// T-10-016 밸런스 편집의 순수 계산(값 고치기 · 적용 중인 버전과의 차이). 웹 AdminBalance.svelte와 앱 화면이 함께 쓴다.
import {
  BALANCE_KEYS,
  BALANCE_SPEC,
  clampTo,
  EVENT_ID_PATTERN,
  resolveBalance,
  type BalanceKey,
  type BalanceOverrides,
} from '@offside/contracts/balance';
import { EVENTS } from '@offside/game/events-data';

/** 이벤트 목록(id 패턴에 맞는 것만, 제목 가나다순). */
export const EVENT_LIST = EVENTS.filter((e) => EVENT_ID_PATTERN.test(e.id)).sort((a, b) =>
  a.title.localeCompare(b.title, 'ko'),
);
/** 확률 선택지가 있는 이벤트만 선택지 보정 대상이다. */
export const PROB_EVENTS = EVENT_LIST.filter((e) => e.choices.some((c) => c.p));
const EVENT_BY_ID = new Map(EVENTS.map((e) => [e.id, e]));
export const eventTitle = (id: string) => EVENT_BY_ID.get(id)?.title ?? id;
const labelOf = (label: unknown, i: number) =>
  typeof label === 'string' ? label : `선택지 ${i + 1}`;
/** 'id:선택지번호' 키의 사람이 읽는 이름. */
export const choiceLabel = (key: string) => {
  const [id, i] = key.split(':') as [string, string];
  return `${eventTitle(id)} — ${labelOf(EVENT_BY_ID.get(id)?.choices[+i]?.label, +i)}`;
};
/** 그 이벤트에서 확률 선택지만(보정을 더할 수 있는 것). */
export const probChoicesOf = (eventId: string) =>
  (EVENT_BY_ID.get(eventId)?.choices ?? []).flatMap((c, i) =>
    c.p ? [{ i, label: labelOf(c.label, i) }] : [],
  );

/** 값 하나를 고친 새 값 묶음 — 기본값과 다른 값만 남긴다(서버에도 그렇게 저장된다). raw가 비면 기본값으로. */
export function setKnobValue(
  values: BalanceOverrides,
  k: BalanceKey,
  raw: string,
): BalanceOverrides {
  const spec = BALANCE_SPEC[k];
  const n = Number(raw);
  const next = { ...values };
  if (raw.trim() === '' || !Number.isFinite(n)) delete next[k];
  else {
    const v = clampTo(Math.round(n / spec.step) * spec.step, spec.min, spec.max);
    const fixed = +v.toFixed(6);
    if (fixed === spec.def) delete next[k];
    else next[k] = fixed;
  }
  return next;
}

/** 이벤트 가중치·선택지 보정 표에서 한 칸을 넣거나(value) 뺀(null) 새 값 묶음. */
export function setMapValue(
  values: BalanceOverrides,
  map: 'eventWeight' | 'choiceBonus',
  key: string,
  value: number | null,
): BalanceOverrides {
  const m = { ...(values[map] ?? {}) };
  if (value === null) delete m[key];
  else m[key] = value;
  const next = { ...values };
  if (Object.keys(m).length) next[map] = m;
  else delete next[map];
  return next;
}

/** 적용 중인 버전(active)과 비교한 변경 목록. */
export function diffLines(
  active: BalanceOverrides | undefined,
  values: BalanceOverrides,
): string[] {
  const a = resolveBalance(active);
  const b = resolveBalance(values);
  const out = BALANCE_KEYS.filter((k) => a[k] !== b[k]).map(
    (k) => `${BALANCE_SPEC[k].label}: ${a[k]} → ${b[k]}`,
  );
  for (const map of ['eventWeight', 'choiceBonus'] as const) {
    const keys = new Set([...Object.keys(a[map]), ...Object.keys(b[map])]);
    const base = map === 'eventWeight' ? 1 : 0;
    for (const k of keys) {
      const [x, y] = [a[map][k] ?? base, b[map][k] ?? base];
      if (x !== y)
        out.push(
          `${map === 'eventWeight' ? `등장 가중치 · ${eventTitle(k)}` : `확률 보정 · ${choiceLabel(k)}`}: ${x} → ${y}`,
        );
    }
  }
  return out;
}
