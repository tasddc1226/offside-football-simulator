// ───────── 게임 모듈 배럴: 로드 순서가 중요합니다 ─────────
// data → rng → attributes → engine → events-data → event-registry → national → comps → season
export * from './data.js';
export * from './rng.js';
export * from './attributes.js';
export * from './engine.js';
export { EVENTS } from './events-data.js';
import './event-registry.js';
export * from './military.js';
export * from './realevents.js';
export * from './positional.js';
export * from './national.js';
export * from './comps.js';
export * from './season.js';
export * from './turn.js';
export type * from './types.js';
