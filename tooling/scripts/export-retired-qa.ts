/** Local QA only. Produces private ordinary PUT bodies; never contacts a server or browser. */
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { simulateRange, type CareerCommandObserver } from './career-sim.ts';
import { loadRuleset } from '../../packages/content/src/rulesets/load-ruleset.ts';
import { loadRetirementArtifacts } from '../../packages/content/src/retirement-artifacts.ts';
import { createEngineClient } from '../../packages/engine-client/src/engine.ts';
import { MemoryLocalStore } from '../../packages/engine-client/src/store/memory.ts';
import { inlineSimulator } from '../../packages/engine-client/src/simulator/index.ts';
import type { EngineCommand } from '../../packages/engine-client/src/types.ts';
import { PutCareerBodySchema } from '../../packages/contracts/src/careers.ts';

export async function exportRetiredQa(out: string, serviceSeasonId: string, seedPrefix: string) {
  const normalizedOut = resolve(out);
  if (!isAbsolute(out) || !normalizedOut.startsWith('/tmp/') || !serviceSeasonId || !seedPrefix)
    throw new Error(
      'An absolute /tmp output directory, service season and seed prefix are required',
    );
  // Normalize traversal without resolving macOS's valid /tmp -> /private/tmp alias.
  out = normalizedOut;
  const commands: Array<{ command: EngineCommand; hash: string }> = [];
  const observe: CareerCommandObserver = (command, snapshot) =>
    commands.push({
      command: structuredClone(command) as EngineCommand,
      hash: snapshot.stateHash,
    });
  const versions = { rulesetVersion: '3.2.0', contentPackVersion: '0.11.0' };
  const prefix = `qa-retired-${createHash('sha256').update(seedPrefix).digest('hex').slice(0, 12)}`;
  const batch = simulateRange(
    {
      ...versions,
      careerIdPrefix: prefix,
      seeds: 1,
      seedPrefix,
      seasons: 30,
      toRetirement: true,
      policy: 'opportunity',
      position: 'FW',
      mode: 'FAST',
      jobs: 1,
      out,
      verify: false,
    },
    observe,
  );
  if (batch.failures.length || commands.at(-1)?.command.type !== 'RETIRE')
    throw new Error('Natural career failed to reach retirement');
  const careerId = `${prefix}-FW-0`;
  const store = new MemoryLocalStore();
  const client = createEngineClient({
    store,
    simulator: inlineSimulator,
    ruleset: loadRuleset(versions.rulesetVersion),
    retirementArtifacts: (v) => loadRetirementArtifacts(v.rulesetVersion, v.contentPackVersion),
  });
  const bodies: Array<{ file: string; baseRevision: number; revision: number; bytes: number }> = [];
  // Exclusive directory creation prevents accidental overwrite of another QA export.
  await mkdir(out, { mode: 0o700 });
  for (let index = 0; index < commands.length; index++) {
    const entry = commands[index]!;
    const result = await client.execute({
      careerId,
      command: entry.command,
      ...(entry.command.type === 'CREATE_CAREER'
        ? { createdServiceSeasonId: serviceSeasonId }
        : {}),
    });
    if (!result.ok) throw new Error(`Replay rejected revision ${index + 1}: ${result.error.code}`);
    if (result.domainSnapshot.stateHash !== entry.hash)
      throw new Error(`Natural/replay hash differs at revision ${index + 1}`);
    // Checkpoint every 40 commands. Each body preserves the contiguous log and API revision contract.
    if ((index + 1) % 40 !== 0 && index !== commands.length - 1) continue;
    const body = PutCareerBodySchema.parse(await client.buildSyncBody(careerId));
    const json = JSON.stringify(body);
    const bytes = Buffer.byteLength(json);
    if (bytes > 1_000_000)
      throw new Error(`PUT checkpoint ${index + 1} exceeds conservative 1MB limit`);
    const file = `put-${String(bodies.length + 1).padStart(3, '0')}.json`;
    await writeFile(join(out, file), json, { mode: 0o600, flag: 'wx' });
    bodies.push({ file, baseRevision: body.baseRevision, revision: body.snapshot.revision, bytes });
    await client.markSynced(careerId, body.snapshot.revision);
  }
  const saved = await client.loadCareer(careerId);
  if (!saved.ok || saved.snapshot.state.status !== 'RETIRED')
    throw new Error('Replay is not retired');
  const manifest = {
    careerId,
    serviceSeasonId,
    ...versions,
    commandCount: commands.length,
    seasons: saved.snapshot.state.seasonHistory.length,
    stateHash: saved.snapshot.stateHash,
    bodies,
  };
  await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2), {
    mode: 0o600,
    flag: 'wx',
  });
  return {
    directory: out,
    careerId,
    commands: commands.length,
    checkpoints: bodies.length,
    maximumPutBytes: Math.max(...bodies.map((body) => body.bytes)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const value = (flag: string) => {
    const i = process.argv.indexOf(flag);
    return i < 0 ? '' : (process.argv[i + 1] ?? '');
  };
  const result = await exportRetiredQa(
    value('--out'),
    value('--service-season'),
    value('--seed-prefix'),
  );
  // Only metadata; source snapshots and seeds stay in private files.
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
