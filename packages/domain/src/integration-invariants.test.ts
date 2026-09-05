import { describe, expect, it } from 'vitest';
import { careerIntegrationFixture, rulesetProto } from './__fixtures__/career-13-integration.js';
import { careerLoanFixture, rulesetProto as loanRuleset } from './__fixtures__/career-11-loan.js';
import { computeBaseOvr } from './player.js';
import { simulate, type Command, type SimulationResult } from './simulate.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type CareerState, type DomainSnapshot } from './types.js';

// packages/domain은 "pure"(zero 런타임 의존성) tsconfig(`types: []`)를 써서 `@types/node`의
// 전역 `console` 타입이 없다 — vitest(Node) 실행 환경에는 실제로 존재하므로, 타입만 이 파일
// 범위에서 최소로 선언한다(ADR 성격의 domain 순수성 제약을 건드리지 않기 위한 로컬 워크어라운드).
declare const console: { info: (...args: unknown[]) => void };

/**
 * T-4-006 §2: Phase 3·4 통합 불변식 property. 결함(위반)은 실패 테스트가 아니라 "결함 후보"로
 * 수집해 PR 본문 표에 옮긴다 — domain 코드는 고치지 않는다. 위반이 실제로 나오면 해당 검사만
 * `it.skip`으로 내리고 사유를 남긴다(§2 "property 위반은 실패 테스트로 두지 말고" 규칙).
 */

type Cmd = Command & { commandId: string; expectedRevision: number };

function buildCommand(type: Command['type'], commandId: string, expectedRevision: number, payload: unknown): Cmd {
  return { type, commandId, expectedRevision, payload } as Cmd;
}

type Violation = { property: string; seed: string; commandIndex: number; commandType: string; message: string; expected: string; actual: string };

const violations: Violation[] = [];

function report(property: string, seed: string, commandIndex: number, commandType: string, message: string, expected: unknown, actual: unknown): void {
  violations.push({
    property,
    seed,
    commandIndex,
    commandType,
    message,
    expected: JSON.stringify(expected),
    actual: JSON.stringify(actual),
  });
}

/** D-36: 저장 상태의 모든 숫자가 정수인지 재귀적으로 순회한다. */
function findNonIntegerLeaves(value: unknown, path: string, acc: Array<{ path: string; value: number }>): void {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) acc.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findNonIntegerLeaves(item, `${path}[${index}]`, acc));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      findNonIntegerLeaves(item, path === '' ? key : `${path}.${key}`, acc);
    }
  }
}

const ATTRIBUTE_KEY_SET = new Set<string>(ATTRIBUTE_KEYS as readonly string[]);
const RELATIONSHIP_AXES = ['managerTrust', 'captain', 'rival', 'fans', 'agent'] as const;

