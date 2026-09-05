// 팩·룰셋 로딩(loadContentPack·loadRuleset)은 정적 JSON을 파싱하는 순수 함수라 Worker 엔진을
// 기다리지 않아도 된다. 화면이 이벤트 정의·서사 토큰·팀 데이터를 읽기 전용으로 쓸 때는 이 모듈의
// 싱글턴을 쓴다(engine.ts의 AppEngine.pack·ruleset과 값이 같다).
import { loadContentPack, loadRuleset } from '@offside/content';
import { ACTIVE_RULESET_VERSION, resolveActiveContentPackVersion } from './versions.js';

export const activeContentPack = loadContentPack(resolveActiveContentPackVersion());
export const activeRuleset = loadRuleset(ACTIVE_RULESET_VERSION);
