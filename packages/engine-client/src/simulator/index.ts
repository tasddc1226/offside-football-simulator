import { simulate, type SimulationInput, type SimulationResult } from '@offside/domain';

export interface Simulator {
  simulate(input: SimulationInput): Promise<SimulationResult>;
}

/** domain `simulate`를 같은 스레드에서 실행한다. Node·테스트·Worker 미지원 환경용. */
export const inlineSimulator: Simulator = {
  simulate(input: SimulationInput): Promise<SimulationResult> {
    return Promise.resolve(simulate(input));
  },
};
