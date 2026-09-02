// SCR-002·003 화면은 폼을 그리기 위해 룰셋 데이터를 동기로 읽어야 한다(엔진 부트스트랩은 비동기
// 싱글턴이라 렌더 초기에 쓰기 부적합). loadRuleset은 번들에 포함된 JSON을 동기 파싱하므로, 모듈
// 싱글턴으로 한 번만 계산해 재사용한다(src/engine/engine.ts도 같은 버전을 별도로 로드해 쓴다).
import { loadRuleset } from '@offside/content';
import { ACTIVE_RULESET_VERSION } from '../engine/versions.js';

export const ruleset = loadRuleset(ACTIVE_RULESET_VERSION);