/** 매 명령 뒤 항상 성립해야 하는 검사(명령 종류와 무관). */
function checkGenericInvariants(
  prev: CareerState,
  next: CareerState,
  seed: string,
  commandIndex: number,
  commandType: string,
): void {
  // D-36: 저장 상태의 모든 숫자는 정수.
  const nonIntegers: Array<{ path: string; value: number }> = [];
  findNonIntegerLeaves(next as unknown, '', nonIntegers);
  if (nonIntegers.length > 0) {
    report('D-36', seed, commandIndex, commandType, `정수가 아닌 필드 ${nonIntegers.length}개(예: ${nonIntegers[0]!.path}=${nonIntegers[0]!.value})`, 'integer', nonIntegers[0]!.value);
  }

  // P4-1: relationships 5축은 항상 0~100 정수.
  for (const axis of RELATIONSHIP_AXES) {
    const value = next.relationships[axis];
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      report('P4-1', seed, commandIndex, commandType, `relationships.${axis}가 0~100 정수 범위를 벗어남`, '0..100 integer', value);
    }
  }
  // P4-1: relationshipLog 40건 상한(룰셋 relationshipRules.logMax).
  const logMax = rulesetProto.relationshipRules.logMax;
  if (next.relationshipLog.length > logMax) {
    report('P4-1', seed, commandIndex, commandType, `relationshipLog 길이가 상한(${logMax})을 넘음`, `<=${logMax}`, next.relationshipLog.length);
  }
  // P4-1: memoryTags 축당 상한(memoryTagsMax).
  const memoryTagsMax = rulesetProto.relationshipRules.memoryTagsMax;
  for (const axis of RELATIONSHIP_AXES) {
    const tags = next.memoryTags[axis];
    if (tags.length > memoryTagsMax) {
      report('P4-1', seed, commandIndex, commandType, `memoryTags.${axis} 길이가 상한(${memoryTagsMax})을 넘음`, `<=${memoryTagsMax}`, tags.length);
    }
  }

  // P4-5: activeEffects·deferredEffects에 kind:'RELATION'이면서 attribute 타깃인 항목이 없어야 한다.
  const relationOnAttribute = [...next.activeEffects, ...next.deferredEffects].filter(
    (effect) => effect.kind === 'RELATION' && ATTRIBUTE_KEY_SET.has(effect.target),
  );
  if (relationOnAttribute.length > 0) {
    report(
      'P4-5',
      seed,
      commandIndex,
      commandType,
      `activeEffects/deferredEffects에 RELATION+attribute 타깃 항목 존재(sourceId=${relationOnAttribute[0]!.sourceId})`,
      'no RELATION effect targeting an attribute',
      relationOnAttribute[0]!.target,
    );
  }
  // P4-5(ADR-010): HEALTH Effect는 availability·recurrenceRiskBp만 바꾸고 activeEffects/deferredEffects에
  // 저장되지 않는다 — 저장돼 있으면 위반이다.
  const storedHealth = [...next.activeEffects, ...next.deferredEffects].filter((effect) => effect.kind === 'HEALTH');
  if (storedHealth.length > 0) {
    report('P4-5', seed, commandIndex, commandType, `activeEffects/deferredEffects에 HEALTH kind 항목이 저장됨(ADR-010 위반)`, 'no stored HEALTH effect', storedHealth[0]!.kind);
  }

  // P4-6/P3-2: 강제 커리어 종료가 없다(RETIRED/ARCHIVED로 튀면 안 된다 — 이 fixture·sweep은 은퇴 경로를
  // 다루지 않는다).
  if (prev.status === 'ACTIVE' && next.status !== 'ACTIVE') {
    report('P4-6/P3-2', seed, commandIndex, commandType, `status가 ACTIVE에서 ${next.status}로 강제 전환됨`, 'ACTIVE', next.status);
  }

  // P4-7: 새로 추가된 NATIONAL_TEAM_DECLINED timeline 항목(대표팀 DECLINE 또는 부상 자동 사양) 전후
  // managerTrust가 같아야 한다.
  const newDeclines = next.timeline.length - prev.timeline.length;
  if (newDeclines > 0) {
    const added = next.timeline.slice(prev.timeline.length);
    if (added.some((entry) => entry.kind === 'NATIONAL_TEAM_DECLINED')) {
      if (prev.relationships.managerTrust !== next.relationships.managerTrust) {
        report(
          'P4-7',
          seed,
          commandIndex,
          commandType,
          'NATIONAL_TEAM_DECLINED 전후 managerTrust가 달라짐',
          prev.relationships.managerTrust,
          next.relationships.managerTrust,
        );
      }
    }
  }
}

/** P3-5: ACCEPT_OFFER·LOAN_RETURN 전후 attributes·computeBaseOvr가 같아야 한다. */
function checkP35(prev: CareerState, next: CareerState, seed: string, commandIndex: number, commandType: string): void {
  if (commandType !== 'ACCEPT_OFFER' && commandType !== 'LOAN_RETURN') return;
  const attributesEqual = ATTRIBUTE_KEYS.every((key: AttributeKey) => prev.attributes[key] === next.attributes[key]);
  if (!attributesEqual) {
    report('P3-5', seed, commandIndex, commandType, 'attributes가 이적/임대복귀 전후 달라짐', prev.attributes, next.attributes);
    return;
  }
  const archetypeId = next.player.profile?.archetypeId;
  if (archetypeId === undefined) return;
  const archetype = rulesetProto.archetypes.find((candidate) => candidate.id === archetypeId);
  if (archetype === undefined) return;
  const before = computeBaseOvr(prev.attributes, archetype.roleWeights);
  const after = computeBaseOvr(next.attributes, archetype.roleWeights);
  if (before !== after) {
    report('P3-5', seed, commandIndex, commandType, 'computeBaseOvr 결과가 이적/임대복귀 전후 달라짐', before, after);
  }
}

