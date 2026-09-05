import {
  canonicalize,
  sha256Hex,
  simulate,
  verifySnapshot,
  type DomainSnapshot,
  type JsonValue,
  type SimulationMode,
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

/**
 * career01 fixture(CREATE_CAREER + 나머지 명령)을 순서대로 재생해 최종 DomainSnapshot을 돌려준다.
 * `packages/domain/src/__fixtures__/career-01.ts`의 재생 로직과 같은 순서다.
 */
function runCareer01(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career01EngineCommands(() => `probe-c1-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career01);
  }
  if (snapshot === null) throw new Error('career01 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-2-006: career01 뒤에 이어 career02Season(mode)을 재생한다(START_SEASON…RESOLVE_ROLE…SETTLE_SEASON). */
function runCareer02Season(mode: SimulationMode): DomainSnapshot {
  let counter = 0;
  const newId = () => `probe-c2-${mode}-${counter++}`;

  let snapshot: DomainSnapshot | null = null;
  for (const command of career01EngineCommands(newId)) {
    snapshot = runOrThrow(snapshot, command, career01);
  }
  if (snapshot === null) throw new Error('career01 선행 재생이 비어 있다.');

  for (const command of career02SeasonEngineCommands(mode, newId, snapshot.revision)) {
    snapshot = runOrThrow(snapshot, command, career02Season);
  }
  return snapshot;
}

/** T-2-006: career03Underdog(독립 시나리오, ROLE_PROPOSAL pending에서 멈춘다)을 재생한다. */
function runCareer03Underdog(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career03UnderdogEngineCommands(() => `probe-c3-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career03Underdog);
  }
  if (snapshot === null) throw new Error('career03Underdog 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-2-003: career04Gk(GK 아키타입, 독립 시나리오, START_SEASON부터 SETTLE_SEASON까지)를 재생한다. */
function runCareer04Gk(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career04GkEngineCommands(() => `probe-c4-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career04Gk);
  }
  if (snapshot === null) throw new Error('career04Gk 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-2-005 D-39: career-06-settled(독립 시나리오, 유스 첫 시즌을 FAST로 결산까지)를 재생한다. */
function runCareer06Settled(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career06SettledEngineCommands(() => `probe-c6-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career06Settled);
  }
  if (snapshot === null) throw new Error('career06Settled 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-2-011: career07Df/career08Mf/career09Fw(독립 실행, career04Gk와 같은 형태)를 재생한다. */
function runCareer07Df(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career07DfEngineCommands(() => `probe-c7-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career07Df);
  }
  if (snapshot === null) throw new Error('career07Df 명령 목록이 비어 있다.');
  return snapshot;
}

function runCareer08Mf(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career08MfEngineCommands(() => `probe-c8-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career08Mf);
  }
  if (snapshot === null) throw new Error('career08Mf 명령 목록이 비어 있다.');
  return snapshot;
}

function runCareer09Fw(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career09FwEngineCommands(() => `probe-c9-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career09Fw);
  }
  if (snapshot === null) throw new Error('career09Fw 명령 목록이 비어 있다.');
  return snapshot;
}

function runCareer10Transfer(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career10TransferEngineCommands(() => `probe-c10-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career10Transfer);
  }
  if (snapshot === null) throw new Error('career10Transfer 명령 목록이 비어 있다.');
  return snapshot;
}

function runCareer11Loan(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career11LoanEngineCommands(() => `probe-c11-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career11Loan);
  }
  if (snapshot === null) throw new Error('career11Loan 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-4-002: career12Injury(자체 CREATE_CAREER·START_SEASON·부상 이벤트 포함)를 재생한다. */
function runCareer12Injury(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career12InjuryEngineCommands(() => `probe-c12-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career12Injury);
  }
  if (snapshot === null) throw new Error('career12Injury 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-4-006: career13Integration(3시즌 통합 시나리오)을 재생한다. */
function runCareer13Integration(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career13IntegrationEngineCommands(() => `probe-c13-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career13Integration);
  }
  if (snapshot === null) throw new Error('career13Integration 명령 목록이 비어 있다.');
  return snapshot;
}

type ProbeRequest =
  | { kind: 'replay' }
  | { kind: 'replaySeason'; mode: SimulationMode }
  | { kind: 'replayUnderdog' }
  | { kind: 'replayGk' }
  | { kind: 'replaySettled' }
  | { kind: 'replayDf' }
  | { kind: 'replayMf' }
  | { kind: 'replayFw' }
  | { kind: 'replayTransfer' }
  | { kind: 'replayLoan' }
  | { kind: 'replayInjury' }
  | { kind: 'replayIntegration' }
  | { kind: 'sha256'; inputs: string[] }
  | { kind: 'canonical'; value: JsonValue };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

function snapshotResponse(snapshot: DomainSnapshot): Response {
  return jsonResponse({
    revision: snapshot.revision,
    stateHash: snapshot.stateHash,
    rngStateDraws: snapshot.state.rngState.draws,
    verifySnapshotOk: verifySnapshot(snapshot).ok,
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const body = (await request.json()) as ProbeRequest;

    if (body.kind === 'replay') {
      return snapshotResponse(runCareer01());
    }

    if (body.kind === 'replaySeason') {
      return snapshotResponse(runCareer02Season(body.mode));
    }

    if (body.kind === 'replayUnderdog') {
      return snapshotResponse(runCareer03Underdog());
    }

    if (body.kind === 'replayGk') {
      return snapshotResponse(runCareer04Gk());
    }

    if (body.kind === 'replaySettled') {
      return snapshotResponse(runCareer06Settled());
    }

    if (body.kind === 'replayDf') {
      return snapshotResponse(runCareer07Df());
    }

    if (body.kind === 'replayMf') {
      return snapshotResponse(runCareer08Mf());
    }

    if (body.kind === 'replayFw') {
      return snapshotResponse(runCareer09Fw());
    }

    if (body.kind === 'replayTransfer') {
      return snapshotResponse(runCareer10Transfer());
    }

    if (body.kind === 'replayLoan') {
      return snapshotResponse(runCareer11Loan());
    }

    if (body.kind === 'replayInjury') {
      return snapshotResponse(runCareer12Injury());
    }

    if (body.kind === 'replayIntegration') {
      return snapshotResponse(runCareer13Integration());
    }

    if (body.kind === 'sha256') {
      return jsonResponse({ hashes: body.inputs.map((input) => sha256Hex(input)) });
    }

    if (body.kind === 'canonical') {
      return jsonResponse({ canonical: canonicalize(body.value) });
    }

    return new Response('unknown probe kind', { status: 400 });
  },
};
