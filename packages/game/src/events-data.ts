// 모든 이벤트 정의 모듈(events/stories/military/realevents/positional/national)이 공유하는
// 단일 배열. 원본은 전역 EVENTS 배열에 각 스크립트가 push 했습니다 — 순환 import를 피하기 위해
// 그 배열 자체를 별도의 리프 모듈로 분리했습니다.
import type { EventDef } from './types.js';

export const EVENTS: EventDef[] = [];

/** id로 이벤트 정의를 찾는다. */
export const eventById = (id: string): EventDef | undefined => EVENTS.find((e) => e.id === id);
