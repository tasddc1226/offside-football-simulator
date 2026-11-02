import { describe, it, expect } from 'vitest';
import { classifyObject, inventory } from './r2-inventory.mjs';
const now = Date.parse('2026-11-02T01:00:00Z');
const env = { CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_API_TOKEN: 'secret' };
describe('read-only R2 accounting', () => {
  it('keeps monthly backups and archives separate from old daily review candidates', () => {
    expect(
      classifyObject({ key: 'd1/production/2026-09-01/0001.sql.gz', size: 1 }, now).retention,
    ).toBe('monthly-kept');
    expect(classifyObject({ key: 'd1/production/2026-09-02.sql.gz', size: 1 }, now).retention).toBe(
      'daily-over-30d-review',
    );
    expect(classifyObject({ key: 'season-events/production/id', size: 1 }, now).retention).toBe(
      'reference-review-required',
    );
  });
  it('follows cursors with bounded GETs, reports partial inventories and refuses unknown pages', async () => {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        success: true,
        result: [{ key: 'd1/production/2026-11-01/0001.sql.gz', size: 10 }],
        result_info: { is_truncated: calls.length === 1, cursor: 'next' },
      });
    };
    const all = await inventory(env, fetcher, { now });
    expect(all).toMatchObject({ complete: true, pages: 2 });
    expect(all.groups[0]).toMatchObject({ objects: 2, bytes: 20 });
    expect(calls[1].url.searchParams.get('cursor')).toBe('next');
    expect(calls.every(({ init }) => !init.method || init.method === 'GET')).toBe(true);
    expect(
      (await inventory(env, async () => Response.json({ success: true, result: [] }), { now }))
        .complete,
    ).toBe(true);
    calls.length = 0;
    expect((await inventory(env, fetcher, { maxPages: 1, now })).complete).toBe(false);
    await expect(
      inventory(env, async () =>
        Response.json({ success: true, result: Array(1000).fill({ key: 'x', size: 1 }) }),
      ),
    ).rejects.toThrow('incomplete');
  });
});