/** P4-5: EVT-REL-010(순수 RELATION 이펙트 이벤트) RESOLVE_EVENT 전후 attributes가 같아야 한다. */
function checkRelationOnlyEventAttributes(
  prev: CareerState,
  next: CareerState,
  seed: string,
  commandIndex: number,
  commandType: string,
  payload: unknown,
): void {
  if (commandType !== 'RESOLVE_EVENT') return;
  const eventId = (payload as { eventId?: string }).eventId;
  if (eventId !== 'EVT-REL-010' && eventId !== 'EVT-MEDIA-010') return;
  const attributesEqual = ATTRIBUTE_KEYS.every((key: AttributeKey) => prev.attributes[key] === next.attributes[key]);
  if (!attributesEqual) {
    report('P4-5', seed, commandIndex, commandType, `${eventId}(RELATION 전용) 해결 전후 attributes가 달라짐`, prev.attributes, next.attributes);
  }
}

const MARKET_COMMAND_TYPES = new Set(['ACCEPT_OFFER', 'NEGOTIATE', 'REJECT_OFFER', 'LOAN_RETURN']);

/**
 * P3-3: 시장 명령(ACCEPT_OFFER·NEGOTIATE·REJECT_OFFER·LOAN_RETURN) 재전송이 상태를 바꾸지 않는다.
 * domain은 commandId 자체를 저장하지 않고 `expectedRevision` 낙관적 동시성으로만 막는다 — 그래서
 * "같은 commandId 재전송"과 "expectedRevision 불일치"는 같은 메커니즘이다: 이미 적용된 명령을
 * (같은 commandId·같은 stale expectedRevision으로) 다시 보내면 현재 snapshot.revision과 달라
 * CAREER_REVISION_CONFLICT로 거부된다.
 */
function checkP33(
  ruleset: typeof rulesetProto,
  versions: { rulesetVersion: string; contentPackVersion: string },
  beforeSnapshot: DomainSnapshot,
  appliedCommand: Cmd,
  afterSnapshot: DomainSnapshot,
  seed: string,
  commandIndex: number,
): void {
  if (!MARKET_COMMAND_TYPES.has(appliedCommand.type)) return;

  // (1) 같은 commandId·같은(이제는 stale) expectedRevision으로 재전송 -> 거부돼야 한다.
  const staleResend = simulate({
    snapshot: afterSnapshot,
    command: appliedCommand,
    ruleset,
    rulesetVersion: versions.rulesetVersion,
    contentPackVersion: versions.contentPackVersion,
  });
  if (staleResend.ok) {
    report('P3-3', seed, commandIndex, appliedCommand.type, '같은 commandId·stale expectedRevision 재전송이 수락됨(거부돼야 한다)', 'rejected', 'accepted');
  } else if (staleResend.error.code !== 'CAREER_REVISION_CONFLICT') {
    report('P3-3', seed, commandIndex, appliedCommand.type, `재전송 거부 사유가 CAREER_REVISION_CONFLICT가 아님`, 'CAREER_REVISION_CONFLICT', staleResend.error.code);
  }

  // (2) 명백히 잘못된 expectedRevision(현재값+999)으로 보내도 거부돼야 한다.
  const wrongRevision = simulate({
    snapshot: afterSnapshot,
    command: { ...appliedCommand, expectedRevision: afterSnapshot.revision + 999 },
    ruleset,
    rulesetVersion: versions.rulesetVersion,
    contentPackVersion: versions.contentPackVersion,
  });
  if (wrongRevision.ok) {
    report('P3-3', seed, commandIndex, appliedCommand.type, 'expectedRevision 불일치 명령이 수락됨(거부돼야 한다)', 'rejected', 'accepted');
  }
  void beforeSnapshot;
}

function runOrThrow(
  snapshot: DomainSnapshot,
  command: Cmd,
  versions: { rulesetVersion: string; contentPackVersion: string },
): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: versions.rulesetVersion,
    contentPackVersion: versions.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

