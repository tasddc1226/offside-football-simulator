import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashState,
  canonicalize,
  simulate,
  type ClubStint as DomainClubStint,
  type CareerState as DomainCareerState,
  type ChapterRecord as DomainChapterRecord,
  type Contract as DomainContract,
  type DomainSnapshot,
  type Effect as DomainEffect,
  type FootballSeason as DomainFootballSeason,
  type JsonValue,
  type NationalityRuleState as DomainNationalityRuleState,
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
  career05Chapter,
  career05ChapterEngineCommands,
  career06Settled,
  career06SettledEngineCommands,
  career07Df,
  career07DfEngineCommands,
  career08Mf,
  career08MfEngineCommands,
  career09Fw,
  career09FwEngineCommands,
  career10Transfer,
  career10TransferEngineCommands,
  career11Loan,
  career11LoanEngineCommands,
  career12Injury,
  career12InjuryEngineCommands,
  career13Integration,
  career13IntegrationEngineCommands,
  rulesetProto,
  type EngineCommand,
} from '@offside/fixtures';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  CareerStateSchema,
  ChapterRecordSchema,
  ClubStintSchema,
  ContractSchema,
  EffectSchema,
  FinalLeagueTableSchema,
  FootballSeasonSchema,
  InjuryEpisodeSchema,
  NationalityRuleStateSchema,
  OfferSchema,
  PendingSchema,
  SeasonSummarySchema,
  SquadRoleSchema,
  TimelineEntrySchema,
  getCareerStateInvariantIssues,
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

  it('ClubStint', () => {
    expectTypeOf<z.infer<typeof ClubStintSchema>>().toEqualTypeOf<DomainClubStint>();
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

  it('NationalityRuleState', () => {
    expectTypeOf<z.infer<typeof NationalityRuleStateSchema>>().toEqualTypeOf<DomainNationalityRuleState>();
  });

  // T-2-006: T-2-001/002가 CareerState에 넣은 시즌 필드도 개별적으로 domain과 고정한다(CareerState
  // 전체 비교가 이미 이 필드들을 포함하지만, 시즌 구조 자체의 드리프트를 더 좁게 잡기 위해 따로 둔다).
  it('FootballSeason', () => {
    expectTypeOf<z.infer<typeof FootballSeasonSchema>>().toEqualTypeOf<DomainFootballSeason>();
  });

  it('SeasonSummary', () => {
    expectTypeOf<z.infer<typeof SeasonSummarySchema>>().toEqualTypeOf<DomainSeasonSummary>();
  });

  // T-2-004 D-38: FootballSeason과 마찬가지로 CareerState 전체 비교가 이미 포함하지만, chapters
  // 드리프트를 더 좁게 잡기 위해 따로 둔다.
  it('ChapterRecord', () => {
    expectTypeOf<z.infer<typeof ChapterRecordSchema>>().toEqualTypeOf<DomainChapterRecord>();
  });
});

const VALID_OFFER = {
  id: 'OFR-2-0',
  kind: 'FREE_AGENT' as const,
  teamId: 'hangang-u18',
  teamName: '한강 U18',
  fromTeamId: null,
  leagueTier: 'YOUTH' as const,
  lengthSeasons: 1,
  wageMinorPerWeek: 300_000,
  signingBonusMinor: 0,
  transferFeeMinor: null,
  rolePromise: 'STARTER' as const,
  appearancePromise: { minutesShareBp: 6000 },
  positionPlan: 'ST' as const,
  shirtNumber: 10,
  tacticalFitEstimate: 60,
  competitorSummary: null,
  validUntilRevision: null,
  negotiable: { wage: false, role: false, length: false },
  negotiationState: 'OPEN' as const,
  negotiatedAsk: null,
  loan: null,
};

