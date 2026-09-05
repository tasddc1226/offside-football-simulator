// 팩·룰셋 로딩(loadContentPack·loadRuleset)은 정적 JSON을 파싱하는 순수 함수라 Worker 엔진을
// 기다리지 않아도 된다. 화면이 이벤트 정의·서사 토큰·팀 데이터를 읽기 전용으로 쓸 때는 이 모듈의
// 기본 싱글턴을 쓴다. 저장된 커리어 화면은 아래 버전별 로더로 생성 당시 버전을 유지한다.
import { loadContentPack, loadRuleset, type ContentPack, type Ruleset } from '@offside/content';
import { resolveActiveContentPackVersion, resolveActiveRulesetVersion } from './versions.js';

export const activeContentPack = loadContentPack(resolveActiveContentPackVersion());
const activeRulesetVersion = resolveActiveRulesetVersion();
export const activeRuleset = loadRuleset(activeRulesetVersion);

const careerPacks = new Map<string, ContentPack>([[activeContentPack.manifest.contentPackVersion, activeContentPack]]);
const careerRulesets = new Map<string, Ruleset>([[activeRulesetVersion, activeRuleset]]);

/** 새 커리어의 DEV 선택과 무관하게 저장된 커리어의 콘텐츠 버전을 유지한다. */
export function contentForCareer(state: { contentPackVersion: string }): ContentPack {
  const cached = careerPacks.get(state.contentPackVersion);
  if (cached) return cached;
  const pack = loadContentPack(state.contentPackVersion);
  careerPacks.set(state.contentPackVersion, pack);
  return pack;
}

/** 저장된 커리어의 룰셋 버전을 유지한다. 새 기본 룰셋이 추가되어도 과거 화면 계산이 바뀌지 않는다. */
export function rulesetForCareer(state: { rulesetVersion: string }): Ruleset {
  const cached = careerRulesets.get(state.rulesetVersion);
  if (cached) return cached;
  const ruleset = loadRuleset(state.rulesetVersion);
  careerRulesets.set(state.rulesetVersion, ruleset);
  return ruleset;
}