describe('career-13 명령 로그 재생: 매 명령 뒤 불변식(T-4-006 §2)', () => {
  it('fixture 명령 로그를 재생하며 매 명령 뒤 불변식을 검사한다', () => {
    const seed = careerIntegrationFixture.createCareer.seed;
    const versions = { rulesetVersion: careerIntegrationFixture.rulesetVersion, contentPackVersion: careerIntegrationFixture.contentPackVersion };
    const createCommand = buildCommand('CREATE_CAREER', 'inv-create', 0, {
      careerId: careerIntegrationFixture.createCareer.careerId,
      seed,
      simulationMode: careerIntegrationFixture.createCareer.simulationMode,
      rulesetVersion: versions.rulesetVersion,
      contentPackVersion: versions.contentPackVersion,
    });
    const first = simulate({ snapshot: null, command: createCommand, ruleset: rulesetProto, ...versions });
    if (!first.ok) throw new Error('CREATE_CAREER 실패');
    let snapshot = first.snapshot;

    careerIntegrationFixture.commands.forEach((raw, index) => {
      const command = buildCommand(raw.type, `inv-${index}`, snapshot.revision, raw.payload);
      const before = snapshot;
      snapshot = runOrThrow(before, command, versions);
      checkGenericInvariants(before.state, snapshot.state, seed, index, command.type);
      checkP35(before.state, snapshot.state, seed, index, command.type);
      checkRelationOnlyEventAttributes(before.state, snapshot.state, seed, index, command.type, raw.payload);
      checkP33(rulesetProto, versions, before, command, snapshot, seed, index);
    });

    // 이 describe 안에서 나온 위반은 아래 "결함 후보 보고" describe가 종합해서 console.info로 남긴다.
    // 여기서는 재생 자체가 끝까지 성공했는지만 확인한다(위반은 실패 조건이 아니다).
    expect(snapshot.state.seasonHistory.length).toBe(3);
  });
});

