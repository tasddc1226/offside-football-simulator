import type { SimulationInput } from '@offside/domain';
import { rulesetProto } from '@offside/fixtures';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkerSimulator, WorkerUnavailableError } from './host.js';
import type { MessagePortLike, SimulateReply } from './protocol.js';

const sampleInput: SimulationInput = {
  snapshot: null,
  command: {
    type: 'CREATE_CAREER',
    commandId: 'cmd-1',
    expectedRevision: 0,
    payload: {
      careerId: 'car_test',
      seed: 'seed',
      simulationMode: 'CHAPTER',
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    },
  },
  ruleset: rulesetProto,
  rulesetVersion: '1.0.0',
  contentPackVersion: '0.1.0',
};

type Listener = (event: { data: unknown }) => void;
type OpaqueListener = (event: unknown) => void;

/** 실제 Worker처럼 message·error·messageerror 리스너를 등록받고 응답하지 않을 수도 있는 가짜 포트. */
class FakePort implements MessagePortLike {
  messageListeners = new Set<Listener>();
  errorListeners = new Set<OpaqueListener>();
  messageErrorListeners = new Set<OpaqueListener>();
  posted: unknown[] = [];
  closed = false;
  /** 실제로 응답하는 "워커 쪽"을 흉내낼 때 postMessage()가 이 콜백을 부른다. */
  onPostMessage?: (message: unknown) => void;

  addEventListener(type: string, listener: (event: never) => void): void {
    if (type === 'message') this.messageListeners.add(listener as Listener);
    else if (type === 'error') this.errorListeners.add(listener as OpaqueListener);
    else if (type === 'messageerror') this.messageErrorListeners.add(listener as OpaqueListener);
  }

  removeEventListener(type: string, listener: (event: never) => void): void {
    if (type === 'message') this.messageListeners.delete(listener as Listener);
    else if (type === 'error') this.errorListeners.delete(listener as OpaqueListener);
    else if (type === 'messageerror') this.messageErrorListeners.delete(listener as OpaqueListener);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
    this.onPostMessage?.(message);
  }

  close(): void {
    this.closed = true;
  }

  emitReply(reply: SimulateReply): void {
    for (const listener of this.messageListeners) listener({ data: reply });
  }

  emitError(): void {
    for (const listener of this.errorListeners) listener({});
  }
}

/** 요청을 받으면 즉시 성공 결과로 응답하는 정상 포트("워커 쪽"이 바로 답한다고 흉내낸다). */
function makeRespondingPort(): FakePort {
  const port = new FakePort();
  port.onPostMessage = (message) => {
    const request = message as { id: number };
    port.emitReply({
      id: request.id,
      kind: 'result',
      result: { ok: true, snapshot: {} as never, appliedEffects: [], nextAction: 'ADVANCE' },
    });
  };
  return port;
}

describe('createWorkerSimulator: 실패 처리', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('가짜 포트가 응답하지 않으면 타임아웃 뒤 SERVICE_UNAVAILABLE로 거부한다', async () => {
    const port = new FakePort();
    const worker = createWorkerSimulator(port, { timeoutMs: 1000 });

    const pending = worker.simulate(sampleInput);
    const assertion = expect(pending).rejects.toBeInstanceOf(WorkerUnavailableError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    worker.dispose();
  });

  it('error 이벤트가 나면 대기 중인 요청을 전부 거부한다', async () => {
    const port = new FakePort();
    const worker = createWorkerSimulator(port, { timeoutMs: 60000 });

    const first = worker.simulate(sampleInput);
    const second = worker.simulate(sampleInput);
    port.emitError();

    await expect(first).rejects.toBeInstanceOf(WorkerUnavailableError);
    await expect(second).rejects.toBeInstanceOf(WorkerUnavailableError);

    worker.dispose();
  });

  it('workerFactory 없이 재사용하려 하면 다음 요청도 즉시 거부된다', async () => {
    const port = new FakePort();
    const worker = createWorkerSimulator(port, { timeoutMs: 60000 });

    port.emitError();
    await expect(worker.simulate(sampleInput)).rejects.toBeInstanceOf(WorkerUnavailableError);

    worker.dispose();
  });

  it('workerFactory가 있으면 죽은 뒤 다음 요청에서 새 포트로 정상 재개한다', async () => {
    const brokenPort = new FakePort();
    const freshPort = makeRespondingPort();
    const worker = createWorkerSimulator(brokenPort, { timeoutMs: 60000, workerFactory: () => freshPort });

    brokenPort.emitError();

    const result = await worker.simulate(sampleInput);
    expect(result.ok).toBe(true);
    expect(freshPort.posted).toHaveLength(1);
    expect(brokenPort.closed).toBe(true);

    worker.dispose();
  });

  it('정상 왕복은 그대로 동작한다', async () => {
    const port = makeRespondingPort();
    const worker = createWorkerSimulator(port);

    const result = await worker.simulate(sampleInput);
    expect(result.ok).toBe(true);

    worker.dispose();
  });
});
