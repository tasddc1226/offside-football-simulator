// TODO(Phase 2): 지금 타임아웃은 요청당이 아니라 포트 전체를 broken으로 만든다(하나가 늦으면
// 대기 중인 나머지 요청까지 전부 거부된다) — Phase 1 ADVANCE에는 문제없지만, 한 요청이 길어질 수
// 있는 시즌 시뮬레이션이 들어오면 요청당 예산으로 바꿀 것.
import type { SimulationInput, SimulationResult } from '@offside/domain';
import type { Simulator } from '../simulator/index.js';
import type { MessagePortLike, SimulateReply, SimulateRequest } from './protocol.js';

function isSimulateReply(value: unknown): value is SimulateReply {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { id?: unknown; kind?: unknown };
  return typeof candidate.id === 'number' && (candidate.kind === 'result' || candidate.kind === 'error');
}

/**
 * 실제 `Worker`가 내는 `error`·`messageerror` 이벤트까지 등록하기 위한 내부 캐스팅용 타입.
 * `MessagePortLike`는 `'message'`만 선언하므로, 공개 시그니처는 그대로 두고 이 파일 안에서만
 * 넓혀 쓴다(기존 `MessagePortLike` 호출자와의 호환을 깨지 않는다). `extends`가 아니라 오버로드를
 * 나란히 선언한다 — `extends`로는 기존 `'message'` 오버로드와 새 오버로드가 서로를 좁혀 충돌한다.
 */
interface PortWithErrorEvents {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'error' | 'messageerror', listener: (event: unknown) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'error' | 'messageerror', listener: (event: unknown) => void): void;
  start?(): void;
  close?(): void;
}

function widen(port: MessagePortLike): PortWithErrorEvents {
  return port as unknown as PortWithErrorEvents;
}

/** `EngineError { code: 'SERVICE_UNAVAILABLE' }`와 같은 모양(code·message)을 가진 Error. */
export class WorkerUnavailableError extends Error {
  readonly code = 'SERVICE_UNAVAILABLE' as const;
  constructor(message = 'Worker 응답 없음') {
    super(message);
    this.name = 'WorkerUnavailableError';
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

export type WorkerSimulatorOptions = {
  /** 요청 하나가 응답 없이 기다릴 수 있는 최대 시간(ms). 기본 15000. */
  timeoutMs?: number;
  /**
   * 타임아웃·`error`·`messageerror` 뒤 다음 요청이 새로 만들 Worker 포트. 주지 않으면 죽은
   * Worker를 재사용할 수 없어 이후 모든 `simulate()`가 거부된다(명시적 실패가 무한 대기보다 낫다).
   */
  workerFactory?: () => MessagePortLike;
};

/**
 * 메인 스레드 쪽. id로 요청·응답을 짝짓는다. 'error' 응답은 reject한다. 요청마다 타임아웃을 걸어
 * 두고, `error`·`messageerror` 이벤트나 타임아웃이 나면 대기 중인 요청 전부를
 * `WorkerUnavailableError`로 거부하고 포트를 "broken"으로 표시한다. broken 상태에서 새
 * `simulate()`가 오면 `workerFactory()`로 포트를 다시 만들어 보낸다(옵션이 없으면 거부).
 * `dispose()`는 대기 중인 요청을 모두 reject하고 리스너를 떼고 `port.close?.()`를 부른다.
 */
export function createWorkerSimulator(
  port: MessagePortLike,
  options: WorkerSimulatorOptions = {},
): Simulator & { dispose(): void } {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let nextId = 1;
  let disposed = false;
  let broken = false;
  let currentPort = widen(port);

  const pending = new Map<
    number,
    { resolve: (result: SimulationResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  function rejectAllPending(reason: Error): void {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(reason);
    }
    pending.clear();
  }

  function messageListener(event: { data: unknown }): void {
    const message = event.data;
    if (!isSimulateReply(message)) return;
    const entry = pending.get(message.id);
    if (entry === undefined) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);

    if (message.kind === 'result') {
      entry.resolve(message.result);
    } else {
      entry.reject(new Error(message.message));
    }
  }

  function markBrokenAndRejectPending(): void {
    broken = true;
    rejectAllPending(new WorkerUnavailableError());
  }

  function attach(target: PortWithErrorEvents): void {
    target.addEventListener('message', messageListener);
    target.addEventListener('error', markBrokenAndRejectPending);
    target.addEventListener('messageerror', markBrokenAndRejectPending);
    target.start?.();
  }

  function detach(target: PortWithErrorEvents): void {
    target.removeEventListener('message', messageListener);
    target.removeEventListener('error', markBrokenAndRejectPending);
    target.removeEventListener('messageerror', markBrokenAndRejectPending);
  }

  attach(currentPort);

  return {
    simulate(input: SimulationInput): Promise<SimulationResult> {
      if (disposed) {
        return Promise.reject(new Error('createWorkerSimulator: dispose() 후에는 simulate()를 호출할 수 없다.'));
      }

      if (broken) {
        if (options.workerFactory === undefined) {
          return Promise.reject(
            new WorkerUnavailableError('Worker가 응답하지 않아 재사용할 수 없다. workerFactory를 제공해야 한다.'),
          );
        }
        detach(currentPort);
        currentPort.close?.();
        currentPort = widen(options.workerFactory());
        broken = false;
        attach(currentPort);
      }

      const id = nextId++;
      return new Promise<SimulationResult>((resolve, reject) => {
        // 타이머가 markBrokenAndRejectPending()을 부르면 pending 전체(이 항목 포함)를 reject하고
        // 지운다 — 여기서 따로 pending.delete(id)를 하면 이 항목이 지워진 뒤라 reject를 못 받는다.
        const timer = setTimeout(markBrokenAndRejectPending, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        const request: SimulateRequest = { id, kind: 'simulate', input };
        currentPort.postMessage(request);
      });
    },
    dispose(): void {
      disposed = true;
      rejectAllPending(new Error('createWorkerSimulator: dispose()로 대기 중인 요청이 취소되었다.'));
      detach(currentPort);
      currentPort.close?.();
    },
  };
}
