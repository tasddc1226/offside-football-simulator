// Local-only HTTP benchmark. No cookies, names, IDs or snapshots are written to output.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const base = new URL(process.env.ANNUAL_BENCH_URL ?? 'http://127.0.0.1:8891');
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(base.hostname))
  throw new Error('Annual benchmark only permits a local loopback Worker');
const rules = JSON.parse(
  readFileSync(new URL('../../packages/content/rulesets/3.5.0/ruleset.json', import.meta.url)),
);
let cookie;
const timings = [];
async function call(path, body) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: 'http://localhost:5173',
      'Content-Type': 'application/json',
      'Idempotency-Key': randomUUID(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  cookie ??= response.headers.get('set-cookie')?.split(';')[0];
  const text = await response.text();
  if (!response.ok)
    throw new Error(
      `Local Worker request failed: ${response.status} ${path.replace(/[a-f0-9-]{20,}/g, ':id')} ${JSON.parse(text).error?.code}`,
    );
  return {
    data: JSON.parse(text).data,
    ms: performance.now() - start,
    bytes: Buffer.byteLength(text),
  };
}
const profile = (await call('/v1/profile')).data;
const archetype = rules.archetypes.find((entry) => entry.position === 'ST');
const created = (
  await call('/v1/careers/server', {
    expectedProfileId: profile.id,
    draft: {
      name: '로컬 측정',
      gender: 'MALE',
      nationalityCode: 'KR',
      preferredFoot: 'RIGHT',
      position: 'ST',
      archetypeId: archetype.id,
      backgroundId: rules.backgrounds[0].id,
    },
  })
).data;
let revision = created.snapshot.revision;
let stories = 0,
  pauses = 0;
for (let year = 0; year < 3; year++) {
  let current = (
    await call(`/v1/careers/${created.snapshot.careerId}/annual-runs`, {
      expectedCareerRevision: revision,
    })
  ).data;
  for (let chunk = 0; chunk < 160 && current.run.status !== 'COMPLETED'; chunk++) {
    const decision = current.run.decision;
    if (decision) pauses++;
    const result = await call(
      `/v1/careers/${created.snapshot.careerId}/annual-runs/${current.run.id}/${decision ? 'decisions' : 'advance'}`,
      decision
        ? {
            expectedJobRevision: current.run.revision,
            decisionKey: decision.key,
            choiceId: decision.choices[0].id,
          }
        : { expectedJobRevision: current.run.revision },
    );
    timings.push({
      ms: result.ms,
      bytes: result.bytes,
      commands: result.data.run.careerRevision - current.run.careerRevision,
    });
    current = result.data;
  }
  if (current.run.status !== 'COMPLETED') throw new Error('Bounded benchmark did not finish');
  revision = current.run.careerRevision;
  stories += current.run.report.stories.length;
}
const sorted = timings.map((x) => x.ms).sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      runtime: 'local Wrangler/workerd HTTP; wall time, not production CPU',
      years: 3,
      mode: 'FAST',
      chunks: timings.length,
      pauses,
      stories,
      maxCommands: Math.max(...timings.map((x) => x.commands)),
      maxResponseBytes: Math.max(...timings.map((x) => x.bytes)),
      p50Ms: sorted[Math.floor(sorted.length * 0.5)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      maxMs: sorted.at(-1),
    },
    null,
    2,
  ),
);
