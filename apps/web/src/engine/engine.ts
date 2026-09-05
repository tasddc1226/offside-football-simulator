// ADR-003 "브라우저 Web Worker에서 시뮬레이션": 기본 deps는 Worker + createWorkerSimulator를 쓴다.
// 테스트(jsdom)는 createAppEngine에 inlineSimulator + MemoryLocalStore를 직접 주입해 Worker를
// 피한다(브리프).
import { loadContentPack, loadRuleset, loadRetirementArtifacts, type ContentPack } from '@offside/content';
import type { Ruleset } from '@offside/domain';
import {
  createEngineClient,
  createWorkerSimulator,
  type EngineClient,
  type LocalStore,
  type Simulator,
} from '@offside/engine-client';
import { platform } from '../platform/index.js';
import { ACTIVE_CONTENT_PACK_VERSION, ACTIVE_RULESET_VERSION } from './versions.js';

export type AppEngine = {
  client: EngineClient;
  store: LocalStore;
  ruleset: Ruleset;
  pack: ContentPack;
  versions: { rulesetVersion: string; contentPackVersion: string };
  newId: () => string;
};

export type AppEngineDeps = {
  store: LocalStore;
  simulator: Simulator;
  ruleset: Ruleset;
  pack: ContentPack;
  newId?: () => string;
};

/**
 * `EngineClient`는 인스턴스당 룰셋 하나만 받는다(engine-client/src/engine.ts). Phase 1은 활성
 * 버전이 하나뿐이라 문제가 없고, 커리어별 룰셋 버전 선택은 Phase 6(서버가 현재 서비스 시즌을 줄 때)
 * 항목이다.
 */
export function createAppEngine(deps: AppEngineDeps): AppEngine {
  const { store, simulator, ruleset, pack } = deps;
  const newId = deps.newId ?? (() => crypto.randomUUID());

  if (!pack.manifest.compatibleRulesetVersions.includes(ruleset.version)) {
    throw new Error(
      `콘텐츠 팩 ${pack.manifest.contentPackVersion}이 룰셋 ${ruleset.version}과 호환되지 않는다(compatibleRulesetVersions: ${pack.manifest.compatibleRulesetVersions.join(', ')}).`,
    );
  }

  const client = createEngineClient({ store, simulator, ruleset, newId,
    retirementArtifacts: ({ rulesetVersion, contentPackVersion }) =>
      loadRetirementArtifacts(rulesetVersion, contentPackVersion),
  });

  return {
    client,
    store,
    ruleset,
    pack,
    versions: { rulesetVersion: ruleset.version, contentPackVersion: pack.manifest.contentPackVersion },
    newId,
  };
}

let appEnginePromise: Promise<AppEngine> | null = null;

async function createDefaultAppEngine(): Promise<AppEngine> {
  const store = await platform.createLocalStore();
  const worker = new Worker(new URL('@offside/engine-client/worker', import.meta.url), { type: 'module' });
  const simulator = createWorkerSimulator(worker as unknown as Parameters<typeof createWorkerSimulator>[0]);
  const ruleset = loadRuleset(ACTIVE_RULESET_VERSION);
  const pack = loadContentPack(ACTIVE_CONTENT_PACK_VERSION);

  return createAppEngine({ store, simulator, ruleset, pack });
}

/** 지연 싱글턴. 첫 호출에서만 만들고 이후 호출은 같은 Promise를 돌려준다. */
export function getAppEngine(): Promise<AppEngine> {
  if (appEnginePromise === null) {
    appEnginePromise = createDefaultAppEngine();
  }
  return appEnginePromise;
}
