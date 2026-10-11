import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ADMIN_SPECS } from './ci-web-e2e.mjs';

export function e2eArgs(scope, shard) {
  if (!/^[1-3]\/[1-3]$/.test(shard) || Number(shard[0]) > Number(shard[2]))
    throw new Error('Invalid E2E shard');
  if (scope !== 'admin' && scope !== 'full') throw new Error('Invalid E2E scope');
  if (scope === 'admin' && shard !== '1/1') throw new Error('Admin E2E must run in one shard');
  return [
    '--filter',
    '@offside/web',
    'exec',
    'playwright',
    'test',
    ...(scope === 'admin' ? ADMIN_SPECS : []),
    `--shard=${shard}`,
  ];
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  execFileSync('pnpm', e2eArgs(process.argv[2], process.argv[3]), { stdio: 'inherit' });
}
