import type { SimulationInput, SimulationResult } from '@offside/domain';
import type { Simulator } from '../simulator/index.js';
import type { MessagePortLike, SimulateReply, SimulateRequest } from './protocol.js';

function isSimulateReply(value: unknown): value is SimulateReply {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { id?: unknown; kind?: unknown };
  return typeof candidate.id === 'number' && (candidate.kind === 'result' || candidate.kind === 'error');
}

/**
 * 메인 스레드 쪽. id로 요청·응답을 짝짓는다. 'error' 응답은 reject한다. `dispose()`는 대기 중인
 * 요청을 모두 reject하고 리스너를 떼고 `port.close?.()`를 부른다.
 */
export function createWorkerSimulator(port: MessagePortLike): Simulator & { dispose(): void } {
  let nextId = 1;
  let disposed = false;
  const pending = new Map<number, { resolve: (result: SimulationResult) => void; reject: (error: Error) => void }>();

  const listener = (event: { data: unknown }): void => {
    const message = event.data;
    if (!isSimulateReply(message)) return;
    const entry = pending.get(message.id);
    if (entry === undefined) return;
    pending.delete(message.id);

    if (message.kind === 'result') {
      entry.resolve(message.result);
    } else {
      entry.reject(new Error(message.message));
    }
  };

  port.addEventListener('message', listener);
  port.start?.();

  return {
    simulate(input: SimulationInput): Promise<SimulationResult> {
      if (disposed) {
        return Promise.reject(new Error('createWorkerSimulator: dispose() 후에는 simulate()를 호출할 수 없다.'));
      }
      const id = nextId++;
      return new Promise<SimulationResult>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const request: SimulateRequest = { id, kind: 'simulate', input };
        port.postMessage(request);
      });
    },
    dispose(): void {
      disposed = true;
      for (const entry of pending.values()) {
        entry.reject(new Error('createWorkerSimulator: dispose()로 대기 중인 요청이 취소되었다.'));
      }
      pending.clear();
      port.removeEventListener('message', listener);
      port.close?.();
    },
  };
}
