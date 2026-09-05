// T-4-009 D-56: DEV 팩 오버라이드가 "기존 커리어"에 영향을 주지 않는지 확인하는 단위 테스트.
// 0.1.0으로 만든 커리어를 로컬 Snapshot 캐시가 깨진 상태(=명령 로그 재생이 실제로 필요한 상태)로
// 만든 뒤, engine.pack이 0.2.0으로 바뀐 두 번째 AppEngine 인스턴스로 다시 불러온다. 재생은
// career.rulesetVersion·career.contentPackVersion(카드 자기 자신에 저장된 값)로만 도는 것이지
// engine.pack을 읽지 않는다(engine.ts·engine-client의 recoverLatestSnapshot 참고) — 그래서 두 팩
// 버전에서 같은 stateHash가 나와야 한다.
import { loadContentPack, loadRuleset } from '@offside/content';
import { MemoryLocalStore, inlineSimulator, type EngineCommand } from '@offside/engine-client';
import { describe, expect, it } from 'vitest';
import { advance, acceptOffer, confirmPlayer, resolveEvent, updateDraft } from './career-actions.js';
import { createAppEngine, type AppEngine } from './engine.js';

const RULESET_VERSION = '1.0.0';
const CAREER_ID = 'car_replay_invariant_01';
const SEED = 'offside-t-4-009-replay-invariant';

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

/** career01 픽스처와 같은 draft(SCR-002/003 e2e 기본값)로 0.1.0 커리어를 계약 체결까지 재생한다. */
async function createSignedCareer(engine: AppEngine): Promise<{ stateHash: string; revision: number }> {
  const newId = makeIdGenerator('setup');
  const createCommand: EngineCommand = {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: {
      careerId: CAREER_ID,
      seed: SEED,
      simulationMode: 'CHAPTER',
      rulesetVersion: engine.versions.rulesetVersion,
      contentPackVersion: engine.versions.contentPackVersion,
    },
  };
  const created = await engine.client.execute({ careerId: CAREER_ID, command: createCommand, createdServiceSeasonId: 'svc_kickoff' });
  if (!created.ok) throw new Error(`CREATE_CAREER 실패: ${created.error.code} ${created.error.message}`);

  await updateDraft(engine, CAREER_ID, { name: '김서준', gender: 'MALE', nationalityCode: 'KR', preferredFoot: 'LEFT' });
  await updateDraft(engine, CAREER_ID, { position: 'W', archetypeId: 'inside-forward', backgroundId: 'club-academy' });

  const confirmed = await confirmPlayer(engine, CAREER_ID);
  if (!confirmed.ok) throw new Error(`CONFIRM_PLAYER 실패: ${confirmed.error.code} ${confirmed.error.message}`);

  let current = await advance(engine, CAREER_ID);
  if (!current.ok) throw new Error(`advance 실패: ${current.error.code} ${current.error.message}`);

  // EVT-CON-002 → A, EVT-CON-003 → A(첫 선택지), 그 뒤 advance가 OFFERS를 연다(career01 픽스처와
  // 같은 온보딩 순서, career-actions.test.ts의 replayToSigned와 동일한 관례).
  for (let guard = 0; guard < 5 && current.ok && current.domainSnapshot.state.pending?.kind === 'EVENT'; guard += 1) {
    const resolved = await resolveEvent(engine, CAREER_ID, 'A');
    if (!resolved.ok) throw new Error(`resolveEvent 실패: ${resolved.error.code} ${resolved.error.message}`);
    current = await advance(engine, CAREER_ID);
    if (!current.ok) throw new Error(`advance 실패: ${current.error.code} ${current.error.message}`);
  }

  if (!current.ok || current.domainSnapshot.state.pending?.kind !== 'OFFERS') {
    throw new Error('OFFERS 단계에 도달하지 못했다(온보딩 이벤트 순서가 바뀌었을 수 있다).');
  }
  const offerId = current.domainSnapshot.state.pending.offers[0]!.id;
  const accepted = await acceptOffer(engine, CAREER_ID, offerId);
  if (!accepted.ok) throw new Error(`acceptOffer 실패: ${accepted.error.code} ${accepted.error.message}`);

  return { stateHash: accepted.domainSnapshot.stateHash, revision: accepted.domainSnapshot.revision };
}

describe('D-56 팩 오버라이드: 기존 커리어 replay 불변', () => {
  it('0.1.0 커리어를 만든 뒤 Snapshot 캐시를 지우고 engine.pack이 0.2.0인 두 번째 엔진으로 복구해도 stateHash·revision이 같다', async () => {
    const store = new MemoryLocalStore();
    const ruleset = loadRuleset(RULESET_VERSION);

    const engineV1 = createAppEngine({
      store,
      simulator: inlineSimulator,
      ruleset,
      pack: loadContentPack('0.1.0'),
      newId: makeIdGenerator('v1'),
    });
    expect(engineV1.versions.contentPackVersion).toBe('0.1.0');

    const before = await createSignedCareer(engineV1);

    // 로컬 Snapshot 캐시가 깨진 상태를 재현한다(예: 이전 세션이 최신 Snapshot을 못 쓰고 종료) —
    // commandLog는 그대로 남아 있어 recoverLatestSnapshot이 명령 로그 전체를 재생해야 한다.
    await store.transaction('readwrite', (tx) => tx.snapshots.deleteByCareer(CAREER_ID));

    // 같은 store를 engine.pack만 0.2.0으로 바꾼 두 번째 AppEngine으로 다시 연다(DEV 오버라이드가
    // 세션 사이에 0.1.0 → 0.2.0으로 바뀐 상황을 흉내낸다).
    const engineV2 = createAppEngine({
      store,
      simulator: inlineSimulator,
      ruleset,
      pack: loadContentPack('0.2.0'),
      newId: makeIdGenerator('v2'),
    });
    expect(engineV2.versions.contentPackVersion).toBe('0.2.0');

    const reloaded = await engineV2.client.loadCareer(CAREER_ID);
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) throw new Error('unreachable');

    expect(reloaded.recovered).not.toBeNull(); // 실제로 명령 로그 재생 경로를 탔는지 확인한다.
    expect(reloaded.snapshot.stateHash).toBe(before.stateHash);
    expect(reloaded.snapshot.revision).toBe(before.revision);
    // 카드 자신의 팩 버전은 오버라이드와 무관하게 생성 시점 값(0.1.0)으로 남는다.
    expect(reloaded.career.contentPackVersion).toBe('0.1.0');
  });
});
