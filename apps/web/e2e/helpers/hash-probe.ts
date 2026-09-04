import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import type { SimulationResult } from '@offside/domain';

export type MarketWorkerProbeResult = {
  transfer: { revision: number; stateHash: string; rngStateDraws: number; elapsedMs: number };
  loan: { revision: number; stateHash: string; rngStateDraws: number; elapsedMs: number };
};

function viteFsUrl(filePath: string): string {
  return `/@fs/${filePath.replaceAll(path.sep, '/')}`;
}

/** dev server가 변환한 fixtures/domain과 engine-client Worker를 브라우저에서 직접 실행한다. */
export async function runMarketWorkerHashProbe(page: Page): Promise<MarketWorkerProbeResult> {
  const repoRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
  const fixtureModuleUrl = viteFsUrl(path.join(repoRoot, 'packages/fixtures/src/index.ts'));
  const workerModuleUrl = viteFsUrl(
    path.join(repoRoot, 'packages/engine-client/src/worker/engine.worker.ts'),
  );
  const hostModuleUrl = viteFsUrl(path.join(repoRoot, 'packages/engine-client/src/worker/host.ts'));

  return page.evaluate(
    async ({
      fixtureModuleUrl: fixtureUrl,
      workerModuleUrl: workerUrl,
      hostModuleUrl: hostUrl,
    }) => {
      const fixtures = await import(/* @vite-ignore */ fixtureUrl);
      const { createWorkerSimulator } = await import(/* @vite-ignore */ hostUrl);
      const worker = new Worker(workerUrl, { type: 'module' });
      const simulator = createWorkerSimulator(worker);

      try {
        async function replay(
          label: 'transfer' | 'loan',
          fixture: { rulesetVersion: string; contentPackVersion: string },
          makeCommands: (newId: () => string) => Array<Record<string, unknown>>,
        ) {
          let counter = 0;
          let snapshot: {
            revision: number;
            stateHash: string;
            state: { rngState: { draws: number } };
          } | null = null;
          const startedAt = performance.now();
          for (const command of makeCommands(() => `browser-${label}-${counter++}`)) {
            const result: SimulationResult = await simulator.simulate({
              snapshot,
              command,
              ruleset: fixtures.rulesetProto,
              rulesetVersion: fixture.rulesetVersion,
              contentPackVersion: fixture.contentPackVersion,
            });
            if (!result.ok)
              throw new Error(`${label} ${result.error.code}: ${result.error.message}`);
            snapshot = result.snapshot;
          }
          if (snapshot === null) throw new Error(`${label} 명령 목록이 비어 있다.`);
          return {
            revision: snapshot.revision,
            stateHash: snapshot.stateHash,
            rngStateDraws: snapshot.state.rngState.draws,
            elapsedMs: performance.now() - startedAt,
          };
        }

        return {
          transfer: await replay(
            'transfer',
            fixtures.career10Transfer,
            fixtures.career10TransferEngineCommands,
          ),
          loan: await replay('loan', fixtures.career11Loan, fixtures.career11LoanEngineCommands),
        };
      } finally {
        simulator.dispose();
        worker.terminate();
      }
    },
    { fixtureModuleUrl, workerModuleUrl, hostModuleUrl },
  );
}
