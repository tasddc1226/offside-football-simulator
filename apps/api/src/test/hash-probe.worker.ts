import {
  canonicalize,
  sha256Hex,
  simulate,
  verifySnapshot,
  type Command,
  type DomainSnapshot,
  type JsonValue,
  type SimulationResult,
} from '@offside/domain';
import { career01 } from '@offside/fixtures';

/**
 * career01 fixture(CREATE_CAREER + 12개 명령)을 순서대로 재생해 최종 DomainSnapshot을 돌려준다.
 * `packages/domain/src/__fixtures__/career-01.ts`의 재생 로직과 같은 순서다.
 */
function runCareer01(): DomainSnapshot {
  const createCommand: Command & { commandId: string; expectedRevision: number } = {
    type: 'CREATE_CAREER',
    commandId: 'probe-create',
    expectedRevision: 0,
    payload: {
      careerId: career01.createCareer.careerId,
      seed: career01.createCareer.seed,
      stage: career01.createCareer.stage,
      age: career01.createCareer.age,
      attributes: career01.createCareer.attributes,
      state: career01.createCareer.state,
      context: career01.createCareer.context,
      relationships: career01.createCareer.relationships,
      simulationMode: career01.createCareer.simulationMode,
      rulesetVersion: career01.rulesetVersion,
      contentPackVersion: career01.contentPackVersion,
    },
  };

  let result: SimulationResult = simulate({
    snapshot: null,
    command: createCommand,
    rulesetVersion: career01.rulesetVersion,
    contentPackVersion: career01.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`CREATE_CAREER 실패: ${result.error.code} ${result.error.message}`);
  }
  let snapshot = result.snapshot;

  career01.commands.forEach((rawCommand, index) => {
    const command = {
      ...(rawCommand as Command),
      commandId: `probe-${index + 1}`,
      expectedRevision: snapshot.revision,
    } as Command & { commandId: string; expectedRevision: number };

    result = simulate({
      snapshot,
      command,
      rulesetVersion: career01.rulesetVersion,
      contentPackVersion: career01.contentPackVersion,
    });
    if (!result.ok) {
      throw new Error(`명령 ${index + 1}(${command.type}) 실패: ${result.error.code} ${result.error.message}`);
    }
    snapshot = result.snapshot;
  });

  return snapshot;
}

type ProbeRequest =
  | { kind: 'replay' }
  | { kind: 'sha256'; inputs: string[] }
  | { kind: 'canonical'; value: JsonValue };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const body = (await request.json()) as ProbeRequest;

    if (body.kind === 'replay') {
      const snapshot = runCareer01();
      return jsonResponse({
        revision: snapshot.revision,
        stateHash: snapshot.stateHash,
        rngStateDraws: snapshot.state.rngState.draws,
        verifySnapshotOk: verifySnapshot(snapshot).ok,
      });
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
