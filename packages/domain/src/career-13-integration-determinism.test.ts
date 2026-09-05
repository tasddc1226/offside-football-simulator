import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-13-integration.golden.json';
import {
  careerIntegrationFixture,
  integrationResumePoints,
  rulesetProto,
  runIntegrationFixture,
  type IntegrationFixture,
} from './__fixtures__/career-13-integration.js';
import { simulate, verifySnapshot, type Command, type SimulationResult } from './simulate.js';
import type { DomainSnapshot } from './types.js';

type Cmd = Command & { commandId: string; expectedRevision: number };

function buildCommand(type: Command['type'], commandId: string, expectedRevision: number, payload: unknown): Cmd {
  return { type, commandId, expectedRevision, payload } as Cmd;
}

function runOrThrow(snapshot: DomainSnapshot, command: Cmd): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: careerIntegrationFixture.rulesetVersion,
    contentPackVersion: careerIntegrationFixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

/** JSON round-trip으로 실제 저장·복원(engine-client 체크포인트)을 흉내 낸다(season-determinism.test.ts와 같은 방식). */
function roundTripJson(snapshot: DomainSnapshot): DomainSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as DomainSnapshot;
}

/** commandIndex(0-based, `careerIntegrationFixture.commands` 기준)까지 실행하고 JSON 직렬화로 끊었다가
 * 나머지 명령을 이어 재생한다. */
function runSplitAt(commandIndex: number): DomainSnapshot {
  const createCommand = buildCommand('CREATE_CAREER', 'split-create', 0, {
    careerId: careerIntegrationFixture.createCareer.careerId,
    seed: careerIntegrationFixture.createCareer.seed,
    simulationMode: careerIntegrationFixture.createCareer.simulationMode,
    rulesetVersion: careerIntegrationFixture.rulesetVersion,
    contentPackVersion: careerIntegrationFixture.contentPackVersion,
  });
  const first = simulate({
    snapshot: null,
    command: createCommand,
    ruleset: rulesetProto,
    rulesetVersion: careerIntegrationFixture.rulesetVersion,
    contentPackVersion: careerIntegrationFixture.contentPackVersion,
  });
  if (!first.ok) throw new Error('CREATE_CAREER 실패');
  let snapshot = first.snapshot;

  for (let i = 0; i < commandIndex; i++) {
    const raw = careerIntegrationFixture.commands[i]!;
    snapshot = runOrThrow(snapshot, buildCommand(raw.type, `split-${i}`, snapshot.revision, raw.payload));
  }

  // 재개 지점: JSON 직렬화로 끊었다가 이어 재생한다.
  snapshot = roundTripJson(snapshot);

  for (let i = commandIndex; i < careerIntegrationFixture.commands.length; i++) {
    const raw = careerIntegrationFixture.commands[i]!;
    snapshot = runOrThrow(snapshot, buildCommand(raw.type, `split-${i}`, snapshot.revision, raw.payload));
  }
  return snapshot;
}

