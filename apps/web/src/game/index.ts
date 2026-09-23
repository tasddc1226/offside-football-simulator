// ───────── 게임 모듈 배럴: 로드 순서가 중요합니다 ─────────
// data → rng → attributes → engine → events-data → events → stories → military
// → realevents → positional → national(마지막에 legacy 'national' 이벤트를 EVENTS에서 splice) → comps → season
export * from './data.js';
export * from './rng.js';
export * from './attributes.js';
export * from './engine.js';
export { EVENTS } from './events-data.js';
import './events.js';
import './stories.js';
import './military.js';
import './realevents.js';
import './positional.js';
export * from './military.js';
export * from './realevents.js';
export * from './positional.js';
export * from './national.js';
export * from './comps.js';
export * from './season.js';
export type * from './types.js';