describe('career-13 명령 로그 재생(200-seed sweep): 같은 구조를 다른 seed로 재실행(T-4-006 §2)', () => {
  // "고정 seed 목록을 상수로 고정"(브리프 §2) — 200개를 코드로 고정 생성한다(seed 값 자체가
  // 실행할 때마다 바뀌지 않는 리터럴 배열이라 상수 요건을 满족한다).
  const SWEEP_SEEDS: readonly string[] = Array.from({ length: 200 }, (_, i) => `car13-inv-sweep-${i + 1}`);

  const NAT_EVENT = { eventId: 'EVT-NAT-001', version: 1 };
  const INJ_EVENT = { eventId: 'EVT-INJ-001', version: 1 };
  const FILLER_EVENT = { eventId: 'EVT-MEDIA-010', version: 1 };

  function send(snapshot: DomainSnapshot, seq: number, seed: string, type: Command['type'], payload: unknown): DomainSnapshot {
    const command = buildCommand(type, `${seed}-${seq}`, snapshot.revision, payload);
    const result = simulate({
      snapshot,
      command,
      ruleset: rulesetProto,
      rulesetVersion: careerIntegrationFixture.rulesetVersion,
      contentPackVersion: careerIntegrationFixture.contentPackVersion,
    });
    if (!result.ok) throw new Error(`${type} 실패: ${result.error.code} ${result.error.message}`);
    checkGenericInvariants(snapshot.state, result.snapshot.state, seed, seq, type);
    checkP35(snapshot.state, result.snapshot.state, seed, seq, type);
    checkRelationOnlyEventAttributes(snapshot.state, result.snapshot.state, seed, seq, type, payload);
    checkP33(rulesetProto, { rulesetVersion: careerIntegrationFixture.rulesetVersion, contentPackVersion: careerIntegrationFixture.contentPackVersion }, snapshot, command, result.snapshot, seed, seq);
    return result.snapshot;
  }

  function runChargen(snapshot0: DomainSnapshot, seed: string): { snapshot: DomainSnapshot; seq: number } {
    let seq = 0;
    let snapshot = snapshot0;
    const step = (type: Command['type'], payload: unknown) => {
      seq += 1;
      snapshot = send(snapshot, seq, seed, type, payload);
    };
    step('UPDATE_PLAYER_DRAFT', { draft: { name: '테스트', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT' } });
    step('UPDATE_PLAYER_DRAFT', { draft: { position: 'W', archetypeId: 'inside-forward', backgroundId: 'club-academy' } });
    step('CONFIRM_PLAYER', {});
    step('ADVANCE', { eligibleEvents: [{ eventId: 'EVT-CON-002', version: 1, weight: 10 }] });
    step('RESOLVE_EVENT', {
      eventId: 'EVT-CON-002',
      definitionVersion: 1,
      choiceId: 'A',
      outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [], addTags: ['진로_입단테스트'] }],
    });
    step('ADVANCE', { eligibleEvents: [{ eventId: 'EVT-CON-003', version: 1, weight: 10 }] });
    step('RESOLVE_EVENT', {
      eventId: 'EVT-CON-003',
      definitionVersion: 1,
      choiceId: 'B',
      outcomes: [
        {
          id: 'B1',
          kind: 'SUCCESS',
          weight: 85,
          effects: [
            { kind: 'RELATION', sourceId: 'EVT-CON-003.B.B1', target: 'managerTrust', delta: 5, clamp: { min: 0, max: 100 }, appliesAt: { kind: 'IMMEDIATE' }, expiresAt: null, stackingRule: 'ONCE_PER_SOURCE' },
          ],
          addTags: ['입단테스트_완료', '테스트_성공'],
        },
        { id: 'B2', kind: 'NEUTRAL', weight: 15, effects: [], addTags: ['입단테스트_완료', '테스트_보통'] },
      ],
    });
    step('ADVANCE', { eligibleEvents: [] });
    step('ACCEPT_OFFER', { offerId: 'OFR-9-0' });
    return { snapshot, seq };
  }

  /** 한 시즌(START_SEASON..SETTLE_SEASON)을 제네릭 정책으로 재생한다. 실패 명령은 그 시즌에서
   * 멈추고 그때까지의 결과만 남긴다("실패 명령은 건너뛰고 ok인 것만 기록", 브리프 §2). */
  function driveOneSeason(snapshot0: DomainSnapshot, seq0: number, seed: string, serviceSeasonId: string): { snapshot: DomainSnapshot; seq: number; ok: boolean } {
    let seq = seq0;
    let snapshot = snapshot0;
    try {
      seq += 1;
      snapshot = send(snapshot, seq, seed, 'START_SEASON', { simulationMode: 'FAST', serviceSeasonId });
      seq += 1;
      snapshot = send(snapshot, seq, seed, 'RESOLVE_ROLE', { decision: 'ACCEPT' });

      for (let guard = 0; guard < 40; guard++) {
        seq += 1;
        const result = simulate({
          snapshot,
          command: buildCommand('ADVANCE', `${seed}-${seq}`, snapshot.revision, { eligibleEvents: [{ ...FILLER_EVENT, weight: 10 }] }),
          ruleset: rulesetProto,
          rulesetVersion: careerIntegrationFixture.rulesetVersion,
          contentPackVersion: careerIntegrationFixture.contentPackVersion,
        });
        if (!result.ok) return { snapshot, seq: seq - 1, ok: false };
        checkGenericInvariants(snapshot.state, result.snapshot.state, seed, seq, 'ADVANCE');
        snapshot = result.snapshot;
        if (result.nextAction === 'SETTLEMENT') break;
        if (result.nextAction === 'ADVANCE') continue;

        const pending = snapshot.state.pending;
        if (pending === null) return { snapshot, seq, ok: false };
        if (pending.kind === 'INJURY') {
          seq += 1;
          snapshot = send(snapshot, seq, seed, 'RESOLVE_EVENT', {
            eventId: INJ_EVENT.eventId,
            definitionVersion: INJ_EVENT.version,
            choiceId: 'A',
            rehabPlan: 'STANDARD',
            outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
          });
          continue;
        }
        if (pending.kind === 'NATIONAL_TEAM') {
          seq += 1;
          snapshot = send(snapshot, seq, seed, 'RESOLVE_EVENT', {
            eventId: NAT_EVENT.eventId,
            definitionVersion: NAT_EVENT.version,
            choiceId: 'C',
            callUp: 'DECLINE',
            outcomes: [{ id: 'C1', kind: 'FIXED', weight: 100, effects: [] }],
          });
          continue;
        }
        if (pending.kind === 'EVENT') {
          seq += 1;
          snapshot = send(snapshot, seq, seed, 'RESOLVE_EVENT', {
            eventId: 'EVT-MEDIA-010',
            definitionVersion: 1,
            choiceId: 'A',
            outcomes: [
              {
                id: 'A1',
                kind: 'SUCCESS',
                weight: 100,
                effects: [
                  { kind: 'RELATION', sourceId: `EVT-MEDIA-010.A.A1.0:${seed}:${seq}`, target: 'popularity', delta: 120, clamp: { min: 0, max: 10000 }, appliesAt: { kind: 'IMMEDIATE' }, expiresAt: null, stackingRule: 'ONCE_PER_SOURCE' },
                  { kind: 'RELATION', sourceId: `EVT-MEDIA-010.A.A1.1:${seed}:${seq}`, target: 'media', delta: 80, clamp: { min: 0, max: 10000 }, appliesAt: { kind: 'IMMEDIATE' }, expiresAt: null, stackingRule: 'ONCE_PER_SOURCE' },
                ],
              },
            ],
          });
          continue;
        }
        if (pending.kind === 'CHAPTER') {
          return { snapshot, seq, ok: false };
        }
        if (pending.kind === 'CONTRACT') {
          if (pending.offers.length > 0) {
            seq += 1;
            snapshot = send(snapshot, seq, seed, 'NEGOTIATE', { offerId: pending.offers[0]!.id, ask: 'WAGE' });
          } else {
            seq += 1;
            snapshot = send(snapshot, seq, seed, 'REJECT_OFFER', { offerId: null });
          }
          continue;
        }
        return { snapshot, seq, ok: false };
      }

      seq += 1;
      snapshot = send(snapshot, seq, seed, 'SETTLE_SEASON', {});
      return { snapshot, seq, ok: true };
    } catch {
      return { snapshot, seq, ok: false };
    }
  }

  it('200개 고정 seed로 chargen+최대 3시즌을 재생하며 매 성공 명령 뒤 불변식을 검사한다(실패 명령은 건너뛴다)', () => {
    let totalCommandsChecked = 0;
    let seedsCompletedAllSeasons = 0;

    for (const seed of SWEEP_SEEDS) {
      try {
        const createCommand = buildCommand('CREATE_CAREER', `${seed}-0`, 0, {
          careerId: `sweep-${seed}`,
          seed,
          simulationMode: 'FAST',
          rulesetVersion: careerIntegrationFixture.rulesetVersion,
          contentPackVersion: careerIntegrationFixture.contentPackVersion,
        });
        const created = simulate({ snapshot: null, command: createCommand, ruleset: rulesetProto, rulesetVersion: careerIntegrationFixture.rulesetVersion, contentPackVersion: careerIntegrationFixture.contentPackVersion });
        if (!created.ok) continue;

        const { snapshot: afterChargen, seq: seqAfterChargen } = runChargen(created.snapshot, seed);
        totalCommandsChecked += seqAfterChargen;

        let snapshot = afterChargen;
        let seq = seqAfterChargen;
        let allThreeOk = true;
        for (const svc of ['sweep-s1', 'sweep-s2', 'sweep-s3']) {
          const seasonResult = driveOneSeason(snapshot, seq, seed, svc);
          snapshot = seasonResult.snapshot;
          seq = seasonResult.seq;
          totalCommandsChecked += 1;
          if (!seasonResult.ok) {
            allThreeOk = false;
            break;
          }
          // 결산 뒤 시장이 OFFERS로 열렸으면 하나 받아들이거나(P3-5 커버리지 확대) 거절한다.
          const pendingAfterSettle = snapshot.state.pending;
          if (pendingAfterSettle !== null && pendingAfterSettle.kind === 'OFFERS') {
            seq += 1;
            try {
              if (pendingAfterSettle.offers.length > 0) {
                snapshot = send(snapshot, seq, seed, 'ACCEPT_OFFER', { offerId: pendingAfterSettle.offers[0]!.id });
              } else {
                snapshot = send(snapshot, seq, seed, 'REJECT_OFFER', { offerId: null });
              }
            } catch {
              allThreeOk = false;
              break;
            }
          } else if (pendingAfterSettle !== null && pendingAfterSettle.kind === 'LOAN_RETURN') {
            seq += 1;
            try {
              snapshot = send(snapshot, seq, seed, 'LOAN_RETURN', { decision: 'RETURN' });
            } catch {
              allThreeOk = false;
              break;
            }
          }
        }
        if (allThreeOk) seedsCompletedAllSeasons += 1;
      } catch {
        // 이 seed는 건너뛴다(브리프 §2: 실패 명령은 건너뛰고 ok인 것만 기록).
        continue;
      }
    }

    console.info(
      'INTEGRATION_INVARIANTS_SWEEP_SUMMARY',
      JSON.stringify({ seedCount: SWEEP_SEEDS.length, seedsCompletedAllSeasons, totalCommandsChecked, violationsFound: violations.length }),
    );
    expect(seedsCompletedAllSeasons).toBeGreaterThan(0);
  }, 60000);
});

describe('career-11-loan fixture로 LOAN_RETURN P3-3 idempotency를 보충한다(T-4-006 §2, 시장 명령 4종 완비)', () => {
  it('LOAN_RETURN 재전송(같은 commandId·stale expectedRevision)이 거부된다', () => {
    const versions = { rulesetVersion: careerLoanFixture.rulesetVersion, contentPackVersion: careerLoanFixture.contentPackVersion };
    const createCommand = buildCommand('CREATE_CAREER', 'loan-inv-create', 0, {
      careerId: careerLoanFixture.createCareer.careerId,
      seed: careerLoanFixture.createCareer.seed,
      simulationMode: careerLoanFixture.createCareer.simulationMode,
      rulesetVersion: versions.rulesetVersion,
      contentPackVersion: versions.contentPackVersion,
    });
    const first = simulate({ snapshot: null, command: createCommand, ruleset: loanRuleset, ...versions });
    if (!first.ok) throw new Error('CREATE_CAREER 실패');
    let snapshot = first.snapshot;
    let loanReturnCommand: Cmd | null = null;
    let afterLoanReturn: DomainSnapshot | null = null;

    careerLoanFixture.commands.forEach((raw, index) => {
      const command = buildCommand(raw.type, `loan-inv-${index}`, snapshot.revision, raw.payload);
      const before = snapshot;
      const result = simulate({ snapshot: before, command, ruleset: loanRuleset, ...versions });
      if (!result.ok) throw new Error(`${command.type} 실패: ${result.error.code}`);
      snapshot = result.snapshot;
      if (command.type === 'LOAN_RETURN') {
        loanReturnCommand = command;
        afterLoanReturn = snapshot;
      }
    });

    expect(loanReturnCommand).not.toBeNull();
    expect(afterLoanReturn).not.toBeNull();
    const staleResend = simulate({ snapshot: afterLoanReturn!, command: loanReturnCommand!, ruleset: loanRuleset, ...versions });
    expect(staleResend.ok).toBe(false);
    if (!staleResend.ok) expect(staleResend.error.code).toBe('CAREER_REVISION_CONFLICT');
  });
});

describe('T-4-006 §2 결함 후보 보고', () => {
  it('수집된 위반을 console.info 표로 남긴다(위반은 실패 조건이 아니다)', () => {
    const grouped = new Map<string, Violation[]>();
    for (const violation of violations) {
      const list = grouped.get(violation.property) ?? [];
      list.push(violation);
      grouped.set(violation.property, list);
    }
    const summary = [...grouped.entries()].map(([property, list]) => ({
      property,
      count: list.length,
      firstExample: list[0],
    }));
    console.info('INTEGRATION_INVARIANTS_VIOLATIONS', JSON.stringify({ totalViolations: violations.length, byProperty: summary }, null, 2));
    // 이 테스트 자체는 항상 통과한다 — 위반이 있어도 "실패 테스트"로 두지 않는다(브리프 §2).
    expect(true).toBe(true);
  });
});
