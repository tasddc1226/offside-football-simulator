import {
  assertSeasonLeagueLedgerInvariant,
  buildLeagueFixtures,
  buildLeagueRoster,
  canonicalize,
  hashSeasonResult,
  hashState,
  simulate,
  type DomainSnapshot,
  type JsonValue,
  type LeagueSeasonLedger,
  type Ruleset,
  type StandingRow,
} from '@offside/domain';
import {
  career01,
  career02Season,
  career01EngineCommands,
  career02SeasonEngineCommands,
  career03Underdog,
  career03UnderdogEngineCommands,
  career04Gk,
  career04GkEngineCommands,
  career05Chapter,
  career05ChapterEngineCommands,
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
  career13Integration,
  career13IntegrationEngineCommands,
  rulesetProto,
  type EngineCommand,
} from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { PutCareerBodySchema } from './careers.js';
import { REQUEST_BODY_MAX_BYTES, SNAPSHOT_STATE_RECOMMENDED_BYTES } from './headers.js';
import type { CommandLogEntry } from './commands.js';

/**
 * T-2-006 D-33: golden fixture를 domain `simulate`로 재생하며 시즌 상태 크기(canonical JSON
 * 바이트)와 `PUT /careers/{id}` 본문 크기(Snapshot + 명령 로그)를 잰다. 수치는 PR 본문 표로 옮긴다.
 * 상한 테스트만 여기 남긴다: `SNAPSHOT_STATE_RECOMMENDED_BYTES`(256 KB)를 넘으면 실패, 절반(128 KB)
 * 초과 여부는 PR 본문에서 사람이 판단한다(브리프: 넘으면 압축 설계를 적고 구현하지 않는다).
 */

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

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

function stateBytes(snapshot: DomainSnapshot): number {
  return byteLength(canonicalize(snapshot.state as unknown as JsonValue));
}

type Step = { snapshot: DomainSnapshot; command: EngineCommand };

/** 스냅샷 하나 + 실제 명령 로그(revision `from+1`..`to`, 실제 commandType·payload)로 이뤄진 PUT 본문의 바이트 수. */
function buildPutBody(steps: readonly Step[], from: number, target?: Step) {
  const last = (target ?? steps[steps.length - 1]!).snapshot;
  const lastRevision = last.revision;
  const commandsPart = steps
    .filter((step) => step.snapshot.revision > from && step.snapshot.revision <= lastRevision)
    .map(
      (step): Pick<CommandLogEntry, 'revision' | 'commandId' | 'commandType' | 'payload' | 'resultHash'> => ({
        revision: step.snapshot.revision,
        commandId: step.command.commandId,
        commandType: step.command.type,
        payload: step.command.payload as CommandLogEntry['payload'],
        resultHash: step.snapshot.revision === lastRevision ? last.stateHash : step.snapshot.stateHash,
      }),
    );
  return {
    baseRevision: from,
    snapshot: {
      revision: last.revision,
      checkpoint: last.checkpoint,
      state: canonicalize(last.state as unknown as JsonValue),
      stateHash: last.stateHash,
      rulesetVersion: last.rulesetVersion,
      contentPackVersion: last.contentPackVersion,
      rngState: { s: [...last.state.rngState.s], draws: last.state.rngState.draws },
    },
    commands: commandsPart,
    createdServiceSeasonId: 'svc_size_probe',
    rulesetVersion: last.rulesetVersion,
    contentPackVersion: last.contentPackVersion,
  };
}

function putBodyBytes(steps: readonly Step[], from: number, target?: Step): number {
  return byteLength(JSON.stringify(buildPutBody(steps, from, target)));
}

