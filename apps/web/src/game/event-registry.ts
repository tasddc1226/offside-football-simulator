// ───────── 이벤트 정의 등록 ─────────
// 각 정의 모듈은 목록만 내보내고, 여기서 한 번에 EVENTS(events-data.ts)에 채운다. 게임을 진행하는 경로
// (ui/actions.ts)와 배럴(index.ts)이 이 모듈을 import해야 한다 — 빠지면 rollEvent가 바로 에러를 낸다. 소비 모듈이
// 여기서 직접 EVENTS를 받지 않는 건 정의 모듈이 engine.js를 거쳐 event-runner를 import해 순환이 되기 때문이다.
//
// 순서가 곧 가중 추첨 순서라 같은 시드의 결과를 정한다. T-10-046에서 import 부수효과(push)를 이 목록으로
// 바꾸며 배포 번들의 실제 순서를 그대로 옮겼다(번들은 military가 든 청크가 먼저 실행된다). 병역 이벤트는
// chain이라 추첨 풀에 들지 않아 Node(시뮬레이터)와 순서가 달랐어도 결과는 같았다. 순서는
// event-registry.test.ts가 고정한다 — 새 이벤트는 해당 목록 끝에 붙인다.
import { EVENTS } from './events-data.js';
import { MILITARY_EVENTS } from './military.js';
import { BASE_EVENTS } from './events.js';
import { STORY_EVENTS } from './stories.js';
import { REAL_EVENTS } from './realevents.js';
import { POSITIONAL_EVENTS } from './positional.js';

EVENTS.push(...MILITARY_EVENTS, ...BASE_EVENTS, ...STORY_EVENTS, ...REAL_EVENTS, ...POSITIONAL_EVENTS);
