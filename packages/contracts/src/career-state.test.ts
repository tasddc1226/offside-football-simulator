import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashState,
  simulate,
  type CareerState as DomainCareerState,
  type Contract as DomainContract,
  type DomainSnapshot,
  type Effect as DomainEffect,
  type FootballSeason as DomainFootballSeason,
  type Offer as DomainOffer,
  type Pending as DomainPending,
  type SeasonSummary as DomainSeasonSummary,
  type SimulationMode,
  type SquadRole,
  type TimelineEntry as DomainTimelineEntry,
} from '@offside/domain';
import {
  career01,
  career01EngineCommands,
  career02Season,
  career02SeasonEngineCommands,
  career03Underdog,
  career03UnderdogEngineCommands,
  career04Gk,
  career04GkEngineCommands,
  rulesetProto,
  type EngineCommand,
} from '@offside/fixtures';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  CareerStateSchema,
  ContractSchema,
  EffectSchema,
  FootballSeasonSchema,
  OfferSchema,
  PendingSchema,
  SeasonSummarySchema,
  SquadRoleSchema,
  TimelineEntrySchema,
} from './career-state.js';

describe('domain 타입 동일성', () => {
  it('SquadRole', () => {
    expectTypeOf<z.infer<typeof SquadRoleSchema>>().toEqualTypeOf<SquadRole>();
  });

  it('Offer', () => {
    expectTypeOf<z.infer<typeof OfferSchema>>().toEqualTypeOf<DomainOffer>();
  });

  it('Contract', () => {
    expectTypeOf<z.infer<typeof ContractSchema>>().toEqualTypeOf<DomainContract>();
  });

  it('Pending', () => {
    expectTypeOf<z.infer<typeof PendingSchema>>().toEqualTypeOf<DomainPending>();
  });

  it('TimelineEntry', () => {
    expectTypeOf<z.infer<typeof TimelineEntrySchema>>().toEqualTypeOf<DomainTimelineEntry>();
  });

  it('Effect', () => {
    expectTypeOf<z.infer<typeof EffectSchema>>().toEqualTypeOf<DomainEffect>();
  });

  it('CareerState', () => {
    expectTypeOf<z.infer<typeof CareerStateSchema>>().toEqualTypeOf<DomainCareerState>();
  });

  // T-2-006: T-2-001/002가 CareerState에 넣은 시즌 필드도 개별적으로 domain과 고정한다(CareerState
  // 전체 비교가 이미 이 필드들을 포함하지만, 시즌 구조 자체의 드리프트를 더 좁게 잡기 위해 따로 둔다).
  it('FootballSeason', () => {
    expectTypeOf<z.infer<typeof FootballSeasonSchema>>().toEqualTypeOf<DomainFootballSeason>();
  });

  it('SeasonSummary', () => {
    expectTypeOf<z.infer<typeof SeasonSummarySchema>>().toEqualTypeOf<DomainSeasonSummary>();
  });
});

const VALID_OFFER = {
  id: 'OFR-2-0',
  teamId: 'hangang-u18',
  teamName: '한강 U18',
  leagueTier: 'YOUTH' as const,
  lengthSeasons: 1,
  wageMinorPerWeek: 300_000,
  signingBonusMinor: 0,
  rolePromise: 'STARTER' as const,
  shirtNumber: 10,
  tacticalFitEstimate: 60,
};

const VALID_CONTRACT = {
  id: 'CTR-3',
  offerId: 'OFR-2-0',
  teamId: 'hangang-u18',
  teamName: '한강 U18',
  leagueTier: 'YOUTH' as const,
  lengthSeasons: 1,
  wageMinorPerWeek: 300_000,
  signingBonusMinor: 0,
  rolePromise: 'STARTER' as const,
  shirtNumber: 10,
  signatureType: 'AUTO' as const,
  signedAtRevision: 3,
};

const VALID_EFFECT = {
  kind: 'PERMANENT' as const,
  sourceId: 'EVT-CON-002:a:outcome-1',
  target: 'shooting',
  delta: 2,
  clamp: { min: 1, max: 99 },
  appliesAt: { kind: 'IMMEDIATE' as const },
  expiresAt: null,
  stackingRule: 'ONCE_PER_SOURCE' as const,
};