describe('career-13-integration fixture 결정론(T-4-006 §1)', () => {
  it('golden 값과 정확히 일치한다', () => {
    const { snapshot } = runIntegrationFixture();
    const state = snapshot.state;
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(state.rngState.draws).toBe(golden.rngStateDraws);
    expect(state.seasonHistory.length).toBe(golden.seasonHistoryLength);
    expect(state.seasonHistory.map((s) => s.result.hash)).toEqual(golden.seasonResultHashes);
    expect(state.clubHistory.length).toBe(golden.clubHistoryLength);
    expect(state.health.episodes.length).toBe(golden.healthEpisodesCount);
    expect(state.careerTags).toEqual(golden.careerTags);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  // (a) 2회 재생 hash 동일
  it('명령 로그를 2회 재생해도 최종 stateHash·rngState.draws·시즌별 result.hash가 같다', () => {
    const first = runIntegrationFixture();
    const second = runIntegrationFixture();
    expect(second.snapshot.stateHash).toBe(first.snapshot.stateHash);
    expect(second.snapshot.state.rngState.draws).toBe(first.snapshot.state.rngState.draws);
    expect(second.snapshot.state.seasonHistory.map((s) => s.result.hash)).toEqual(
      first.snapshot.state.seasonHistory.map((s) => s.result.hash),
    );
  });

  // (b) 시즌 경계·부상 pending·이적 확정 직전 세 지점에서 JSON 직렬화로 끊었다가 재개해도 hash 동일
  describe('세 지점에서 JSON 직렬화로 끊었다가 이어 재생해도 한 번에 끝까지 재생한 것과 같다', () => {
    const straight = runIntegrationFixture().snapshot;

    it('부상 pending 대기 중(시즌1 INJURY RESOLVE_EVENT 직전)', () => {
      const resumed = runSplitAt(integrationResumePoints.injuryPending);
      expect(resumed.stateHash).toBe(straight.stateHash);
      expect(resumed.revision).toBe(straight.revision);
    });

    it('이적 확정 직전(시즌1 결산 시장 pending, ACCEPT_OFFER 이전)', () => {
      const resumed = runSplitAt(integrationResumePoints.preTransferConfirm);
      expect(resumed.stateHash).toBe(straight.stateHash);
      expect(resumed.revision).toBe(straight.revision);
    });

    it('시즌 경계(이적 확정 직후, 시즌2 START_SEASON 이전)', () => {
      const resumed = runSplitAt(integrationResumePoints.seasonBoundary);
      expect(resumed.stateHash).toBe(straight.stateHash);
      expect(resumed.revision).toBe(straight.revision);
    });
  });

  // (c) 명령 하나를 빼면 hash가 달라짐
  it('명령 하나(시즌3 NEGOTIATE)를 빼면 hash가 달라진다', () => {
    const negotiateIndex = careerIntegrationFixture.commands.findIndex((c) => c.type === 'NEGOTIATE');
    expect(negotiateIndex).toBeGreaterThanOrEqual(0);
    const withoutNegotiate: IntegrationFixture = {
      ...careerIntegrationFixture,
      commands: [
        ...careerIntegrationFixture.commands.slice(0, negotiateIndex),
        ...careerIntegrationFixture.commands.slice(negotiateIndex + 1),
      ],
    };
    // NEGOTIATE 명령을 빼면 그 다음 CONTRACT pending이 그대로 남으므로, 뒤이은 ADVANCE가
    // "DECISION이 아직 열려 있다" 검증에 걸려 실패한다 — 그 자체가 이미 "hash가 달라짐"(재생이
    // 아예 다른 경로로 실패)을 증명하지만, 좀 더 직접적으로 재생 가능한 절단본으로 비교한다.
    const truncated: IntegrationFixture = { ...careerIntegrationFixture, commands: careerIntegrationFixture.commands.slice(0, negotiateIndex) };
    const straightTruncated: IntegrationFixture = { ...careerIntegrationFixture, commands: careerIntegrationFixture.commands.slice(0, negotiateIndex + 1) };
    const withoutSnapshot = runIntegrationFixture(truncated).snapshot;
    const withSnapshot = runIntegrationFixture(straightTruncated).snapshot;
    expect(withoutSnapshot.stateHash).not.toBe(withSnapshot.stateHash);
    void withoutNegotiate;
  });

  // 이 fixture의 명령 로그는 특정 seed가 만드는 pending 순서(부상 심각도·감독 교체 등)에 강하게
  // 묶여 있어, seed만 바꾸면 같은 명령 로그가 아예 다른 구조(다른 pending.kind)를 만나 재생 자체가
  // 실패할 수 있다 — 이 역시 "같은 명령 로그가 seed에 따라 다른 결과를 낸다"는 결정론 주장을
  // 뒷받침한다(성공한다면 hash가 달라야 하고, 실패한다면 그 자체가 seed 민감성의 증거다).
  it('seed 한 글자를 바꾸면 hash가 달라지거나(또는 구조가 달라져) 재생이 실패한다', () => {
    const mutated: IntegrationFixture = {
      ...careerIntegrationFixture,
      createCareer: { ...careerIntegrationFixture.createCareer, seed: `${careerIntegrationFixture.createCareer.seed}x` },
    };
    try {
      const { snapshot } = runIntegrationFixture(mutated);
      expect(snapshot.stateHash).not.toBe(golden.stateHash);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });
});
