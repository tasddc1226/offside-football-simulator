import { canonicalize, simulate, type DomainSnapshot, type JsonValue } from '@offside/domain';
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
  rulesetProto,
  type EngineCommand,
} from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
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
function putBodyBytes(steps: readonly Step[], from: number): number {
  const commandsPart = steps
    .filter((step) => step.snapshot.revision > from)
    .map(
      (step): Pick<CommandLogEntry, 'revision' | 'commandId' | 'commandType' | 'payload' | 'resultHash'> => ({
        revision: step.snapshot.revision,
        commandId: step.command.commandId,
        commandType: step.command.type,
        payload: step.command.payload as CommandLogEntry['payload'],
        resultHash: step.snapshot.stateHash,
      }),
    );
  const last = steps[steps.length - 1]!.snapshot;
  const body = {
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
  return byteLength(JSON.stringify(body));
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
    const market = offersSteps.reduce<Step | undefined>(
      (largest, step) =>
        largest === undefined ||
        (step.snapshot.state.pending?.kind === 'OFFERS' &&
          largest.snapshot.state.pending?.kind === 'OFFERS' &&
          step.snapshot.state.pending.offers.length > largest.snapshot.state.pending.offers.length)
          ? step
          : largest,
      undefined,
    );
    if (market === undefined) throw new Error(`${label} 제안 시장 지점을 찾지 못했다.`);
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
    const measured = [
      {
        checkpoint: 'market-largest-offers',
        snapshot: market.snapshot,
        offerCount: market.snapshot.state.pending?.kind === 'OFFERS' ? market.snapshot.state.pending.offers.length : 0,
      },
      ...(negotiated === undefined ? [] : [{ checkpoint: 'after-negotiate', snapshot: negotiated.snapshot }]),
      ...(transfer === undefined ? [] : [{ checkpoint: 'after-transfer', snapshot: transfer.snapshot }]),
      ...(loan === undefined ? [] : [{ checkpoint: 'during-loan', snapshot: loan.snapshot }]),
      { checkpoint: 'final-3-season', snapshot: final.snapshot },
    ].map(({ checkpoint, snapshot }) => ({ checkpoint, revision: snapshot.revision, stateBytes: stateBytes(snapshot) }));
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
    }
    expect(bodyBytes, `${label} full PUT`).toBeLessThan(REQUEST_BODY_MAX_BYTES);
  });
});