describe('OfferSchema·ContractSchema·EffectSchema 스모크', () => {
  it('유효한 Offer를 받아들인다', () => {
    expect(OfferSchema.safeParse(VALID_OFFER).success).toBe(true);
  });

  it('유효한 Contract를 받아들인다', () => {
    expect(ContractSchema.safeParse(VALID_CONTRACT).success).toBe(true);
  });

  it("signatureType이 'AUTO'가 아니면 거부한다", () => {
    expect(ContractSchema.safeParse({ ...VALID_CONTRACT, signatureType: 'MANUAL' }).success).toBe(false);
  });

  it('유효한 Effect를 받아들인다(appliesAt IMMEDIATE, expiresAt null)', () => {
    expect(EffectSchema.safeParse(VALID_EFFECT).success).toBe(true);
  });

  it('유효한 Effect를 받아들인다(appliesAt NEXT_SEASON_STEP, expiresAt STEPS_AFTER)', () => {
    const effect = {
      ...VALID_EFFECT,
      appliesAt: { kind: 'NEXT_SEASON_STEP', step: 3 },
      expiresAt: { kind: 'STEPS_AFTER', steps: 2 },
    };
    expect(EffectSchema.safeParse(effect).success).toBe(true);
  });
});

describe('PendingSchema', () => {
  it('null을 받아들인다', () => {
    expect(PendingSchema.safeParse(null).success).toBe(true);
  });

  it("kind 'EVENT'를 받아들인다", () => {
    expect(PendingSchema.safeParse({ kind: 'EVENT', eventId: 'EVT-CON-002', version: 1 }).success).toBe(true);
  });

  it("kind 'OFFERS'를 받아들인다", () => {
    expect(PendingSchema.safeParse({ kind: 'OFFERS', offers: [VALID_OFFER] }).success).toBe(true);
  });

  it("kind 'OFFERS'인데 offers가 없으면 거부한다", () => {
    expect(PendingSchema.safeParse({ kind: 'OFFERS' }).success).toBe(false);
  });
});

function zeroAttributes(): Record<string, number> {
  const attrs: Record<string, number> = {};
  for (const key of [
    'shooting',
    'passing',
    'dribbling',
    'tackling',
    'firstTouch',
    'crossing',
    'goalkeeping',
    'pace',
    'acceleration',
    'agility',
    'jumping',
    'stamina',
    'strength',
    'durability',
    'decisions',
    'concentration',
    'composure',
    'positioning',
    'leadership',
    'consistency',
  ]) {
    attrs[key] = 50;
  }
  return attrs;
}

