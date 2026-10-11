// Private operator session required. Preview by default; no credentials or profile cursors in stdout.
const base = process.env.OWNER_TITLE_API_BASE_URL;
const token = process.env.OWNER_TITLE_ADMIN_TOKEN;
if (!base || !token) throw new Error('Set OWNER_TITLE_API_BASE_URL and OWNER_TITLE_ADMIN_TOKEN.');
const apply = process.argv.includes('--apply');
const all = process.argv.includes('--all');
let after = process.env.OWNER_TITLE_AFTER ?? '';
const counts = {};
let processed = 0;
for (let batch = 0; batch < (all ? 200 : 1); batch++) {
  const res = await fetch(new URL('/v1/admin/owner-titles/backfill', base), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ after, limit: 25, dryRun: !apply }),
  });
  if (!res.ok)
    throw new Error(
      `Backfill stopped at batch ${batch + 1}: HTTP ${res.status}. Re-running is safe.`,
    );
  const { data } = await res.json();
  processed += data.processed;
  for (const [id, n] of Object.entries(data.counts)) counts[id] = (counts[id] ?? 0) + n;
  after = data.next;
  console.log(JSON.stringify({ dryRun: !apply, processed, counts, more: !!after }));
  if (!after) break;
}