const VALID_MARKET_SUMMARY = {
  openedAtRevision: 2,
  seasonIndex: 0,
  reason: 'FIRST_CONTRACT' as const,
  safeOfferId: null,
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
  kind: 'PERMANENT' as const,
  appearancePromise: { minutesShareBp: 6000 },
  positionPlan: 'ST' as const,
  suspended: false,
  loan: null,
  promiseBreaches: 0,
  signedSeasonIndex: 1,
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
    expect(
      PendingSchema.safeParse({ kind: 'OFFERS', offers: [VALID_OFFER], market: VALID_MARKET_SUMMARY }).success,
    ).toBe(true);
  });

  it("kind 'OFFERS'인데 offers가 없으면 거부한다", () => {
    expect(PendingSchema.safeParse({ kind: 'OFFERS', market: VALID_MARKET_SUMMARY }).success).toBe(false);
  });

  it("kind 'OFFERS'인데 market이 없으면 거부한다", () => {
    expect(PendingSchema.safeParse({ kind: 'OFFERS', offers: [] }).success).toBe(false);
  });

  it("kind 'CONTRACT'는 offers·market이 필요하다", () => {
    expect(
      PendingSchema.safeParse({ kind: 'CONTRACT', step: 7, offers: [], market: VALID_MARKET_SUMMARY }).success,
    ).toBe(true);
    expect(PendingSchema.safeParse({ kind: 'CONTRACT', step: 7 }).success).toBe(false);
  });

  it("kind 'LOAN_RETURN'을 받아들인다", () => {
    expect(
      PendingSchema.safeParse({ kind: 'LOAN_RETURN', options: ['RETURN', 'PERMANENT'], buyOptionMinor: null })
        .success,
    ).toBe(true);
  });

  it("kind 'INJURY'·'NATIONAL_TEAM' 예약 형태를 받아들인다", () => {
    expect(
      PendingSchema.safeParse({ kind: 'INJURY', step: 3, episodeId: '', eventId: '', version: 0 }).success,
    ).toBe(true);
    expect(PendingSchema.safeParse({ kind: 'NATIONAL_TEAM', step: 3, eventId: '', version: 0 }).success).toBe(true);
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
    growthCarryCenti: zeroAttributes(),
    state: { form: 50, fitness: 80, morale: 60 },
    context: { tacticalFit: 58, squadStatus: 40, positionProficiency: 100 },
    relationships: { managerTrust: 40, captain: 50, rival: 50, fans: 50, agent: 50 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
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
    parentContract: null,
    clubHistory: [],
    timeline: [{ revision: 2, kind: 'CAREER_CONFIRMED' as const, refId: null, age: 17, step: 12 }],
    season: null,
    seasonHistory: [],
    nextManager: null,
    captaincy: 'NONE' as const,
    captaincySeasons: 0,
    controversyFailures: 0,
    nationalityRuleState: { moduleId: 'DEFAULT', exceptions: [] },
    nationalTeam: { callUps: [], debuted: false, pendingDebut: null },
    health: { episodes: [] },
    relationshipLog: [],
    memoryTags: { managerTrust: [], captain: [], rival: [], fans: [], agent: [] },
    reputation: { popularityCenti: 5000, mediaCenti: 5000 },
  };
}

describe('CareerStateSchema', () => {
  it('확정 직후 상태 리터럴을 받아들인다', () => {
    const state = confirmedStateLiteral();
    expect('clubMeeting' in state).toBe(false);
    const result = CareerStateSchema.safeParse(state);
    expect(result.success).toBe(true);
    const withMeeting = { ...state, clubMeeting: { seasonIndex: 1, request: 'TRANSFER', response: 'ACCEPTED', reason: 'REQUEST_ACCEPTED', teamId: 'team-1', contractId: 'contract-1', immediateEffect: { managerTrustDelta: -2, moraleDelta: 2 }, plannedRole: 'BENCH', preferredOfferKind: 'TRANSFER', preferenceStatus: 'PENDING', goal: { seasonIndex: 1, role: 'BENCH', targetMinutesShareBp: 3000, status: 'PENDING' } } };
    expect(CareerStateSchema.safeParse(withMeeting).success).toBe(true);
    expect(getCareerStateInvariantIssues({ rulesetVersion: '1.7.0', season: { index: 1, teamId: 'team-1' } }))
      .toContainEqual(expect.objectContaining({ path: ['season', 'leagueLedger'] }));
    expect(getCareerStateInvariantIssues({ rulesetVersion: '1.7.1', season: { index: 1, teamId: 'team-1' } }))
      .toContainEqual(expect.objectContaining({ path: ['season', 'leagueLedger'] }));
    expect(getCareerStateInvariantIssues({ rulesetVersion: '1.6.0', season: { index: 1, teamId: 'team-1' } }))
      .toEqual([]);
    const finalTable = {
      policyVersion: '1.0.0',
      leagueId: 'league-1',
      leagueName: '리그 1',
      seasonIndex: 1,
      teamId: 'team-1',
      completedRounds: 2,
      rows: [
        [1, 'team-1', '팀 1', 2, 1, 1, 0, 3, 1, 2, 4],
        [2, 'team-2', '팀 2', 2, 0, 1, 1, 1, 3, -2, 1],
      ],
    };
    expect(FinalLeagueTableSchema.safeParse(finalTable).success).toBe(true);
    expect(FinalLeagueTableSchema.safeParse({
      ...finalTable,
      rows: [{ rank: 1, teamId: 'team-1', teamName: '팀 1', played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 3, goalsAgainst: 1, goalDifference: 2, points: 4 }],
    }).success).toBe(false);
    expect(FinalLeagueTableSchema.safeParse({ ...finalTable, rows: [[1, 'team-1']] }).success).toBe(false);
    for (const rows of [
      [],
      [finalTable.rows[0]],
      [finalTable.rows[0]!, [2, 'team-1', '중복 팀', 2, 0, 1, 1, 1, 3, -2, 1]],
      [[2, ...finalTable.rows[0]!.slice(1)], finalTable.rows[1]],
      [[1, 'team-1', '팀 1', 2, 2, 2, 2, 0, 9, 123, 999], finalTable.rows[1]],
      [[1, 'team-1', '팀 1', 2, 0, 1, 1, 1, 3, -2, 1], [2, 'team-2', '팀 2', 2, 1, 1, 0, 3, 1, 2, 4]],
    ]) {
      expect(FinalLeagueTableSchema.safeParse({ ...finalTable, rows }).success).toBe(false);
    }
    expect(FinalLeagueTableSchema.safeParse({ ...finalTable, completedRounds: 1 }).success).toBe(false);
    expect(FinalLeagueTableSchema.safeParse({ ...finalTable, rows: Array.from({ length: 17 }, () => finalTable.rows[0]) }).success).toBe(false);
    expect(FinalLeagueTableSchema.safeParse({ ...finalTable, teamId: 'missing-team' }).success).toBe(false);
    expect(getCareerStateInvariantIssues({
      rulesetVersion: '1.7.0',
      seasonHistory: [{ result: { index: 2, teamId: 'team-1', finalLeagueTable: finalTable } }],
    })).toContainEqual(expect.objectContaining({ path: ['seasonHistory', 0, 'result', 'finalLeagueTable'] }));
    expect(getCareerStateInvariantIssues({
      rulesetVersion: '1.7.0',
      seasonHistory: [{ result: { index: 1, teamId: 'team-2', finalLeagueTable: finalTable } }],
    })).toContainEqual(expect.objectContaining({ path: ['seasonHistory', 0, 'result', 'finalLeagueTable'] }));
    expect(getCareerStateInvariantIssues({
      rulesetVersion: '1.7.1',
      seasonHistory: [{ result: { index: 1, teamId: 'team-2', finalLeagueTable: finalTable } }],
    })).toContainEqual(expect.objectContaining({ path: ['seasonHistory', 0, 'result', 'finalLeagueTable'] }));
  });

  it('대표팀 기본 상태는 최소 strict shape이고 수락 여부는 callUps에서 파생한다', () => {
    const state = confirmedStateLiteral();
    expect(state.nationalityRuleState).toEqual({ moduleId: 'DEFAULT', exceptions: [] });
    expect(state.nationalTeam).toEqual({ callUps: [], debuted: false, pendingDebut: null });

    const duplicateAccepted = {
      ...state,
      nationalTeam: { ...state.nationalTeam, accepted: true },
    };
    expect(CareerStateSchema.safeParse(duplicateAccepted).success).toBe(false);

    const specialNationalityField = {
      ...state,
      nationalityRuleState: { ...state.nationalityRuleState, naturalization: true },
    };
    expect(CareerStateSchema.safeParse(specialNationalityField).success).toBe(false);
  });

  it('기본 국적 모듈은 DEFAULT와 빈 exceptions만 허용한다', () => {
    expect(NationalityRuleStateSchema.safeParse({ moduleId: 'DEFAULT', exceptions: [] }).success).toBe(true);
    expect(NationalityRuleStateSchema.safeParse({ moduleId: 'OTHER', exceptions: [] }).success).toBe(false);
    expect(NationalityRuleStateSchema.safeParse({ moduleId: 'DEFAULT', exceptions: ['EXCEPTION'] }).success).toBe(false);
    expect(NationalityRuleStateSchema.safeParse({ moduleId: 'DEFAULT', exceptions: [], extra: true }).success).toBe(false);
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

  it('ACTIVE/REHAB episode는 remainingMatches를 요구하지만 RECOVERED/RECURRED는 구형 shape을 허용한다', () => {
    const episode = {
      id: 'INJ-1-3-1',
      severity: 'MAJOR' as const,
      bodyPart: 'KNEE' as const,
      occurredAt: { seasonIndex: 1, step: 3, matchId: 'm1' },
      diagnosisRange: { minMatches: 7, maxMatches: 14 },
      rehab: 'STANDARD' as const,
      recurrenceRiskBp: 3000,
      recurrenceChecksRemaining: 0,
      status: 'ACTIVE' as const,
      permanentDelta: null,
    };
    expect(InjuryEpisodeSchema.safeParse(episode).success).toBe(false);
    expect(InjuryEpisodeSchema.safeParse({ ...episode, remainingMatches: 2 }).success).toBe(true);
    const legacyRecovered = { ...episode, status: 'RECOVERED' as const };
    expect(InjuryEpisodeSchema.safeParse({ ...legacyRecovered, status: 'RECOVERED' }).success).toBe(true);
  });

  it("pending이 { kind: 'OFFERS' }인데 offers가 없으면 거부한다", () => {
    const state = { ...confirmedStateLiteral(), pending: { kind: 'OFFERS' } };
    expect(CareerStateSchema.safeParse(state).success).toBe(false);
  });

  it('열린 club stint가 두 개면 거부한다', () => {
    const openStint = {
      teamId: 'hangang-u18',
      teamName: '한강 U18',
      leagueTier: 'YOUTH' as const,
      kind: 'PERMANENT' as const,
      fromSeasonIndex: 1,
      toSeasonIndex: null,
      endReason: null,
      contractId: 'CTR-1',
    };
    expect(CareerStateSchema.safeParse({ ...confirmedStateLiteral(), clubHistory: [openStint, openStint] }).success).toBe(
      false,
    );
  });

  it('LOAN 계약의 parentContract null·비정지 parentContract를 거부한다', () => {
    const loanContract = {
      ...VALID_CONTRACT,
      id: 'CTR-loan',
      kind: 'LOAN' as const,
      loan: { parentTeamId: 'hangang-u18', seasons: 1 as const, wageShareBp: 5000, buyOptionMinor: null },
    };
    const loanStint = {
      teamId: loanContract.teamId,
      teamName: loanContract.teamName,
      leagueTier: loanContract.leagueTier,
      kind: 'LOAN' as const,
      fromSeasonIndex: 1,
      toSeasonIndex: null,
      endReason: null,
      contractId: loanContract.id,
    };
    const state = { ...confirmedStateLiteral(), contract: loanContract, clubHistory: [loanStint] };

    expect(CareerStateSchema.safeParse({ ...state, parentContract: null }).success).toBe(false);
    expect(
      CareerStateSchema.safeParse({
        ...state,
        parentContract: { ...VALID_CONTRACT, id: 'CTR-parent', suspended: false },
      }).success,
    ).toBe(false);
  });

  it('열린 club stint의 contractId가 현재 contract.id와 다르면 거부한다', () => {
    const contract = { ...VALID_CONTRACT, id: 'CTR-current' };
    const currentStint = {
      teamId: contract.teamId,
      teamName: contract.teamName,
      leagueTier: contract.leagueTier,
      kind: contract.kind,
      fromSeasonIndex: 1,
      toSeasonIndex: null,
      endReason: null,
      contractId: 'CTR-other',
    };

    expect(CareerStateSchema.safeParse({ ...confirmedStateLiteral(), contract, clubHistory: [currentStint] }).success).toBe(
      false,
    );
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
    'career-05-chapter.golden.json',
    'career-06-settled.golden.json',
    'career-07-df.golden.json',
    'career-08-mf.golden.json',
    'career-09-fw.golden.json',
    'career-10-transfer.golden.json',
    'career-11-loan.golden.json',
    'career-12-injury.golden.json',
    'career-13-integration.golden.json',
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

  /** 매 명령 뒤 상태를 strict 스키마로 파싱하고, canonical 재직렬화·재해시를 domain hash와 비교한다. */
  function assertStateRoundTrips(snapshot: DomainSnapshot, label: string): void {
    const parsed = CareerStateSchema.parse(snapshot.state);
    const originalCanonical = canonicalize(snapshot.state as unknown as JsonValue);
    const parsedCanonical = canonicalize(parsed as unknown as JsonValue);
    expect(parsedCanonical, `${label} canonical round-trip`).toBe(originalCanonical);
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

  // T-2-004 D-38: career-01 뒤에 CHAPTER 모드로 START_SEASON → RESOLVE_ROLE → ADVANCE(chapterCandidates
  // 포함) → RESOLVE_CHAPTER×2 → ADVANCE×2 → SETTLE_SEASON까지 이어 재생한다(career-02-season과 같은 방식).
  it('career-05-chapter: career-01 뒤에 이어 재생한 매 명령 뒤 상태가 스키마를 통과하고(CHAPTER pending 포함) 최종 hash가 golden과 같다', () => {
    let counter = 0;
    const newId = () => `golden-c5-${counter++}`;

    let snapshot: DomainSnapshot | null = null;
    for (const command of career01EngineCommands(newId)) {
      snapshot = runOrThrow(snapshot, command, career01);
    }
    if (snapshot === null) throw new Error('career01 선행 재생이 비어 있다.');

    let sawChapterPending = false;
    for (const command of career05ChapterEngineCommands(newId, snapshot.revision)) {
      snapshot = runOrThrow(snapshot, command, career05Chapter);
      assertStateRoundTrips(snapshot, `career05Chapter revision ${snapshot.revision}`);
      if (snapshot.state.pending?.kind === 'CHAPTER') sawChapterPending = true;
    }

    expect(sawChapterPending, 'CHAPTER pending 상태를 거쳐야 한다').toBe(true);
    expect(snapshot.revision).toBe(career05Chapter.golden.revision);
    expect(snapshot.stateHash).toBe(career05Chapter.golden.stateHash);
  });

  // T-2-005 D-39: career-01·03·04와 같은 독립 실행 fixture다(career06SettledEngineCommands가
  // CREATE_CAREER부터 자체적으로 만든다). seasonHistory[0].result가 포함된 결산 골든이다.
  it('career-06-settled: 매 명령 뒤 상태가 스키마를 통과하고 최종 hash가 golden과 같다(SETTLE_SEASON까지)', () => {
    let counter = 0;
    const commands = career06SettledEngineCommands(() => `golden-c6-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career06Settled);
      assertStateRoundTrips(snapshot, `career06Settled revision ${snapshot.revision}`);
    }
    if (snapshot === null) throw new Error('career06Settled 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career06Settled.golden.revision);
    expect(snapshot.stateHash).toBe(career06Settled.golden.stateHash);
    expect(snapshot.state.season).toBeNull();
    expect(snapshot.state.seasonHistory[0]?.result).toBeDefined();
  });

  // T-2-011 1번: DF/MF/FW 포지션군 fixture. career-04-gk와 같은 독립 실행 형태로 FAST 모드
  // CREATE_CAREER부터 SETTLE_SEASON까지 이어 재생한다.
  it('career-07-df: 매 명령 뒤 상태가 스키마를 통과하고 최종 hash가 golden과 같다(SETTLE_SEASON까지)', () => {
    let counter = 0;
    const commands = career07DfEngineCommands(() => `golden-c7-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career07Df);
      assertStateRoundTrips(snapshot, `career07Df revision ${snapshot.revision}`);
    }
    if (snapshot === null) throw new Error('career07Df 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career07Df.golden.revision);
    expect(snapshot.stateHash).toBe(career07Df.golden.stateHash);
    expect(snapshot.state.season).toBeNull();
  });

  it('career-08-mf: 매 명령 뒤 상태가 스키마를 통과하고 최종 hash가 golden과 같다(SETTLE_SEASON까지)', () => {
    let counter = 0;
    const commands = career08MfEngineCommands(() => `golden-c8-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career08Mf);
      assertStateRoundTrips(snapshot, `career08Mf revision ${snapshot.revision}`);
    }
    if (snapshot === null) throw new Error('career08Mf 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career08Mf.golden.revision);
    expect(snapshot.stateHash).toBe(career08Mf.golden.stateHash);
    expect(snapshot.state.season).toBeNull();
  });

  it('career-09-fw: 매 명령 뒤 상태가 스키마를 통과하고 최종 hash가 golden과 같다(SETTLE_SEASON까지)', () => {
    let counter = 0;
    const commands = career09FwEngineCommands(() => `golden-c9-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career09Fw);
      assertStateRoundTrips(snapshot, `career09Fw revision ${snapshot.revision}`);
    }
    if (snapshot === null) throw new Error('career09Fw 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career09Fw.golden.revision);
    expect(snapshot.stateHash).toBe(career09Fw.golden.stateHash);
    expect(snapshot.state.season).toBeNull();
  });

  // T-3-003 §8: EXPIRED 시장 NEGOTIATE·ACCEPT_OFFER(FREE_AGENT) 골든. career-01·03·04와 같은 독립
  // 실행 형태다(career10TransferEngineCommands가 CREATE_CAREER부터 자체적으로 만든다).
  it('career-10-transfer: 매 명령 뒤 상태가 스키마를 통과하고 최종 hash가 golden과 같다', () => {
    let counter = 0;
    const commands = career10TransferEngineCommands(() => `golden-c10-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      const previous = snapshot;
      snapshot = runOrThrow(snapshot, command, career10Transfer);
      assertStateRoundTrips(snapshot, `career10Transfer revision ${snapshot.revision}`);

      if (command.type === 'NEGOTIATE') {
        const pending = snapshot.state.pending;
        expect(pending?.kind).toBe('OFFERS');
        if (pending?.kind === 'OFFERS') {
          const negotiated = pending.offers.find((offer) => offer.id === command.payload.offerId);
          expect(negotiated).toEqual(expect.objectContaining({ negotiationState: 'COUNTERED', negotiatedAsk: 'WAGE' }));
        }
      }
      if (command.type === 'ACCEPT_OFFER' && command.payload.offerId === 'OFR-16-1') {
        expect(previous?.state.pending?.kind).toBe('OFFERS');
        expect(snapshot.checkpoint).toBe('CONTRACT_CONFIRMED');
        expect(snapshot.state.contract?.kind).toBe('PERMANENT');
        expect(snapshot.state.parentContract).toBeNull();
        expect(snapshot.state.clubHistory.filter((stint) => stint.toSeasonIndex === null)).toHaveLength(1);
      }
    }
    if (snapshot === null) throw new Error('career10Transfer 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career10Transfer.golden.revision);
    expect(snapshot.stateHash).toBe(career10Transfer.golden.stateHash);
    expect(snapshot.state.clubHistory).toHaveLength(2);
  });

  // T-3-003 §8: INTEREST 시장 LOAN·LOAN_RETURN(RETURN) 골든. career-01·03·04와 같은 독립 실행
  // 형태다(career11LoanEngineCommands가 CREATE_CAREER부터 자체적으로 만든다).
  it('career-11-loan: 매 명령 뒤 상태가 스키마를 통과하고 최종 hash가 golden과 같다', () => {
    let counter = 0;
    const commands = career11LoanEngineCommands(() => `golden-c11-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career11Loan);
      assertStateRoundTrips(snapshot, `career11Loan revision ${snapshot.revision}`);

      if (command.type === 'ACCEPT_OFFER' && snapshot.state.contract?.kind === 'LOAN') {
        expect(snapshot.checkpoint).toBe('CONTRACT_CONFIRMED');
        expect(snapshot.state.parentContract).toEqual(expect.objectContaining({ suspended: true }));
        expect(snapshot.state.clubHistory.filter((stint) => stint.toSeasonIndex === null)).toEqual([
          expect.objectContaining({ kind: 'LOAN' }),
        ]);
      }
      if (command.type === 'LOAN_RETURN') {
        expect(snapshot.state.parentContract).toBeNull();
        expect(snapshot.state.clubHistory.filter((stint) => stint.toSeasonIndex === null)).toEqual([
          expect.objectContaining({ kind: 'PERMANENT' }),
        ]);
      }
    }
    if (snapshot === null) throw new Error('career11Loan 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career11Loan.golden.revision);
    expect(snapshot.stateHash).toBe(career11Loan.golden.stateHash);
    expect(snapshot.state.parentContract).toBeNull();
    expect(snapshot.state.clubHistory).toHaveLength(3);
  });

  it('career-12-injury: 매 명령 뒤 상태가 스키마를 통과하고 중증 재발 golden과 같다', () => {
    let counter = 0;
    const commands = career12InjuryEngineCommands(() => `golden-c12-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career12Injury);
      assertStateRoundTrips(snapshot, `career12Injury revision ${snapshot.revision}`);
    }
    if (snapshot === null) throw new Error('career12Injury 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career12Injury.golden.revision);
    expect(snapshot.stateHash).toBe(career12Injury.golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(career12Injury.golden.rngStateDraws);
    expect(snapshot.state.health.episodes).toHaveLength(career12Injury.golden.episodes.length);
  });

  // T-4-006 §1/§4: Phase 3·4 통합 검증 3시즌 fixture. career-10/11과 같은 독립 실행 형태다
  // (career13IntegrationEngineCommands가 CREATE_CAREER부터 자체적으로 만든다). 매 명령 뒤
  // strict CareerStateSchema 순회를 통과하고, 최종 hash·시즌별 result.hash가 golden과 같은지 본다.
  it('career-13-integration: 매 명령 뒤 상태가 스키마를 통과하고 3시즌 결산 hash가 golden과 같다', () => {
    let counter = 0;
    const commands = career13IntegrationEngineCommands(() => `golden-c13-${counter++}`);
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career13Integration);
      assertStateRoundTrips(snapshot, `career13Integration revision ${snapshot.revision}`);
    }
    if (snapshot === null) throw new Error('career13Integration 명령 목록이 비어 있다.');
    expect(snapshot.revision).toBe(career13Integration.golden.revision);
    expect(snapshot.stateHash).toBe(career13Integration.golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(career13Integration.golden.rngStateDraws);
    expect(snapshot.state.seasonHistory).toHaveLength(career13Integration.golden.seasonHistoryLength);
    expect(snapshot.state.seasonHistory.map((s) => s.result.hash)).toEqual(career13Integration.golden.seasonResultHashes);
    expect(snapshot.state.clubHistory).toHaveLength(career13Integration.golden.clubHistoryLength);
    expect(snapshot.state.health.episodes).toHaveLength(career13Integration.golden.healthEpisodesCount);
  });
});
