// 모든 이벤트 정의 모듈(events/stories/military/realevents/positional/national)이 공유하는
// 단일 배열. 원본은 전역 EVENTS 배열에 각 스크립트가 push 했습니다 — 순환 import를 피하기 위해
// 그 배열 자체를 별도의 리프 모듈로 분리했습니다.
import { localeData } from '@offside/contracts/i18n';
import type { Choice, EventDef } from './types.js';

export const EVENTS: EventDef[] = [];

/**
 * T-11-106 이벤트 한 개의 다른 언어 문구(i18n/en/_events.ts). 조건·확률·효과는 한국어 정의를 그대로 쓰고 문구만 바꾼다.
 * choices는 정의와 같은 순서·개수다. 문구 함수는 난수를 쓰지 않는다(언어에 따라 게임 결과가 달라지면 안 된다).
 */
export interface EventText {
  title: string;
  text: EventDef['text'];
  choices: { label: Choice['label']; ok: Choice['ok']['text']; fail?: Choice['ok']['text'] }[];
}

let localizedFor: Record<string, EventText> | undefined;
const localized = new Map<string, EventDef>();

/** 지금 언어의 문구를 입힌 이벤트 정의. 한국어거나 번역이 없으면 원래 정의다. */
function localize(e: EventDef): EventDef {
  const t = localeData<Record<string, EventText>>('__events');
  const tr = t?.[e.id];
  if (!tr) return e;
  if (localizedFor !== t) {
    localizedFor = t;
    localized.clear();
  }
  let out = localized.get(e.id);
  if (!out) {
    out = {
      ...e,
      title: tr.title,
      text: tr.text,
      choices: e.choices.map((c, i) => {
        const x = tr.choices[i]!;
        return {
          ...c,
          label: x.label,
          ok: { ...c.ok, text: x.ok },
          ...(c.fail ? { fail: { ...c.fail, text: x.fail ?? c.fail.text } } : {}),
        };
      }),
    };
    localized.set(e.id, out);
  }
  return out;
}

/** id로 이벤트 정의를 찾는다(지금 언어의 문구로). */
let byIdSize = -1;
const byId = new Map<string, EventDef>();
export const eventById = (id: string): EventDef | undefined => {
  // EVENTS는 모듈들이 등록하며 늘어난다 — 길이가 바뀌면 색인을 다시 만든다(같은 id는 먼저 등록한 것).
  if (byIdSize !== EVENTS.length) {
    byId.clear();
    for (const e of EVENTS) if (!byId.has(e.id)) byId.set(e.id, e);
    byIdSize = EVENTS.length;
  }
  const e = byId.get(id);
  return e && localize(e);
};
