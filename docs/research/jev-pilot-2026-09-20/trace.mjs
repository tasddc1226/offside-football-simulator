// Research-only observer: execute an adjacent temporary copy of the existing CLI.
// Default: engine, policies and RNG unchanged. JEV_PER_VISIT explicitly changes the CLI choice key.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const temp = resolve(root, 'tooling/scripts/.jev-observed.ts');
const trace = process.env.JEV_TRACE_PATH ?? '/tmp/offside-jev-events.jsonl';
let source = await readFile(resolve(root, 'tooling/scripts/career-sim.ts'), 'utf8');
if (process.env.JEV_PER_VISIT === '1') {
  const old = 'commandForPending(state, pack, seed)';
  if (source.split(old).length !== 2) throw new Error('Choice intervention point changed');
  source = source.replace(old, 'commandForPending(state, pack, `${seed}:${state.seasonHistory.length}:${state.currentStep}`)');
}
const marker = '  return result.snapshot;';
if (source.split(marker).length !== 2) throw new Error('Observer insertion point changed');
source = `import { appendFileSync as appendJevTrace } from 'node:fs';\n` + source.replace(marker, `
  if (type === 'RESOLVE_EVENT' && snapshot !== null) {
    const before = snapshot.state;
    const after = result.snapshot.state;
    const input = payload as {eventId: string; choiceId: string};
    appendJevTrace(process.env.JEV_TRACE_PATH!, JSON.stringify({
      commandId:id, careerId:before.careerId, season:before.seasonHistory.length,
      step:before.currentStep, eventId:input.eventId, choiceId:input.choiceId,
      age:before.age, fitness:before.state.fitness, morale:before.state.morale,
      managerTrust:before.relationships.managerTrust,
      tags:before.tags, memory:before.memoryTags.managerTrust,
      newSources:after.appliedSourceIds.length-before.appliedSourceIds.length,
      changedAttributes:JSON.stringify(before.attributes)!==JSON.stringify(after.attributes),
      changedState:JSON.stringify(before.state)!==JSON.stringify(after.state),
      changedRelationships:JSON.stringify(before.relationships)!==JSON.stringify(after.relationships),
      newTags:after.tags.filter(t=>!before.tags.includes(t)),
    })+'\\n');
  }
${marker}`);
await writeFile(trace, '');
try {
  await writeFile(temp, source);
  const run = spawnSync('pnpm', ['--filter','@offside/scripts','exec','tsx',temp,...process.argv.slice(2)],
    {cwd:root,env:{...process.env,JEV_TRACE_PATH:trace},stdio:'inherit'});
  process.exitCode = run.status ?? 1;
} finally { await unlink(temp); }
