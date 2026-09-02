// T-1-010: dev 전용 probe. ADR-003 "브라우저 Web Worker에서 시뮬레이션" 검증용이며 main.tsx의
// import.meta.env.DEV 분기 밖에서는 이 파일이 로드되지 않는다(프로덕션 번들에 포함되지 않음).
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createWorkerSimulator } from '@offside/engine-client';
import { career01, career01EngineCommands } from '@offside/fixtures';
import type { DomainSnapshot } from '@offside/domain';

type ProbeResult = { revision: number; stateHash: string } | { error: string };

async function runProbe(): Promise<ProbeResult> {
  const worker = new Worker(new URL('@offside/engine-client/worker', import.meta.url), { type: 'module' });
  const simulator = createWorkerSimulator(worker as unknown as Parameters<typeof createWorkerSimulator>[0]);

  try {
    let counter = 0;
    const commands = career01EngineCommands(() => `hash-probe-${counter++}`);
    let snapshot: DomainSnapshot | null = null;

    for (const command of commands) {
      const result = await simulator.simulate({
        snapshot,
        command,
        rulesetVersion: career01.rulesetVersion,
        contentPackVersion: career01.contentPackVersion,
      });
      if (!result.ok) {
        return { error: `${result.error.code}: ${result.error.message}` };
      }
      snapshot = result.snapshot;
    }

    if (snapshot === null) {
      return { error: 'career01EngineCommands가 빈 배열을 반환했다.' };
    }

    return { revision: snapshot.revision, stateHash: snapshot.stateHash };
  } finally {
    simulator.dispose();
    worker.terminate();
  }
}

function HashProbeScreen() {
  const [result, setResult] = useState<ProbeResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    runProbe()
      .then((value) => {
        if (!cancelled) setResult(value);
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ error: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <pre data-testid="hash-probe-result">{result ? JSON.stringify(result) : ''}</pre>;
}

export function mountHashProbe(container: HTMLElement): void {
  createRoot(container).render(
    <StrictMode>
      <HashProbeScreen />
    </StrictMode>,
  );
}