/** D-7 CONFIRM_PLAYER 직후 상태, D-5 club-academy 배경 값(golden과 같은 초기값)으로 만든 리터럴. */
function confirmedStateLiteral() {
  return {
    schemaVersion: 1 as const,
    careerId: 'car_1',
    status: 'ACTIVE' as const,
    stage: 'YOUTH' as const,
    age: 17,
    currentStep: 12,
    seasonPhase: 'SETTLEMENT' as const,
    simulationMode: 'FAST' as const,
    attributes: zeroAttributes(),
    state: { form: 50, fitness: 80, morale: 60 },
    context: { tacticalFit: 58, squadStatus: 40, positionProficiency: 100 },
    relationships: { managerTrust: 40, captain: 50, rival: 50, fans: 50, agent: 50 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    rngState: { s: [1, 2, 3, 4] as const, draws: 23 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: {
        name: '김서준',
        gender: 'UNSPECIFIED' as const,
        nationalityCode: 'KR',
        preferredFoot: 'RIGHT' as const,
        position: 'W' as const,
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
      },
      profile: {
        name: '김서준',
        gender: 'UNSPECIFIED' as const,
        nationalityCode: 'KR',
        preferredFoot: 'RIGHT' as const,
        preferredPosition: 'W' as const,
        primaryPosition: 'W' as const,
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
        truePotential: 80,
        scoutedPotentialMin: 72,
        scoutedPotentialMax: 85,
        baseOvr: 59,
      },
    },
    pending: null,
    contract: null,
    timeline: [{ revision: 2, kind: 'CAREER_CONFIRMED' as const, refId: null, age: 17, step: 12 }],
    season: null,
    seasonHistory: [],
  };
}

describe('CareerStateSchema', () => {
  it('확정 직후 상태 리터럴을 받아들인다', () => {
    const result = CareerStateSchema.safeParse(confirmedStateLiteral());
    expect(result.success).toBe(true);
  });

  it('알 수 없는 최상위 키는 거부한다', () => {
    const state = { ...confirmedStateLiteral(), extraField: 1 };
    expect(CareerStateSchema.safeParse(state).success).toBe(false);
  });

  it('능력 키가 하나 빠지면 거부한다', () => {
    const state = confirmedStateLiteral();
    const attributes = { ...state.attributes };
    delete (attributes as Record<string, number>).consistency;
    expect(CareerStateSchema.safeParse({ ...state, attributes }).success).toBe(false);
  });

  it('schemaVersion: 2는 거부한다', () => {
    const state = { ...confirmedStateLiteral(), schemaVersion: 2 };
    expect(CareerStateSchema.safeParse(state).success).toBe(false);
  });

  it("pending이 { kind: 'OFFERS' }인데 offers가 없으면 거부한다", () => {
    const state = { ...confirmedStateLiteral(), pending: { kind: 'OFFERS' } };
    expect(CareerStateSchema.safeParse(state).success).toBe(false);
  });
});

/**
 * T-2-006: golden 순회 테스트. `packages/fixtures`의 각 fixture를 domain `simulate`로 처음부터
 * 그대로 재생하며, 매 명령 뒤 상태를 `CareerStateSchema`(strict)로 파싱하고, 파싱 결과를
 * `hashState`로 다시 해시해 domain이 계산한 `stateHash`와 같은지 검사한다. 도메인이 필드를
 * 더했는데 이 스키마가 모르면 strict 파싱이 실패하고, 스키마의 default·transform이 상태를 바꾸면
 * 재해시한 값이 달라져 실패한다.
 *
 * 확인(2026-09-03): `FootballSeasonSchema`에서 `matches: z.array(MatchRecordSchema),` 줄을 잠시
 * 지우고 이 describe 블록을 실행하면 career-02-season(FAST·CHAPTER) 두 케이스 모두 "알 수 없는 키
 * matches" strict 파싱 오류로 실패한다(원상 복구 후 통과 확인함).
 */
describe('golden 순회: fixture를 처음부터 재생한 모든 상태가 CareerStateSchema를 통과하고 hash가 golden과 같다', () => {
  // 디렉터리 glob으로 golden 목록을 구해, 이 테스트가 실제로 다루는 목록과 다르면 실패한다. T-2-003이
  // career-04-gk를 추가하면 여기서 실패하므로 이 describe에 새 순회 블록을 추가하라는 신호가 된다
  // (fixture마다 명령 생성 함수의 시그니처가 달라 — career01/03은 독립 실행, career02는 career01 뒤에
  // 이어 붙는 방식 — export 이름만으로 완전히 자동 실행할 수는 없다. packages/fixtures는 이 작업에서
  // 읽기만 허용되어 공통 실행 인터페이스를 새로 만들 수 없다. PR 본문 "범위 밖 발견 사항" 참고).
  const KNOWN_GOLDEN_FILES = [
    'career-01.golden.json',
    'career-02-season.golden.json',
    'career-03-underdog.golden.json',
    'career-04-gk.golden.json',
  ];

  it('packages/fixtures/src/*/의 *.golden.json 목록이 이 테스트가 재생하는 목록과 같다', () => {
    const fixturesSrcDir = fileURLToPath(new URL('../../fixtures/src', import.meta.url));
    const found = readdirSync(fixturesSrcDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) =>
        readdirSync(path.join(fixturesSrcDir, entry.name)).filter((name) => name.endsWith('.golden.json')),
      )
      .sort();
    expect(found).toEqual([...KNOWN_GOLDEN_FILES].sort());
  });

  function runOrThrow(
    snapshot: DomainSnapshot | null,
    command: EngineCommand,
    versions: { rulesetVersion: string; contentPackVersion: string },
  ): DomainSnapshot {
    const result = simulate({
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

  /** 매 명령 뒤 상태를 strict 스키마로 파싱하고, 파싱 결과를 재해시해 domain이 계산한 hash와 비교한다. */
  function assertStateRoundTrips(snapshot: DomainSnapshot, label: string): void {
    const parsed = CareerStateSchema.parse(snapshot.state);
    expect(hashState(parsed as unknown as DomainCareerState), label).toBe(snapshot.stateHash);
  }

  it('career-01: 매 명령 뒤 상태가 스키마를 통과하고 최종 hash가 golden과 같다', () => {
    let counter = 0;
    const commands = career01EngineCommands(() => `golden-c1-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career01);
      assertStateRoundTrips(snapshot, `career01 revision ${snapshot.revision}`);
    }
    if (snapshot === null) throw new Error('career01 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career01.golden.revision);
    expect(snapshot.stateHash).toBe(career01.golden.stateHash);
  });

  it.each(['FAST', 'CHAPTER'] as const)(
    'career-02-season(%s): career-01 뒤에 이어 재생한 매 명령 뒤 상태가 스키마를 통과하고(ROLE_PROPOSAL pending 포함) 최종 hash가 golden과 같다',
    (mode: SimulationMode) => {
      let counter = 0;
      const newId = () => `golden-c2-${mode}-${counter++}`;

      let snapshot: DomainSnapshot | null = null;
      for (const command of career01EngineCommands(newId)) {
        snapshot = runOrThrow(snapshot, command, career01);
      }
      if (snapshot === null) throw new Error('career01 선행 재생이 비어 있다.');

      let sawRoleProposalPending = false;
      for (const command of career02SeasonEngineCommands(mode, newId, snapshot.revision)) {
        snapshot = runOrThrow(snapshot, command, career02Season);
        assertStateRoundTrips(snapshot, `career02Season(${mode}) revision ${snapshot.revision}`);
        if (snapshot.state.pending?.kind === 'ROLE_PROPOSAL') sawRoleProposalPending = true;
      }

      expect(sawRoleProposalPending, `${mode} 모드는 ROLE_PROPOSAL pending 상태를 거쳐야 한다`).toBe(true);
      expect(snapshot.revision).toBe(career02Season.golden[mode].revision);
      expect(snapshot.stateHash).toBe(career02Season.golden[mode].stateHash);
    },
  );

  it('career-03-underdog: 매 명령 뒤 상태가 스키마를 통과하고 최종 hash가 golden과 같다', () => {
    let counter = 0;
    const commands = career03UnderdogEngineCommands(() => `golden-c3-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career03Underdog);
      assertStateRoundTrips(snapshot, `career03Underdog revision ${snapshot.revision}`);
    }
    if (snapshot === null) throw new Error('career03Underdog 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career03Underdog.golden.revision);
    expect(snapshot.stateHash).toBe(career03Underdog.golden.stateHash);
    expect(snapshot.state.pending?.kind).toBe('ROLE_PROPOSAL');
  });

  // T-2-003: GK 아키타입으로 START_SEASON부터 SETTLE_SEASON까지(FAST) 이어 재생한다. career01·03과
  // 같은 독립 실행 fixture다(career04GkEngineCommands가 CREATE_CAREER부터 자체적으로 만든다).
  it('career-04-gk: 매 명령 뒤 상태가 스키마를 통과하고 최종 hash가 golden과 같다(SETTLE_SEASON까지)', () => {
    let counter = 0;
    const commands = career04GkEngineCommands(() => `golden-c4-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career04Gk);
      assertStateRoundTrips(snapshot, `career04Gk revision ${snapshot.revision}`);
    }
    if (snapshot === null) throw new Error('career04Gk 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career04Gk.golden.revision);
    expect(snapshot.stateHash).toBe(career04Gk.golden.stateHash);
    expect(snapshot.state.season).toBeNull();
  });
});
