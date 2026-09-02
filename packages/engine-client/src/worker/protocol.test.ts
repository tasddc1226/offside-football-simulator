import type { SimulationInput, SimulationResult } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import type { Simulator } from '../simulator/index.js';
import { createWorkerSimulator } from './host.js';
import { attachSimulatorHandler, type MessagePortLike, type SimulateReply, type SimulateRequest } from './protocol.js';

const sampleInput: SimulationInput = {
  snapshot: null,
  command: {
    type: 'CREATE_CAREER',
    commandId: 'cmd-1',
    expectedRevision: 0,
    payload: {
      careerId: 'car_test',
      seed: 'seed',
      stage: 'YOUTH',
      age: 17,
      attributes: {
        shooting: 1,
        passing: 1,
        dribbling: 1,
        tackling: 1,
        firstTouch: 1,
        crossing: 1,
        goalkeeping: 1,
        pace: 1,
        acceleration: 1,
        agility: 1,
        jumping: 1,
        stamina: 1,
        strength: 1,
        durability: 1,
        decisions: 1,
        concentration: 1,
        composure: 1,
        positioning: 1,
        leadership: 1,
        consistency: 1,
      },
      state: { form: 50, fitness: 80, morale: 60 },
      context: { tacticalFit: 50, squadStatus: 50, positionProficiency: 100 },
      relationships: { managerTrust: 50, captain: 50, rival: 50, fans: 50, agent: 50 },
      simulationMode: 'CHAPTER',
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    },
  },
  rulesetVersion: '1.0.0',
  contentPackVersion: '0.1.0',
};

const sampleResult: SimulationResult = {
  ok: true,
  snapshot: {
    revision: 1,
    checkpoint: 'CAREER_CREATED',
    state: {
      schemaVersion: 1,
      careerId: 'car_test',
      status: 'ACTIVE',
      stage: 'YOUTH',
      age: 17,
      currentStep: 0,
      seasonPhase: 'PRESEASON',
      simulationMode: 'CHAPTER',
      attributes: sampleInput.command.payload as unknown as Record<string, number>,
      state: { form: 50, fitness: 80, morale: 60 },
      context: { tacticalFit: 50, squadStatus: 50, positionProficiency: 100 },
      relationships: { managerTrust: 50, captain: 50, rival: 50, fans: 50, agent: 50 },
      tags: [],
      appliedSourceIds: [],
      activeEffects: [],
      deferredEffects: [],
      resolvedEventIds: [],
      rngState: { s: [1, 2, 3, 4], draws: 0 },
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    },
    stateHash: 'a'.repeat(64),
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  },
  appliedEffects: [],
  nextAction: 'ADVANCE',
} as unknown as SimulationResult;

function makeChannel(): { hostPort: MessagePortLike; workerPort: MessagePortLike } {
  const channel = new MessageChannel();
  return { hostPort: channel.port1 as unknown as MessagePortLike, workerPort: channel.port2 as unknown as MessagePortLike };
}

function waitForNext(port: MessagePortLike): Promise<unknown> {
  return new Promise((resolve) => {
    const listener = (event: { data: unknown }): void => {
      port.removeEventListener('message', listener);
      resolve(event.data);
    };
    port.addEventListener('message', listener);
    port.start?.();
  });
}

describe('attachSimulatorHandler', () => {
  it('형태가 다른 메시지는 무시하고, 올바른 요청에만 응답한다', async () => {
    const { hostPort, workerPort } = makeChannel();
    const simulator: Simulator = { simulate: () => Promise.resolve(sampleResult) };
    const detach = attachSimulatorHandler(workerPort, simulator);

    hostPort.postMessage({ not: 'a valid request' });
    hostPort.postMessage({ id: 1, kind: 'simulate', input: sampleInput });

    const reply = (await waitForNext(hostPort)) as SimulateReply;
    expect(reply).toEqual({ id: 1, kind: 'result', result: sampleResult });

    detach();
  });

  it('simulator가 reject하면 error 응답을 보낸다', async () => {
    const { hostPort, workerPort } = makeChannel();
    const simulator: Simulator = { simulate: () => Promise.reject(new Error('boom')) };
    const detach = attachSimulatorHandler(workerPort, simulator);

    const request: SimulateRequest = { id: 7, kind: 'simulate', input: sampleInput };
    hostPort.postMessage(request);

    const reply = (await waitForNext(hostPort)) as SimulateReply;
    expect(reply).toEqual({ id: 7, kind: 'error', message: 'boom' });

    detach();
  });
});

describe('createWorkerSimulator', () => {
  it('형태가 다른 응답은 무시하고 올바른 결과만 받아들인다', async () => {
    const { hostPort, workerPort } = makeChannel();
    workerPort.addEventListener('message', () => {
      workerPort.postMessage({ not: 'a valid reply' });
      workerPort.postMessage({ id: 1, kind: 'result', result: sampleResult } satisfies SimulateReply);
    });
    workerPort.start?.();

    const worker = createWorkerSimulator(hostPort);
    const result = await worker.simulate(sampleInput);
    expect(result).toEqual(sampleResult);

    worker.dispose();
  });

  it("'error' 응답은 reject한다", async () => {
    const { hostPort, workerPort } = makeChannel();
    workerPort.addEventListener('message', (event) => {
      const request = event.data as SimulateRequest;
      workerPort.postMessage({ id: request.id, kind: 'error', message: '시뮬레이션 실패' } satisfies SimulateReply);
    });
    workerPort.start?.();

    const worker = createWorkerSimulator(hostPort);
    await expect(worker.simulate(sampleInput)).rejects.toThrow('시뮬레이션 실패');

    worker.dispose();
  });

  it('dispose()는 대기 중인 요청을 모두 reject한다', async () => {
    const { hostPort } = makeChannel();
    const worker = createWorkerSimulator(hostPort);

    const pending = worker.simulate(sampleInput);
    worker.dispose();

    await expect(pending).rejects.toThrow();
  });

  it('dispose() 이후의 simulate() 호출은 즉시 reject한다(응답을 받을 리스너가 이미 떨어졌으므로)', async () => {
    const { hostPort } = makeChannel();
    const worker = createWorkerSimulator(hostPort);
    worker.dispose();

    await expect(worker.simulate(sampleInput)).rejects.toThrow();
  });
});