function replayIndependentFixture(
  engineCommands: (newId: () => string) => EngineCommand[],
  versions: { rulesetVersion: string; contentPackVersion: string },
  prefix: string,
): Step[] {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  const steps: Step[] = [];
  for (const command of engineCommands(() => `${prefix}-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, versions);
    steps.push({ snapshot, command });
  }
  if (snapshot === null) throw new Error(`${prefix} 명령 목록이 비어 있다.`);
  return steps;
}

/**
 * T-3-004의 "제안 3개 이상" 크기 지점은 정본 fixture에 현재 최대 2개 제안만 있어 합성한다.
 * fixture/golden 본문은 읽기 전용으로 유지하고, 실제 replay 결과의 첫 offer를 복제한 불투명 payload를
 * 하나 추가해 Snapshot 직렬화 예산만 계측한다. 이 합성 Snapshot을 replay·hash golden 검증에 사용하지 않는다.
 */
function withAtLeastThreeOffersForSize(step: Step): Step {
  const pending = step.snapshot.state.pending;
  if (pending?.kind !== 'OFFERS' || pending.offers.length >= 3) return step;
  const template = pending.offers[0];
  if (template === undefined) throw new Error('제안 시장이 비어 있어 3개 제안 크기를 합성할 수 없다.');
  const syntheticState = {
    ...step.snapshot.state,
    pending: {
      ...pending,
      offers: [...pending.offers, { ...template, id: `${template.id}-size-probe-3` }],
    },
  };
  return {
    ...step,
    snapshot: { ...step.snapshot, state: syntheticState, stateHash: hashState(syntheticState) },
  };
}

describe('Snapshot·PUT 본문 크기(D-33)', () => {
  it('career-01: 최종 상태·PUT 본문 크기가 상한 안에 든다', () => {
    let counter = 0;
    const commands = career01EngineCommands(() => `size-c1-${counter++}`);
    const steps: Step[] = [];
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career01);
      steps.push({ snapshot, command });
    }
    if (snapshot === null) throw new Error('career01 명령 목록이 비어 있다.');

    const finalStateBytes = stateBytes(snapshot);
    const bodyBytes = putBodyBytes(steps, 0);

    console.log(
      JSON.stringify({ fixture: 'career-01', checkpoint: 'final', revision: snapshot.revision, finalStateBytes, bodyBytes }),
    );

    expect(finalStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(bodyBytes).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);
  });

  it.each(['FAST', 'CHAPTER'] as const)(
    'career-02-season(%s): 시즌 중 최대 상태 크기·시즌 종료 상태 크기·시즌 한 개 분량 PUT 본문 크기가 상한 안에 든다',
    (mode) => {
      let counter = 0;
      const newId = () => `size-c2-${mode}-${counter++}`;

      let snapshot: DomainSnapshot | null = null;
      for (const command of career01EngineCommands(newId)) {
        snapshot = runOrThrow(snapshot, command, career01);
      }
      if (snapshot === null) throw new Error('career01 선행 재생이 비어 있다.');
      const seasonStart = snapshot.revision;

      const seasonSteps: Step[] = [];
      for (const command of career02SeasonEngineCommands(mode, newId, seasonStart)) {
        snapshot = runOrThrow(snapshot, command, career02Season);
        seasonSteps.push({ snapshot, command });
      }

      const finalSnapshot = seasonSteps[seasonSteps.length - 1]!.snapshot;
      const peak = seasonSteps.reduce((max, step) => (stateBytes(step.snapshot) > stateBytes(max) ? step.snapshot : max), seasonSteps[0]!.snapshot);

      const peakStateBytes = stateBytes(peak);
      const finalStateBytes = stateBytes(finalSnapshot);
      const bodyBytes = putBodyBytes(seasonSteps, seasonStart);

      console.log(
        JSON.stringify({
          fixture: `career-02-season(${mode})`,
          peakCheckpoint: peak.checkpoint,
          peakRevision: peak.revision,
          peakStateBytes,
          finalCheckpoint: finalSnapshot.checkpoint,
          finalRevision: finalSnapshot.revision,
          finalStateBytes,
          bodyBytes,
          halfBudget: SNAPSHOT_STATE_RECOMMENDED_BYTES / 2,
        }),
      );

      // D-33 상한: 권장치(256KB)를 넘으면 실패. 절반(128KB) 초과 여부는 PR 본문에서 사람이 판단한다.
      expect(peakStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
      expect(finalStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
      expect(bodyBytes).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);
    },
  );

  it('career-03-underdog(시즌 중, ROLE_PROPOSAL pending): 상태·PUT 본문 크기가 상한 안에 든다', () => {
    let counter = 0;
    const commands = career03UnderdogEngineCommands(() => `size-c3-${counter++}`);
    const steps: Step[] = [];
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career03Underdog);
      steps.push({ snapshot, command });
    }
    if (snapshot === null) throw new Error('career03Underdog 명령 목록이 비어 있다.');

    const finalStateBytes = stateBytes(snapshot);
    const bodyBytes = putBodyBytes(steps, 0);

    console.log(
      JSON.stringify({
        fixture: 'career-03-underdog',
        checkpoint: snapshot.checkpoint,
        revision: snapshot.revision,
        finalStateBytes,
        bodyBytes,
      }),
    );

    expect(finalStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(bodyBytes).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);
  });

  // T-2-003: GK 아키타입으로 SETTLE_SEASON까지(FAST, 경기 25개 누적) 다 돈 뒤(season이 null이 되는
  // 시점) 상태 크기 — season.matches가 가장 많이 쌓인 시점을 대표한다.
  it('career-04-gk(SETTLE_SEASON 직후, season null): 상태·PUT 본문 크기가 상한 안에 든다', () => {
    let counter = 0;
    const commands = career04GkEngineCommands(() => `size-c4-${counter++}`);
    const steps: Step[] = [];
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, career04Gk);
      steps.push({ snapshot, command });
    }
    if (snapshot === null) throw new Error('career04Gk 명령 목록이 비어 있다.');

    const peak = steps.reduce((max, step) => (stateBytes(step.snapshot) > stateBytes(max) ? step.snapshot : max), steps[0]!.snapshot);
    const peakStateBytes = stateBytes(peak);
    const finalStateBytes = stateBytes(snapshot);
    const bodyBytes = putBodyBytes(steps, 0);

    console.log(
      JSON.stringify({
        fixture: 'career-04-gk',
        peakCheckpoint: peak.checkpoint,
        peakRevision: peak.revision,
        peakStateBytes,
        checkpoint: snapshot.checkpoint,
        revision: snapshot.revision,
        finalStateBytes,
        bodyBytes,
      }),
    );

    expect(peakStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(finalStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(bodyBytes).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);
  });

  // T-2-004 D-38: 데뷔전 챕터(판단 2개 확정)를 포함한 시즌 결산까지 — season.chapters·CHAPTER pending
  // 필드가 더해진 상태의 대표 크기.
  it('career-05-chapter(시즌 결산까지, CHAPTER 판단 포함): 최대 상태·PUT 본문 크기가 상한 안에 든다', () => {
    let counter = 0;
    const newId = () => `size-c5-${counter++}`;

    let snapshot: DomainSnapshot | null = null;
    for (const command of career01EngineCommands(newId)) {
      snapshot = runOrThrow(snapshot, command, career01);
    }
    if (snapshot === null) throw new Error('career01 선행 재생이 비어 있다.');
    const seasonStart = snapshot.revision;

    const seasonSteps: Step[] = [];
    for (const command of career05ChapterEngineCommands(newId, seasonStart)) {
      snapshot = runOrThrow(snapshot, command, career05Chapter);
      seasonSteps.push({ snapshot, command });
    }

    const peak = seasonSteps.reduce((max, step) => (stateBytes(step.snapshot) > stateBytes(max) ? step.snapshot : max), seasonSteps[0]!.snapshot);
    const peakStateBytes = stateBytes(peak);
    const finalStateBytes = stateBytes(snapshot);
    const bodyBytes = putBodyBytes(seasonSteps, seasonStart);

    console.log(
      JSON.stringify({
        fixture: 'career-05-chapter',
        peakCheckpoint: peak.checkpoint,
        peakRevision: peak.revision,
        peakStateBytes,
        checkpoint: snapshot.checkpoint,
        revision: snapshot.revision,
        finalStateBytes,
        bodyBytes,
      }),
    );

    expect(peakStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(finalStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(bodyBytes).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);
  });

  // T-2-011 1번: DF/MF/FW 포지션군 fixture. career-04-gk와 같은 대표 지점(SETTLE_SEASON 직후, season
  // null — season.matches가 가장 많이 쌓인 시점)에서 크기를 잰다.
  it.each([
    { label: 'career-07-df', engineCommands: career07DfEngineCommands, versions: career07Df, prefix: 'size-c7' },
    { label: 'career-08-mf', engineCommands: career08MfEngineCommands, versions: career08Mf, prefix: 'size-c8' },
    { label: 'career-09-fw', engineCommands: career09FwEngineCommands, versions: career09Fw, prefix: 'size-c9' },
  ])('$label(SETTLE_SEASON 직후, season null): 상태·PUT 본문 크기가 상한 안에 든다', ({ label, engineCommands, versions, prefix }) => {
    let counter = 0;
    const commands = engineCommands(() => `${prefix}-${counter++}`);
    const steps: Step[] = [];
    let snapshot: DomainSnapshot | null = null;
    for (const command of commands) {
      snapshot = runOrThrow(snapshot, command, versions);
      steps.push({ snapshot, command });
    }
    if (snapshot === null) throw new Error(`${label} 명령 목록이 비어 있다.`);

    const peak = steps.reduce((max, step) => (stateBytes(step.snapshot) > stateBytes(max) ? step.snapshot : max), steps[0]!.snapshot);
    const peakStateBytes = stateBytes(peak);
    const finalStateBytes = stateBytes(snapshot);
    const bodyBytes = putBodyBytes(steps, 0);

    console.log(
      JSON.stringify({
        fixture: label,
        peakCheckpoint: peak.checkpoint,
        peakRevision: peak.revision,
        peakStateBytes,
        checkpoint: snapshot.checkpoint,
        revision: snapshot.revision,
        finalStateBytes,
        bodyBytes,
      }),
    );

    expect(peakStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(finalStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(bodyBytes).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);
  });

  it.each([
    { label: 'career-10-transfer', engineCommands: career10TransferEngineCommands, versions: career10Transfer, prefix: 'size-c10' },
    { label: 'career-11-loan', engineCommands: career11LoanEngineCommands, versions: career11Loan, prefix: 'size-c11' },
  ])('$label: 시장·협상·계약 전환·최종 Snapshot과 전체 PUT 본문이 예산 안에 든다', ({ label, engineCommands, versions, prefix }) => {
    const steps = replayIndependentFixture(engineCommands, versions, prefix);
    const findStep = (predicate: (step: Step) => boolean, name: string): Step => {
      const step = steps.find(predicate);
      if (step === undefined) throw new Error(`${label} ${name} 지점을 찾지 못했다.`);
      return step;
    };
    const offersSteps = steps.filter((step) => step.snapshot.state.pending?.kind === 'OFFERS');
    const fixtureMarket = offersSteps.reduce<Step | undefined>(
      (largest, step) =>
        largest === undefined ||
        (step.snapshot.state.pending?.kind === 'OFFERS' &&
          largest.snapshot.state.pending?.kind === 'OFFERS' &&
          step.snapshot.state.pending.offers.length > largest.snapshot.state.pending.offers.length)
          ? step
          : largest,
      undefined,
    );
    if (fixtureMarket === undefined) throw new Error(`${label} 제안 시장 지점을 찾지 못했다.`);
    const market = withAtLeastThreeOffersForSize(fixtureMarket);
    const negotiated = label === 'career-10-transfer' ? findStep((step) => step.command.type === 'NEGOTIATE', '협상 직후') : undefined;
    const transfer =
      label === 'career-10-transfer'
        ? findStep(
            (step) => step.command.type === 'ACCEPT_OFFER' && step.command.payload.offerId === 'OFR-16-1',
            '이적 직후',
          )
        : undefined;
    const loan =
      label === 'career-11-loan'
        ? findStep((step) => step.snapshot.state.contract?.kind === 'LOAN', '임대 중(parentContract 포함)')
        : undefined;
    const final = steps[steps.length - 1]!;
    const offerCount = market.snapshot.state.pending?.kind === 'OFFERS' ? market.snapshot.state.pending.offers.length : 0;
    expect(offerCount, `${label} 3-offer size probe`).toBeGreaterThanOrEqual(3);
    const marketBody = buildPutBody(steps, 0, market);
    const parsedMarketBody = PutCareerBodySchema.parse(marketBody);
    expect(parsedMarketBody.commands.at(-1)?.resultHash, `${label} 3-offer PUT resultHash`).toBe(
      parsedMarketBody.snapshot.stateHash,
    );
    const marketBodyState = JSON.parse(marketBody.snapshot.state) as {
      pending?: { kind?: string; offers?: unknown[] };
    };
    const marketBodyOfferCount =
      marketBodyState.pending?.kind === 'OFFERS' && Array.isArray(marketBodyState.pending.offers)
        ? marketBodyState.pending.offers.length
        : 0;
    expect(marketBodyOfferCount, `${label} 3-offer PUT body`).toBe(offerCount);
    expect(putBodyBytes(steps, 0, market), `${label} 3-offer PUT body`).toBeGreaterThan(
      putBodyBytes(steps, 0, fixtureMarket),
    );
    const measured = [
      {
        checkpoint: 'market-3-offers-size-probe',
        step: market,
        offerCount,
      },
      ...(negotiated === undefined ? [] : [{ checkpoint: 'after-negotiate', step: negotiated }]),
      ...(transfer === undefined ? [] : [{ checkpoint: 'after-transfer', step: transfer }]),
      ...(loan === undefined ? [] : [{ checkpoint: 'during-loan', step: loan }]),
      { checkpoint: 'final-3-season', step: final },
    ].map(({ checkpoint, step, offerCount }) => ({
      checkpoint,
      revision: step.snapshot.revision,
      stateBytes: stateBytes(step.snapshot),
      bodyBytes: putBodyBytes(steps, 0, step),
      ...(offerCount === undefined ? {} : { offerCount }),
    }));
    const bodyBytes = putBodyBytes(steps, 0);

    console.log(
      JSON.stringify({
        fixture: label,
        checkpoints: measured,
        bodyBytes,
        stateBudgetBytes: SNAPSHOT_STATE_RECOMMENDED_BYTES,
        requestBudgetBytes: REQUEST_BODY_MAX_BYTES,
      }),
    );

    for (const point of measured) {
      expect(point.stateBytes, `${label} ${point.checkpoint}`).toBeLessThan(SNAPSHOT_STATE_RECOMMENDED_BYTES);
      expect(point.bodyBytes, `${label} ${point.checkpoint} PUT`).toBeLessThan(REQUEST_BODY_MAX_BYTES);
    }
    expect(bodyBytes, `${label} full PUT`).toBeLessThan(REQUEST_BODY_MAX_BYTES);
  });

  // T-4-006 §4: Phase 3·4 통합 3시즌 fixture. 시즌별 결산 직후(SETTLE_SEASON) 상태 크기·PUT 본문
  // 크기와, timeline·relationshipLog·health.episodes가 시즌마다 얼마나 느는지(바이트/시즌)를 잰다.
  it('career-13-integration: 시즌별 결산 상태·PUT 본문 크기와 timeline/relationshipLog/health.episodes 시즌당 증가량', () => {
    const steps = replayIndependentFixture(career13IntegrationEngineCommands, career13Integration, 'size-c13');
    const settleSteps = steps.filter((step) => step.command.type === 'SETTLE_SEASON');
    expect(settleSteps, 'career-13-integration SETTLE_SEASON 3회').toHaveLength(3);

    function fieldBytes(state: DomainSnapshot['state'], field: 'timeline' | 'relationshipLog' | 'health'): number {
      const value = field === 'health' ? state.health.episodes : state[field];
      return byteLength(canonicalize(value as unknown as JsonValue));
    }

    const perSeason = settleSteps.map((step, index) => {
      const state = step.snapshot.state;
      return {
        seasonIndex: index + 1,
        revision: step.snapshot.revision,
        stateBytes: stateBytes(step.snapshot),
        bodyBytes: putBodyBytes(steps, 0, step),
        timelineBytes: fieldBytes(state, 'timeline'),
        relationshipLogBytes: fieldBytes(state, 'relationshipLog'),
        healthEpisodesBytes: fieldBytes(state, 'health'),
      };
    });

    const growth = perSeason.slice(1).map((current, index) => {
      const previous = perSeason[index]!;
      return {
        fromSeason: previous.seasonIndex,
        toSeason: current.seasonIndex,
        timelineBytesPerSeason: current.timelineBytes - previous.timelineBytes,
        relationshipLogBytesPerSeason: current.relationshipLogBytes - previous.relationshipLogBytes,
        healthEpisodesBytesPerSeason: current.healthEpisodesBytes - previous.healthEpisodesBytes,
        stateBytesPerSeason: current.stateBytes - previous.stateBytes,
      };
    });

    const final = steps[steps.length - 1]!;
    const bodyBytesFull = putBodyBytes(steps, 0);

    console.log(
      JSON.stringify(
        {
          fixture: 'career-13-integration',
          perSeason,
          growthPerSeason: growth,
          finalRevision: final.snapshot.revision,
          finalStateBytes: stateBytes(final.snapshot),
          bodyBytesFull,
          stateBudgetBytes: SNAPSHOT_STATE_RECOMMENDED_BYTES,
          requestBudgetBytes: REQUEST_BODY_MAX_BYTES,
        },
        null,
        2,
      ),
    );

    for (const season of perSeason) {
      // 256KB 상한: 넘으면 실패. 128KB 초과는 경고 로그 + PR 본문 기록(브리프 §4).
      expect(season.stateBytes, `career-13-integration season${season.seasonIndex} state`).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
      if (season.stateBytes > SNAPSHOT_STATE_RECOMMENDED_BYTES / 2) {
        console.warn(`career-13-integration season${season.seasonIndex} state가 128KB(경고 기준)를 넘었다: ${season.stateBytes} bytes`);
      }
      expect(season.bodyBytes, `career-13-integration season${season.seasonIndex} PUT`).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);
    }
    expect(bodyBytesFull, 'career-13-integration full PUT').toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);

    // T-7-022 WP-03: 실제 직렬화 경로로 최대 16팀 active ledger와 20시즌 final table 보존 예산을 잰다.
    // 자연 완주 성능은 career-sim으로 별도 검증하고, 이 테스트는 최악 크기 shape를 보수적으로 채운다.
    const activeTemplate = [...steps].reverse().find((step) => step.snapshot.state.season !== null)!;
    const activeTemplateSeason = activeTemplate.snapshot.state.season!;
    const activeTeam = rulesetProto.teams.find((team) => team.id === activeTemplateSeason.teamId)!;
    const templateLeague = rulesetProto.leagues.find((league) => league.id === activeTeam.leagueId)!;
    const maxLeague = { ...templateLeague, teamCount: 16 };
    const maxRuleset: Ruleset = {
      ...rulesetProto,
      version: '1.7.0',
      leagues: rulesetProto.leagues.map((league) => league.id === maxLeague.id ? maxLeague : league),
      leagueLedgerRules: {
        policyVersion: '1.0.0',
        maxTeamCount: 16,
        scoreKernel: 'MATCH_RULES_V1',
        points: { win: 3, draw: 1, loss: 0 },
        tieBreakers: ['POINTS', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'TEAM_ID'],
      },
    };
    const teams = buildLeagueRoster(maxRuleset, activeTeam, maxLeague);
    const fixtures = buildLeagueFixtures(20, maxLeague.id, teams);
    const ledger: LeagueSeasonLedger = {
      policyVersion: '1.0.0',
      leagueId: maxLeague.id,
      leagueName: maxLeague.name,
      seasonIndex: 20,
      teamId: activeTeam.id,
      seed: [1, 2, 3, 4],
      teams,
      results: fixtures.map((_, index) => [index, index % 4, (index + 1) % 3]),
      completedRounds: Array.from({ length: 30 }, (_, index) => index + 1),
    };
    const leagueSchedule = fixtures
      .filter((fixture) => fixture.homeTeamId === activeTeam.id || fixture.awayTeamId === activeTeam.id)
      .map((fixture) => ({
        step: fixture.step,
        order: 0,
        competitionId: 'LEAGUE',
        kind: 'LEAGUE' as const,
        round: String(fixture.round),
        opponentId: fixture.homeTeamId === activeTeam.id ? fixture.awayTeamId : fixture.homeTeamId,
        home: fixture.homeTeamId === activeTeam.id,
        fixtureId: fixture.fixtureId,
        leagueRound: fixture.round,
      }));
    const activeSchedule = [...leagueSchedule, ...activeTemplateSeason.schedule.filter((entry) => entry.kind === 'CUP')]
      .sort((a, b) => a.step - b.step || (a.kind === b.kind ? 0 : a.kind === 'LEAGUE' ? -1 : 1))
      .map((entry, index, all) => ({
        ...entry,
        order: all.slice(0, index).filter((candidate) => candidate.step === entry.step).length,
      }));
    const activeState = {
      ...activeTemplate.snapshot.state,
      rulesetVersion: '1.7.0',
      contentPackVersion: '0.6.2',
      season: { ...activeTemplateSeason, index: 20, leagueLedger: ledger, schedule: activeSchedule },
    };
    assertSeasonLeagueLedgerInvariant(maxRuleset, activeState.season);
    const activeTarget: Step = {
      ...activeTemplate,
      snapshot: {
        ...activeTemplate.snapshot,
        state: activeState,
        stateHash: hashState(activeState),
        rulesetVersion: '1.7.0',
        contentPackVersion: '0.6.2',
      },
    };
    const activeStateBytes = stateBytes(activeTarget.snapshot);
    const activePutBody = buildPutBody(steps, 0, activeTarget);
    const activePutBytes = byteLength(JSON.stringify(activePutBody));
    expect(PutCareerBodySchema.safeParse(activePutBody).success).toBe(true);
    expect(activeStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(activePutBytes).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);

    const rows: StandingRow[] = teams.map((team, index) => ({
      rank: index + 1,
      teamId: team.teamId,
      teamName: team.name,
      played: 30,
      won: 15,
      drawn: 0,
      lost: 15,
      goalsFor: 45 - index,
      goalsAgainst: 30 + index,
      goalDifference: 15 - index * 2,
      points: 45,
    }));
    const resultTemplate = final.snapshot.state.seasonHistory.at(-1)!.result;
    const seasonHistory = Array.from({ length: 20 }, (_, index) => {
      const seasonIndex = index + 1;
      const resultWithoutHash = {
        ...resultTemplate,
        index: seasonIndex,
        finalLeagueTable: {
          policyVersion: '1.0.0' as const,
          leagueId: maxLeague.id,
          leagueName: maxLeague.name,
          seasonIndex,
          teamId: activeTeam.id,
          completedRounds: 30,
          rows,
        },
      };
      const result = { ...resultWithoutHash, hash: hashSeasonResult(resultWithoutHash) };
      return {
        ...final.snapshot.state.seasonHistory.at(-1)!,
        index: seasonIndex,
        settledAtRevision: final.snapshot.revision + seasonIndex,
        result,
      };
    });
    const historyState = { ...final.snapshot.state, seasonHistory };
    const historyTarget: Step = {
      ...final,
      snapshot: { ...final.snapshot, state: historyState, stateHash: hashState(historyState) },
    };
    const historyStateBytes = stateBytes(historyTarget.snapshot);
    const historyPutBody = buildPutBody(steps, 0, historyTarget);
    const historyPutBytes = byteLength(JSON.stringify(historyPutBody));
    expect(PutCareerBodySchema.safeParse(historyPutBody).success).toBe(true);
    expect(historyStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(historyPutBytes).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);

    const combinedState = {
      ...activeState,
      seasonHistory: seasonHistory.slice(0, 19),
    };
    const combinedTarget: Step = {
      ...activeTarget,
      snapshot: { ...activeTarget.snapshot, state: combinedState, stateHash: hashState(combinedState) },
    };
    const combinedStateBytes = stateBytes(combinedTarget.snapshot);
    const combinedPutBody = buildPutBody(steps, 0, combinedTarget);
    const combinedPutBytes = byteLength(JSON.stringify(combinedPutBody));
    expect(PutCareerBodySchema.safeParse(combinedPutBody).success).toBe(true);
    expect(combinedStateBytes).toBeLessThanOrEqual(SNAPSHOT_STATE_RECOMMENDED_BYTES);
    expect(combinedPutBytes).toBeLessThanOrEqual(REQUEST_BODY_MAX_BYTES);
    console.log(JSON.stringify({
      fixture: 'T-7-022-max-budget',
      maxTeams: teams.length,
      fixtures: fixtures.length,
      activeStateBytes,
      activePutBytes,
      historySeasons: seasonHistory.length,
      historyStateBytes,
      historyPutBytes,
      combinedPreviousSeasons: combinedState.seasonHistory.length,
      combinedStateBytes,
      combinedPutBytes,
    }));
  });
});
