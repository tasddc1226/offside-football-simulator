import type { SimulationInput, SimulationResult } from '@offside/domain';
import { inlineSimulator, type Simulator } from '../simulator/index.js';

export type SimulateRequest = { id: number; kind: 'simulate'; input: SimulationInput };
export type SimulateReply =
  | { id: number; kind: 'result'; result: SimulationResult }
  | { id: number; kind: 'error'; message: string };

export interface MessagePortLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  start?(): void;
  close?(): void;
}

function isSimulateRequest(value: unknown): value is SimulateRequest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { id?: unknown; kind?: unknown; input?: unknown };
  return typeof candidate.id === 'number' && candidate.kind === 'simulate' && candidate.input !== undefined;
}

/**
 * Worker 쪽 핸들러. 형태가 맞지 않는 메시지는 무시한다. `simulator.simulate`가 throw(또는
 * reject)하면 'error' 응답을 보낸다. 반환값은 리스너를 떼는 detach 함수.
 */
export function attachSimulatorHandler(port: MessagePortLike, simulator: Simulator = inlineSimulator): () => void {
  const listener = (event: { data: unknown }): void => {
    const message = event.data;
    if (!isSimulateRequest(message)) return;

    Promise.resolve()
      .then(() => simulator.simulate(message.input))
      .then((result) => {
        const reply: SimulateReply = { id: message.id, kind: 'result', result };
        port.postMessage(reply);
      })
      .catch((error: unknown) => {
        const reply: SimulateReply = {
          id: message.id,
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
        };
        port.postMessage(reply);
      });
  };

  port.addEventListener('message', listener);
  port.start?.();

  return () => {
    port.removeEventListener('message', listener);
  };
}
